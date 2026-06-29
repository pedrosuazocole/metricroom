// routes/reservas.js - Gestión completa de reservas
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { sendWhatsApp } = require('../utils/whatsapp');
const { sendReservaEmail } = require('../utils/email');

// Generar código único de reserva
function generarCodigo() {
  const fecha = new Date();
  const year = fecha.getFullYear().toString().slice(-2);
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `RES-${year}${month}${day}-${random}`;
}

// GET /api/reservas - Listar reservas con filtros
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { estado, fecha_desde, fecha_hasta, huesped_id, habitacion_id, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT r.*, 
        h.nombres || ' ' || h.apellidos AS huesped_nombre,
        h.telefono AS huesped_tel,
        h.email AS huesped_email,
        hab.numero AS habitacion_numero,
        hab.tipo AS habitacion_tipo,
        hab.piso AS habitacion_piso
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) { query += ' AND r.estado = ?'; params.push(estado); }
    if (fecha_desde) { query += ' AND r.fecha_entrada >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { query += ' AND r.fecha_salida <= ?'; params.push(fecha_hasta); }
    if (huesped_id) { query += ' AND r.huesped_id = ?'; params.push(huesped_id); }
    if (habitacion_id) { query += ' AND r.habitacion_id = ?'; params.push(habitacion_id); }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const reservas = db.prepare(query).all(...params);
    // Contar total usando prepared statement para evitar inyección SQL
    const totalQuery = estado
      ? 'SELECT COUNT(*) as cnt FROM reservas r WHERE r.estado = ?'
      : 'SELECT COUNT(*) as cnt FROM reservas r';
    const total = estado
      ? db.prepare(totalQuery).get(estado).cnt
      : db.prepare(totalQuery).get().cnt;

    res.json({ ok: true, data: reservas, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/reservas/disponibilidad/:habitacion_id - Fechas ocupadas para el calendario
router.get('/disponibilidad/:habitacion_id', (req, res) => {
  try {
    const db = getDB();
    const ocupadas = db.prepare(`
      SELECT fecha_entrada, fecha_salida, codigo, estado
      FROM reservas
      WHERE habitacion_id = ?
        AND estado NOT IN ('CANCELADA','CHECKOUT','NO_SHOW')
        AND fecha_salida >= date('now')
      ORDER BY fecha_entrada ASC
    `).all(req.params.habitacion_id);
    res.json({ ok: true, data: ocupadas });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/reservas/hoy - Check-ins y checkouts del día
router.get('/hoy', (req, res) => {
  try {
    const db = getDB();
    const hoy = new Date().toISOString().split('T')[0];

    const checkins_hoy = db.prepare(`
      SELECT r.*, h.nombres || ' ' || h.apellidos AS huesped_nombre, hab.numero
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE r.fecha_entrada = ? AND r.estado IN ('CONFIRMADA','GARANTIZADA')
    `).all(hoy);

    const checkouts_hoy = db.prepare(`
      SELECT c.*, h.nombres || ' ' || h.apellidos AS huesped_nombre, hab.numero
      FROM checkins c
      JOIN huespedes h ON c.huesped_id = h.id
      JOIN habitaciones hab ON c.habitacion_id = hab.id
      WHERE c.fecha_checkout_prevista = ? AND c.estado = 'ACTIVO'
    `).all(hoy);

    res.json({ ok: true, data: { checkins_hoy, checkouts_hoy } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/reservas/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const reserva = db.prepare(`
      SELECT r.*, 
        h.nombres || ' ' || h.apellidos AS huesped_nombre,
        h.numero_doc, h.rtn, h.telefono, h.email, h.empresa, h.nacionalidad,
        hab.numero AS habitacion_numero, hab.tipo AS habitacion_tipo, hab.piso
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    res.json({ ok: true, data: reserva });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/reservas - Crear nueva reserva
// Acepta huesped_id (existente) O huesped_nuevo (objeto con datos para crear al vuelo)
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const {
      huesped_id, huesped_nuevo, habitacion_id, fecha_entrada, fecha_salida,
      adultos, ninos, tipo_garantia, monto_deposito, motivo_visita,
      empresa, cliente_corporativo_id, tarifa_aplicada, moneda, tasa_cambio, notas, origen,
    } = req.body;

    if (!habitacion_id || !fecha_entrada || !fecha_salida || !tarifa_aplicada) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos incompletos' });
    }
    if (!huesped_id && !huesped_nuevo) {
      return res.status(400).json({ ok: false, error: 'Debe indicar huesped_id o los datos del nuevo huésped' });
    }
    if (new Date(fecha_salida) <= new Date(fecha_entrada)) {
      return res.status(400).json({ ok: false, error: 'La fecha de salida debe ser posterior a la entrada' });
    }

    // Verificar disponibilidad: sin traslape de fechas
    const conflicto = db.prepare(`
      SELECT r.id FROM reservas r
      WHERE r.habitacion_id = ?
        AND r.estado NOT IN ('CANCELADA','CHECKOUT','NO_SHOW')
        AND NOT (r.fecha_salida <= ? OR r.fecha_entrada >= ?)
    `).get(habitacion_id, fecha_entrada, fecha_salida);

    if (conflicto) {
      return res.status(409).json({ ok: false, error: 'La habitación no está disponible en esas fechas' });
    }

    const noches = Math.max(1, Math.ceil(
      (new Date(fecha_salida) - new Date(fecha_entrada)) / (1000 * 60 * 60 * 24)
    ));
    const total_estimado = tarifa_aplicada * noches;
    const codigo = generarCodigo();

    const crearReserva = db.transaction(() => {
      // Si vienen datos de huésped nuevo, crearlo primero (o reutilizar si ya existe el documento)
      let huespedIdFinal = huesped_id;
      if (!huespedIdFinal && huesped_nuevo) {
        const { nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono,
                nacionalidad, empresa: empresaHuesped, exento_isv } = huesped_nuevo;

        if (!nombres || !apellidos || !tipo_doc || !numero_doc) {
          throw new Error('Datos del huésped incompletos: nombres, apellidos, tipo_doc y numero_doc son requeridos');
        }

        // Evitar duplicar huésped si ya existe ese documento
        const existente = db.prepare('SELECT id FROM huespedes WHERE numero_doc = ?').get(numero_doc);
        if (existente) {
          huespedIdFinal = existente.id;
        } else {
          const rH = db.prepare(`
            INSERT INTO huespedes (nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono,
              nacionalidad, empresa, exento_isv)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(nombres, apellidos, tipo_doc, numero_doc, rtn || null, email || null, telefono || null,
                 nacionalidad || 'Hondureña', empresaHuesped || empresa || null, exento_isv ? 1 : 0);
          huespedIdFinal = rH.lastInsertRowid;
        }
      }

      const result = db.prepare(`
        INSERT INTO reservas (
          codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida, noches,
          adultos, ninos, tipo_garantia, monto_deposito, motivo_visita, empresa,
          cliente_corporativo_id, tarifa_aplicada, moneda, tasa_cambio, total_estimado,
          notas, origen, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA')
      `).run(
        codigo, huespedIdFinal, habitacion_id, fecha_entrada, fecha_salida, noches,
        adultos || 1, ninos || 0, tipo_garantia, monto_deposito || 0, motivo_visita,
        empresa, cliente_corporativo_id || null, tarifa_aplicada, moneda || 'HNL',
        tasa_cambio || 1, total_estimado, notas, origen || 'MOSTRADOR'
      );

      db.prepare(`UPDATE habitaciones SET estado = 'RESERVADA' WHERE id = ?`).run(habitacion_id);

      return { reservaId: result.lastInsertRowid, huespedIdFinal };
    });

    const { reservaId, huespedIdFinal } = crearReserva();

    // Notificaciones — WhatsApp y Email
    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(huespedIdFinal);
    const habitacionInfo = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(habitacion_id);

    if (huesped?.telefono) {
      const msg = `🏨 *MetricRoom* - Reserva Confirmada\n` +
        `Hola ${huesped.nombres}, tu reserva *${codigo}* ha sido confirmada.\n` +
        `📅 Check-in: ${fecha_entrada}\n📅 Check-out: ${fecha_salida}\n` +
        `¡Te esperamos!`;
      sendWhatsApp(huesped.telefono, msg).catch(console.error);
    }
    if (huesped?.email) {
      sendReservaEmail(huesped.email, {
        codigo, huesped: huesped.nombres,
        habitacionNumero: habitacionInfo?.numero,
        fechaEntrada: fecha_entrada, fechaSalida: fecha_salida,
      }).catch(console.error);
    }

    res.status(201).json({
      ok: true,
      data: { id: reservaId, codigo, huesped_id: huespedIdFinal },
      message: 'Reserva creada exitosamente'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/reservas/:id/estado
router.patch('/:id/estado', (req, res) => {
  try {
    const db = getDB();
    const { estado } = req.body;
    const estadosValidos = ['PENDIENTE','CONFIRMADA','GARANTIZADA','CHECKIN','CHECKOUT','CANCELADA','NO_SHOW'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido' });
    }

    const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });

    db.prepare('UPDATE reservas SET estado = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(estado, req.params.id);

    // Si se cancela, liberar habitación
    if (estado === 'CANCELADA' || estado === 'NO_SHOW') {
      db.prepare(`UPDATE habitaciones SET estado = 'DISPONIBLE' WHERE id = ?`).run(reserva.habitacion_id);
    }

    res.json({ ok: true, message: `Reserva actualizada a ${estado}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/reservas/:id - Solo cancelar, no borrar
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    if (reserva.estado === 'CHECKIN') {
      return res.status(400).json({ ok: false, error: 'No se puede cancelar una reserva con check-in activo' });
    }

    db.prepare(`UPDATE reservas SET estado = 'CANCELADA', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?`)
      .run(req.params.id);
    db.prepare(`UPDATE habitaciones SET estado = 'DISPONIBLE' WHERE id = ?`).run(reserva.habitacion_id);

    res.json({ ok: true, message: 'Reserva cancelada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
