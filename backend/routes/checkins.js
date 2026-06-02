// routes/checkins.js - Check-In, Check-Out y servicios extras
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { sendWhatsApp } = require('../utils/whatsapp');

// GET /api/checkins/activos
router.get('/activos', (req, res) => {
  try {
    const db = getDB();
    const activos = db.prepare(`
      SELECT c.*,
        h.nombres || ' ' || h.apellidos AS huesped_nombre,
        h.telefono, h.email, h.nacionalidad, h.empresa, r.motivo_visita,
        hab.numero, hab.tipo, hab.piso,
        r.codigo AS reserva_codigo, r.tipo_garantia, r.tarifa_aplicada, r.moneda,
        COALESCE((SELECT SUM(subtotal) FROM servicios_extras se WHERE se.checkin_id = c.id), 0) AS total_extras,
        (r.tarifa_aplicada * CAST((julianday(c.fecha_checkout_prevista) - julianday(c.fecha_checkin)) AS INTEGER)) AS cargo_habitacion
      FROM checkins c
      JOIN huespedes h ON c.huesped_id = h.id
      JOIN habitaciones hab ON c.habitacion_id = hab.id
      JOIN reservas r ON c.reserva_id = r.id
      WHERE c.estado = 'ACTIVO'
      ORDER BY c.fecha_checkin DESC
    `).all();
    res.json({ ok: true, data: activos });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/checkins/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const checkin = db.prepare(`
      SELECT c.*, h.*, hab.numero, hab.tipo, hab.piso,
        r.codigo, r.tarifa_aplicada, r.moneda, r.tasa_cambio, r.tipo_garantia,
        r.monto_deposito, r.notas
      FROM checkins c
      JOIN huespedes h ON c.huesped_id = h.id
      JOIN habitaciones hab ON c.habitacion_id = hab.id
      JOIN reservas r ON c.reserva_id = r.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in no encontrado' });

    const extras = db.prepare('SELECT * FROM servicios_extras WHERE checkin_id = ?').all(req.params.id);
    res.json({ ok: true, data: { ...checkin, extras } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/checkins - Realizar check-in
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { reserva_id, observaciones, atendido_por } = req.body;

    if (!reserva_id) return res.status(400).json({ ok: false, error: 'reserva_id requerido' });

    const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(reserva_id);
    if (!reserva) return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    if (!['CONFIRMADA','GARANTIZADA'].includes(reserva.estado)) {
      return res.status(400).json({ ok: false, error: `La reserva está en estado ${reserva.estado}` });
    }

    // Verificar no hay checkin activo en esa habitación
    const checkinActivo = db.prepare(
      `SELECT id FROM checkins WHERE habitacion_id = ? AND estado = 'ACTIVO'`
    ).get(reserva.habitacion_id);
    if (checkinActivo) {
      return res.status(409).json({ ok: false, error: 'La habitación ya tiene un check-in activo' });
    }

    // Transacción atómica
    const doCheckin = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO checkins (reserva_id, huesped_id, habitacion_id, fecha_checkin, 
          fecha_checkout_prevista, estado, observaciones, atendido_por)
        VALUES (?, ?, ?, datetime('now','localtime'), ?, 'ACTIVO', ?, ?)
      `).run(reserva_id, reserva.huesped_id, reserva.habitacion_id,
             reserva.fecha_salida, observaciones, atendido_por);

      db.prepare(`UPDATE reservas SET estado = 'CHECKIN', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(reserva_id);
      db.prepare(`UPDATE habitaciones SET estado = 'OCUPADA', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(reserva.habitacion_id);

      return result.lastInsertRowid;
    });

    const checkinId = doCheckin();

    // Notificación WhatsApp
    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(reserva.huesped_id);
    const hab = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(reserva.habitacion_id);
    if (huesped?.telefono) {
      const msg = `🏨 *MetricRoom* - Check-In Exitoso\n` +
        `Bienvenido/a ${huesped.nombres}! 🎉\n` +
        `🛏️ Habitación: *${hab?.numero}*\n` +
        `📅 Check-out: ${reserva.fecha_salida}\n` +
        `Cualquier necesidad, estamos a tu servicio.`;
      sendWhatsApp(huesped.telefono, msg).catch(console.error);
    }

    res.status(201).json({ ok: true, data: { checkin_id: checkinId }, message: 'Check-in realizado exitosamente' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/checkins/:id/checkout - Realizar check-out
router.post('/:id/checkout', (req, res) => {
  try {
    const db = getDB();
    const { observaciones } = req.body;

    const checkin = db.prepare(`
      SELECT c.*, r.tarifa_aplicada, r.moneda, r.monto_deposito
      FROM checkins c JOIN reservas r ON c.reserva_id = r.id
      WHERE c.id = ? AND c.estado = 'ACTIVO'
    `).get(req.params.id);

    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in activo no encontrado' });

    const doCheckout = db.transaction(() => {
      db.prepare(`
        UPDATE checkins SET estado = 'CHECKOUT', fecha_checkout_real = datetime('now','localtime'),
          observaciones = COALESCE(?, observaciones)
        WHERE id = ?
      `).run(observaciones, req.params.id);

      db.prepare(`UPDATE reservas SET estado = 'CHECKOUT', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(checkin.reserva_id);

      // Habitación pasa a SUCIA post-checkout
      db.prepare(`UPDATE habitaciones SET estado = 'SUCIA', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(checkin.habitacion_id);
    });

    doCheckout();

    // Notificación WhatsApp
    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(checkin.huesped_id);
    if (huesped?.telefono) {
      const msg = `🏨 *MetricRoom* - Check-Out Confirmado\n` +
        `Gracias ${huesped.nombres} por hospedarte con nosotros.\n` +
        `¡Esperamos verte pronto! 🙏`;
      sendWhatsApp(huesped.telefono, msg).catch(console.error);
    }

    res.json({ ok: true, message: 'Check-out realizado. Habitación marcada para limpieza.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/checkins/:id/extras - Agregar servicio extra al folio
router.post('/:id/extras', (req, res) => {
  try {
    const db = getDB();
    const { descripcion, cantidad, precio_unitario, categoria } = req.body;

    if (!descripcion || !precio_unitario) {
      return res.status(400).json({ ok: false, error: 'descripcion y precio_unitario requeridos' });
    }

    const checkin = db.prepare(`SELECT id FROM checkins WHERE id = ? AND estado = 'ACTIVO'`).get(req.params.id);
    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in no encontrado o inactivo' });

    const qty = cantidad || 1;
    const subtotal = qty * precio_unitario;

    const result = db.prepare(`
      INSERT INTO servicios_extras (checkin_id, descripcion, cantidad, precio_unitario, subtotal, categoria)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, descripcion, qty, precio_unitario, subtotal, categoria || 'OTROS');

    res.status(201).json({ ok: true, data: { id: result.lastInsertRowid, subtotal }, message: 'Servicio agregado al folio' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/checkins/:id/extras
router.get('/:id/extras', (req, res) => {
  try {
    const db = getDB();
    const extras = db.prepare('SELECT * FROM servicios_extras WHERE checkin_id = ? ORDER BY fecha DESC').all(req.params.id);
    const total = extras.reduce((s, e) => s + e.subtotal, 0);
    res.json({ ok: true, data: extras, total });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

// POST /api/checkins/:id/cambio-habitacion
router.post('/:id/cambio-habitacion', (req, res) => {
  try {
    const db = getDB();
    const { nueva_habitacion_id } = req.body;
    if (!nueva_habitacion_id) return res.status(400).json({ ok: false, error: 'nueva_habitacion_id requerido' });

    const checkin = db.prepare(`SELECT * FROM checkins WHERE id = ? AND estado = 'ACTIVO'`).get(req.params.id);
    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in activo no encontrado' });

    const nueva = db.prepare("SELECT * FROM habitaciones WHERE id = ? AND estado = 'DISPONIBLE'").get(nueva_habitacion_id);
    if (!nueva) return res.status(409).json({ ok: false, error: 'La habitación destino no está disponible' });

    const doCambio = db.transaction(() => {
      // Liberar habitación anterior
      db.prepare(`UPDATE habitaciones SET estado = 'DISPONIBLE' WHERE id = ?`).run(checkin.habitacion_id);
      // Ocupar nueva habitación
      db.prepare(`UPDATE habitaciones SET estado = 'OCUPADA' WHERE id = ?`).run(nueva_habitacion_id);
      // Actualizar el check-in
      db.prepare('UPDATE checkins SET habitacion_id = ? WHERE id = ?').run(nueva_habitacion_id, req.params.id);
      // Actualizar la reserva
      db.prepare('UPDATE reservas SET habitacion_id = ? WHERE id = ?').run(nueva_habitacion_id, checkin.reserva_id);
    });

    doCambio();
    res.json({ ok: true, message: `Habitación cambiada a ${nueva.numero}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
