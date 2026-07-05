// routes/facturas.js - Facturación fiscal SAR Honduras
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { sendWhatsApp } = require('../utils/whatsapp');
const { sendFacturaEmail } = require('../utils/email');

// Generar número de factura formato SAR: 000-001-01-00000001
function generarNumeroFactura(db) {
  const config = db.prepare('SELECT * FROM configuracion_sar WHERE activo = 1 ORDER BY id DESC LIMIT 1').get();
  if (!config) throw new Error('No hay configuración SAR activa. Configure el CAI primero.');

  const correlativo = config.correlativo_actual;
  const numero = `${config.establecimiento}-${config.punto_emision}-${config.tipo_documento}-${String(correlativo).padStart(8, '0')}`;

  // Verificar que no supere el rango
  if (correlativo > parseInt(config.rango_final.split('-').pop())) {
    throw new Error('Se agotó el rango de facturación. Solicite nuevo CAI a la SAR.');
  }

  // Incrementar correlativo
  db.prepare('UPDATE configuracion_sar SET correlativo_actual = correlativo_actual + 1 WHERE id = ?').run(config.id);

  return { numero, cai: config.cai, config };
}

// GET /api/facturas
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { estado, fecha_desde, fecha_hasta, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT f.*,
        (SELECT nombres || ' ' || apellidos FROM huespedes WHERE id = f.huesped_id) AS huesped_nombre
      FROM facturas f WHERE 1=1
    `;
    const params = [];
    if (estado) { query += ' AND f.estado = ?'; params.push(estado); }
    if (fecha_desde) { query += ' AND date(f.created_at) >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { query += ' AND date(f.created_at) <= ?'; params.push(fecha_hasta); }
    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const facturas = db.prepare(query).all(...params);
    res.json({ ok: true, data: facturas });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/facturas/sar/config
router.get('/sar/config', (req, res) => {
  try {
    const db = getDB();
    const config = db.prepare('SELECT * FROM configuracion_sar WHERE activo = 1 ORDER BY id DESC LIMIT 1').get();
    res.json({ ok: true, data: config });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/facturas/sar/config - Configurar CAI
router.post('/sar/config', (req, res) => {
  try {
    const db = getDB();
    const { cai, rango_inicial, rango_final, fecha_limite_emision, establecimiento, punto_emision, tipo_documento } = req.body;

    if (!cai || !rango_inicial || !rango_final || !fecha_limite_emision) {
      return res.status(400).json({ ok: false, error: 'CAI, rangos y fecha límite son requeridos' });
    }

    // Desactivar configuración anterior
    db.prepare('UPDATE configuracion_sar SET activo = 0').run();

    // Extraer correlativo inicial del rango
    const correlativoInicial = parseInt(rango_inicial.split('-').pop()) || 1;

    const result = db.prepare(`
      INSERT INTO configuracion_sar (cai, rango_inicial, rango_final, fecha_limite_emision, 
        correlativo_actual, establecimiento, punto_emision, tipo_documento, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(cai, rango_inicial, rango_final, fecha_limite_emision, correlativoInicial,
           establecimiento || '001', punto_emision || '001', tipo_documento || '01');

    res.status(201).json({ ok: true, data: { id: result.lastInsertRowid }, message: 'Configuración SAR guardada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/facturas/:id - Con detalle completo
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    if (!factura) return res.status(404).json({ ok: false, error: 'Factura no encontrada' });

    const detalle = db.prepare('SELECT * FROM detalle_facturas WHERE factura_id = ?').all(req.params.id);
    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(factura.huesped_id);
    const hotel = {};
    const configs = db.prepare('SELECT clave, valor FROM configuracion_hotel').all();
    configs.forEach(c => hotel[c.clave] = c.valor);

    // Datos del CAI vigente al momento de consultar (para mostrar rango y fecha límite en la impresión)
    const sar = db.prepare('SELECT rango_inicial, rango_final, fecha_limite_emision FROM configuracion_sar WHERE cai = ?').get(factura.cai);

    res.json({
      ok: true,
      data: {
        ...factura, detalle, huesped, hotel,
        rango_inicial: sar?.rango_inicial,
        rango_final: sar?.rango_final,
        fecha_limite_emision: sar?.fecha_limite_emision,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/facturas - Emitir factura fiscal
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const {
      checkin_id, reserva_id, huesped_id, cliente_corporativo_id,
      cliente_nombre, cliente_rtn, cliente_direccion,
      // items: [{ descripcion, cantidad, precio_unitario, aplica_isv: bool, aplica_iht: bool }]
      // Regla de negocio Honduras (Hotel):
      //  - Hospedaje: ISV 15% + IHT 4% (ambos, sobre el mismo subtotal)
      //  - Otros servicios (restaurante, lavandería, etc.): solo ISV 15%
      //  - Cliente exonerado de ISV: el IHT 4% se sigue cobrando igual, ISV se omite
      items,
      moneda, tasa_cambio, metodo_pago,
      descuento, observaciones, created_by,
      forzar_exento_isv, // true si el huésped/cliente está exonerado de ISV
    } = req.body;

    if (!huesped_id || !items?.length || !metodo_pago) {
      return res.status(400).json({ ok: false, error: 'huesped_id, items y metodo_pago son requeridos' });
    }
    // Una factura AL CRÉDITO necesita un Cliente Corporativo para poder
    // registrarse en Cuentas por Cobrar (ahí vive el plazo de días de crédito).
    if (metodo_pago === 'CREDITO' && !cliente_corporativo_id) {
      return res.status(400).json({ ok: false, error: 'Para facturar al crédito, seleccioná un Cliente Corporativo' });
    }

    // Leer tasas de impuesto desde configuración (editables en Configuración → Hotel)
    const cfgIsv = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'isv_porcentaje'").get();
    const cfgIht = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'iht_porcentaje'").get();
    const TASA_ISV = (parseFloat(cfgIsv?.valor) || 15) / 100;  // default 15%
    const TASA_IHT = (parseFloat(cfgIht?.valor) || 4)  / 100;  // default 4%

    // Detectar exoneración: por flag explícito en el request o por configuración del huésped
    const huespedRow = db.prepare('SELECT exento_isv FROM huespedes WHERE id = ?').get(huesped_id);
    const exentoISV = !!(forzar_exento_isv || huespedRow?.exento_isv);

    // Calcular bases gravables — un mismo ítem puede contribuir a ambas bases a la vez
    let base_isv = 0;   // base gravable ISV 15%
    let base_iht = 0;   // base gravable IHT 4%
    let base_exenta = 0; // parte que no paga ningún impuesto (ni ISV ni IHT)

    const itemsCalculados = items.map(item => {
      const sub = (item.cantidad || 1) * item.precio_unitario;
      const aplicaIsv = !!item.aplica_isv && !exentoISV;
      const aplicaIht = !!item.aplica_iht;

      if (aplicaIsv) base_isv += sub;
      if (aplicaIht) base_iht += sub;
      if (!aplicaIsv && !aplicaIht) base_exenta += sub;

      return { ...item, sub, aplicaIsv, aplicaIht };
    });

    const isv_15 = base_isv * TASA_ISV;
    const iht_4  = base_iht * TASA_IHT;
    const desc = descuento || 0;
    // OJO: base_isv y base_iht son bases GRAVABLES para el desglose fiscal y
    // se solapan a propósito (hospedaje paga ISV e IHT sobre el mismo monto).
    // El total real es cada línea contada UNA sola vez (subtotalGeneral) más
    // los impuestos — sumar base_isv + base_iht duplicaría el cargo.
    const subtotalGeneral = itemsCalculados.reduce((s, it) => s + it.sub, 0);
    const total = subtotalGeneral + isv_15 + iht_4 - desc;

    // Transacción atómica
    const emitir = db.transaction(() => {
      const { numero, cai } = generarNumeroFactura(db);

      const result = db.prepare(`
        INSERT INTO facturas (
          numero_factura, cai, checkin_id, reserva_id, huesped_id,
          cliente_nombre, cliente_rtn, cliente_direccion,
          moneda, tasa_cambio,
          subtotal_exento, subtotal_gravado_isv, subtotal_gravado_iht,
          isv_15, iht_4, descuento, total,
          estado, metodo_pago, observaciones, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITIDA', ?, ?, ?)
      `).run(
        numero, cai, checkin_id, reserva_id, huesped_id,
        cliente_nombre, cliente_rtn, cliente_direccion,
        moneda || 'HNL', tasa_cambio || 1,
        base_exenta, base_isv, base_iht,
        isv_15, iht_4, desc, total, metodo_pago, observaciones, created_by
      );

      const facturaId = result.lastInsertRowid;

      const insertDetalle = db.prepare(`
        INSERT INTO detalle_facturas (factura_id, descripcion, cantidad, precio_unitario, aplica_isv, aplica_iht, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      itemsCalculados.forEach(item => {
        insertDetalle.run(
          facturaId, item.descripcion, item.cantidad || 1, item.precio_unitario,
          item.aplicaIsv ? 1 : 0, item.aplicaIht ? 1 : 0, item.sub
        );
      });

      // Factura al crédito -> generar su Cuenta por Cobrar automáticamente.
      // La fecha de vencimiento sale de los días de crédito configurados
      // para ese cliente corporativo (por defecto 30 si no tiene definidos).
      if (metodo_pago === 'CREDITO') {
        const cliente = db.prepare('SELECT dias_credito FROM clientes_corporativos WHERE id = ?').get(cliente_corporativo_id);
        const dias = cliente?.dias_credito ?? 30;
        const vencimiento = new Date();
        vencimiento.setDate(vencimiento.getDate() + dias);
        const fechaVencimiento = vencimiento.toISOString().split('T')[0];

        db.prepare(`
          INSERT INTO cuentas_cobrar (factura_id, cliente_id, monto_original, saldo_pendiente, fecha_vencimiento, estado)
          VALUES (?, ?, ?, ?, ?, 'PENDIENTE')
        `).run(facturaId, cliente_corporativo_id, total, total, fechaVencimiento);
      }

      return { facturaId, numero, total };
    });

    const { facturaId, numero, total: totalFinal } = emitir();

    // Notificación WhatsApp
    const huesped = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(huesped_id);
    if (huesped?.telefono) {
      const msg = `🏨 *MetricRoom* - Factura Emitida\n` +
        `Factura: *${numero}*\n` +
        `Total: *L. ${totalFinal.toFixed(2)}*\n` +
        `¡Gracias por preferirnos!`;
      sendWhatsApp(huesped.telefono, msg).catch(console.error);
    }
    if (huesped?.email) {
      sendFacturaEmail(huesped.email, numero, totalFinal, huesped.nombres).catch(console.error);
    }

    res.status(201).json({
      ok: true,
      data: { id: facturaId, numero_factura: numero, total: totalFinal },
      message: 'Factura emitida exitosamente'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/facturas/:id/anular
router.patch('/:id/anular', (req, res) => {
  try {
    const db = getDB();
    const { motivo } = req.body;
    const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    if (!factura) return res.status(404).json({ ok: false, error: 'Factura no encontrada' });
    if (factura.estado === 'ANULADA') return res.status(400).json({ ok: false, error: 'Ya está anulada' });

    db.prepare("UPDATE facturas SET estado = 'ANULADA', observaciones = ? WHERE id = ?")
      .run(`ANULADA: ${motivo}`, req.params.id);

    res.json({ ok: true, message: 'Factura anulada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


module.exports = router;
