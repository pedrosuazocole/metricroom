// routes/checkins.js - Check-In, Check-Out y servicios extras
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { sendWhatsApp } = require('../utils/whatsapp');
const { sendCheckinEmail, sendFacturaEmail } = require('../utils/email');

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

// GET /api/checkins/:id - Detalle completo para folio e impresión de hoja de recepción
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const checkin = db.prepare(`
      SELECT c.*, h.*, hab.numero, hab.tipo, hab.piso,
        r.codigo, r.tarifa_aplicada, r.moneda, r.tasa_cambio, r.tipo_garantia,
        r.monto_deposito, r.notas, r.empresa, r.adultos, r.ninos, r.fecha_entrada, r.motivo_visita
      FROM checkins c
      JOIN huespedes h ON c.huesped_id = h.id
      JOIN habitaciones hab ON c.habitacion_id = hab.id
      JOIN reservas r ON c.reserva_id = r.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in no encontrado' });

    const extras = db.prepare('SELECT * FROM servicios_extras WHERE checkin_id = ?').all(req.params.id);

    const hotel = {};
    db.prepare('SELECT clave, valor FROM configuracion_hotel').all().forEach(c => hotel[c.clave] = c.valor);

    res.json({ ok: true, data: { ...checkin, extras, hotel } });
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

    const checkinActivo = db.prepare(
      `SELECT id FROM checkins WHERE habitacion_id = ? AND estado = 'ACTIVO'`
    ).get(reserva.habitacion_id);
    if (checkinActivo) {
      return res.status(409).json({ ok: false, error: 'La habitación ya tiene un check-in activo' });
    }

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
    if (huesped?.email) {
      sendCheckinEmail(huesped.email, {
        huesped: huesped.nombres, habitacionNumero: hab?.numero, fechaSalida: reserva.fecha_salida,
      }).catch(console.error);
    }

    res.status(201).json({ ok: true, data: { checkin_id: checkinId }, message: 'Check-in realizado exitosamente' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/checkins/:id/checkout - Realizar check-out con factura automática
router.post('/:id/checkout', (req, res) => {
  try {
    const db = getDB();
    const { observaciones, metodo_pago = 'EFECTIVO', generar_factura = true } = req.body;

    const checkin = db.prepare(`
      SELECT c.*, r.tarifa_aplicada, r.moneda, r.tasa_cambio, r.monto_deposito, r.notas,
        r.fecha_entrada, r.fecha_salida
      FROM checkins c JOIN reservas r ON c.reserva_id = r.id
      WHERE c.id = ? AND c.estado = 'ACTIVO'
    `).get(req.params.id);

    if (!checkin) return res.status(404).json({ ok: false, error: 'Check-in activo no encontrado' });

    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(checkin.huesped_id);
    const extras = db.prepare('SELECT * FROM servicios_extras WHERE checkin_id = ?').all(req.params.id);

    // Calcular noches reales
    const fechaIn  = new Date(checkin.fecha_checkin);
    const fechaOut = new Date();
    const noches   = Math.max(1, Math.round((fechaOut - fechaIn) / 86400000));

    // La factura SAR siempre se emite en Lempiras (requisito fiscal).
    // Si la reserva/check-in fue en USD, se convierte usando la tasa de cambio
    // (Tasa de Venta) que quedó guardada en la reserva al momento de crearla.
    const esUSD = (checkin.moneda || 'HNL') === 'USD';
    const tasaConversion = esUSD ? (parseFloat(checkin.tasa_cambio) || 1) : 1;

    const cargoHabOriginal = checkin.tarifa_aplicada * noches; // en la moneda original (USD o HNL)
    const totalExtrasOriginal = extras.reduce((s, e) => s + e.subtotal, 0); // extras también pueden venir en USD

    const cargoHab = cargoHabOriginal * tasaConversion;       // siempre en HNL para la factura
    const totalExtras = totalExtrasOriginal * tasaConversion; // siempre en HNL para la factura

    // Leer tasas de impuesto
    const cfgIsv = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'isv_porcentaje'").get();
    const cfgIht = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'iht_porcentaje'").get();
    const TASA_ISV = (parseFloat(cfgIsv?.valor) || 15) / 100;
    const TASA_IHT = (parseFloat(cfgIht?.valor) || 4)  / 100;

    let facturaId = null;
    let numeroFactura = null;
    let facturaYaExistia = false;

    const doCheckout = db.transaction(() => {
      // FIX 1: Quitar los backslashes incorrectos en datetime()
      db.prepare(`
        UPDATE checkins SET estado = 'CHECKOUT', fecha_checkout_real = datetime('now','localtime'),
          observaciones = COALESCE(?, observaciones)
        WHERE id = ?
      `).run(observaciones, req.params.id);

      db.prepare(`UPDATE reservas SET estado = 'CHECKOUT', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(checkin.reserva_id);

      db.prepare(`UPDATE habitaciones SET estado = 'SUCIA', updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(checkin.habitacion_id);

      // Verificar rango SAR antes de emitir.
      // Si ya existe una factura EMITIDA para este checkin (ej: el recepcionista
      // ya facturó manualmente desde Planning → Facturas antes del check-out),
      // no generar una segunda factura duplicada.
      const facturaExistente = db.prepare(
        "SELECT id, numero_factura FROM facturas WHERE checkin_id = ? AND estado = 'EMITIDA' LIMIT 1"
      ).get(req.params.id);

      if (facturaExistente) {
        facturaId = facturaExistente.id;
        numeroFactura = facturaExistente.numero_factura;
        facturaYaExistia = true;
      } else if (generar_factura) {
        const sarConfig = db.prepare('SELECT * FROM configuracion_sar WHERE activo = 1 ORDER BY id DESC LIMIT 1').get();
        if (sarConfig) {
          const correlativoFinal = parseInt(sarConfig.rango_final.split('-').pop());
          if (sarConfig.correlativo_actual > correlativoFinal) {
            throw new Error('Se agotó el rango de facturación SAR. Configure un nuevo CAI.');
          }

          // Huésped: ¿exonerado de ISV? El IHT 4% se cobra siempre, exoneración no lo afecta
          const huespedRow = db.prepare('SELECT exento_isv FROM huespedes WHERE id = ?').get(checkin.huesped_id);
          const exentoISV = !!huespedRow?.exento_isv;

          // Reglas de impuestos Honduras:
          //  - Hospedaje: ISV 15% + IHT 4% simultáneos sobre el mismo subtotal (salvo exoneración de ISV)
          //  - Servicios extra (restaurante, lavandería, minibar, etc.): solo ISV 15%
          // Nota: precio_unitario y subtotal de cada línea ya están en Lempiras (convertidos arriba)
          const items = [{
            descripcion: `Hospedaje ${noches} noche(s)${esUSD ? ` (USD ${checkin.tarifa_aplicada}/noche, tasa ${tasaConversion})` : ''}`,
            cantidad: noches,
            precio_unitario: checkin.tarifa_aplicada * tasaConversion,
            aplica_isv: !exentoISV,
            aplica_iht: true,
            subtotal: cargoHab,
          }];

          extras.forEach(ex => {
            items.push({
              descripcion: ex.descripcion,
              cantidad: ex.cantidad,
              precio_unitario: ex.precio_unitario * tasaConversion,
              aplica_isv: !exentoISV,
              aplica_iht: false,
              subtotal: ex.subtotal * tasaConversion,
            });
          });

          let base_isv = 0, base_iht = 0, base_exenta = 0;
          items.forEach(it => {
            if (it.aplica_isv) base_isv += it.subtotal;
            if (it.aplica_iht) base_iht += it.subtotal;
            if (!it.aplica_isv && !it.aplica_iht) base_exenta += it.subtotal;
          });
          const isv_15 = base_isv * TASA_ISV;
          const iht_4  = base_iht * TASA_IHT;
          const total  = base_exenta + base_isv + base_iht + isv_15 + iht_4;

          const correlativo = sarConfig.correlativo_actual;
          numeroFactura = `${sarConfig.establecimiento}-${sarConfig.punto_emision}-${sarConfig.tipo_documento}-${String(correlativo).padStart(8, '0')}`;

          db.prepare('UPDATE configuracion_sar SET correlativo_actual = correlativo_actual + 1 WHERE id = ?').run(sarConfig.id);

          // La factura SAR siempre queda en HNL (moneda fiscal). Si el origen fue USD,
          // se deja constancia en observaciones y se guarda la tasa usada para la conversión.
          const obsConversion = esUSD
            ? `Cobrado en USD (tarifa habitación: $${checkin.tarifa_aplicada}/noche). Convertido a HNL con tasa de venta ${tasaConversion}.`
            : null;

          const fRes = db.prepare(`
            INSERT INTO facturas (
              numero_factura, cai, checkin_id, reserva_id, huesped_id,
              cliente_nombre, cliente_rtn, moneda, tasa_cambio,
              subtotal_exento, subtotal_gravado_isv, subtotal_gravado_iht,
              isv_15, iht_4, descuento, total,
              estado, metodo_pago, observaciones, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'HNL', ?, ?, ?, ?, ?, ?, 0, ?, 'EMITIDA', ?, ?, 'SISTEMA')
          `).run(
            numeroFactura, sarConfig.cai,
            parseInt(req.params.id), checkin.reserva_id, checkin.huesped_id,
            huesped ? `${huesped.nombres} ${huesped.apellidos}` : 'Cliente',
            huesped?.rtn || null,
            tasaConversion,
            base_exenta, base_isv, base_iht,
            isv_15, iht_4, total, metodo_pago, obsConversion
          );

          facturaId = fRes.lastInsertRowid;

          const insertDet = db.prepare(`
            INSERT INTO detalle_facturas (factura_id, descripcion, cantidad, precio_unitario, aplica_isv, aplica_iht, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          items.forEach(it => insertDet.run(
            facturaId, it.descripcion, it.cantidad, it.precio_unitario,
            it.aplica_isv ? 1 : 0, it.aplica_iht ? 1 : 0, it.subtotal
          ));
        }
      }
    });

    doCheckout();

    if (huesped?.telefono) {
      const totalMsg = cargoHab + totalExtras;
      const lineaUSD = esUSD ? `💵 Equivalente: *$${(cargoHabOriginal + totalExtrasOriginal).toFixed(2)}* (tasa L.${tasaConversion})\n` : '';
      const msg = `🏨 *MetricRoom* - Check-Out Confirmado\n` +
        `Gracias ${huesped.nombres} por hospedarte con nosotros.\n` +
        (numeroFactura ? `🧾 Factura: *${numeroFactura}*\n` : '') +
        `💰 Total: *L. ${totalMsg.toFixed(2)}*\n` +
        lineaUSD +
        `¡Esperamos verte pronto! 🙏`;
      sendWhatsApp(huesped.telefono, msg).catch(console.error);
    }
    if (huesped?.email && numeroFactura) {
      sendFacturaEmail(huesped.email, numeroFactura, cargoHab + totalExtras, huesped.nombres).catch(console.error);
    }

    res.json({
      ok: true,
      message: 'Check-out realizado. Habitación marcada para limpieza.',
      data: {
        factura_id: facturaId,
        numero_factura: numeroFactura,
        factura_generada: !!facturaId,
        factura_reutilizada: facturaYaExistia,
      }
    });
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
      db.prepare(`UPDATE habitaciones SET estado = 'DISPONIBLE' WHERE id = ?`).run(checkin.habitacion_id);
      db.prepare(`UPDATE habitaciones SET estado = 'OCUPADA' WHERE id = ?`).run(nueva_habitacion_id);
      db.prepare('UPDATE checkins SET habitacion_id = ? WHERE id = ?').run(nueva_habitacion_id, req.params.id);
      db.prepare('UPDATE reservas SET habitacion_id = ? WHERE id = ?').run(nueva_habitacion_id, checkin.reserva_id);
    });

    doCambio();
    res.json({ ok: true, message: `Habitación cambiada a ${nueva.numero}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
