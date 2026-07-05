// routes/reportes.js - Reportes operativos y financieros
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// Helper: normaliza el rango de fechas que manda el frontend (desde/hasta)
// con valores por defecto sensatos si no llegan.
function rangoFechas(query, defaultDesdeInicioDeMes = false) {
  const hoy = new Date().toISOString().split('T')[0];
  let desde = query.desde;
  if (!desde) {
    if (defaultDesdeInicioDeMes) {
      const n = new Date();
      desde = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      desde = hoy;
    }
  }
  const hasta = query.hasta || hoy;
  return { desde, hasta };
}

// ─── CIERRE DE CAJA ──────────────────────────────────────────────
router.get('/cierre-caja', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query);

    const por_metodo = db.prepare(`
      SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
      FROM facturas
      WHERE date(created_at) BETWEEN ? AND ? AND estado = 'EMITIDA'
      GROUP BY metodo_pago
      ORDER BY total DESC
    `).all(desde, hasta);

    const totales = db.prepare(`
      SELECT SUM(total) as total_ingresos, SUM(isv_15) as total_isv, SUM(iht_4) as total_iht
      FROM facturas WHERE date(created_at) BETWEEN ? AND ? AND estado = 'EMITIDA'
    `).get(desde, hasta);

    const checkins = db.prepare(`SELECT COUNT(*) as cnt FROM checkins WHERE date(fecha_checkin) BETWEEN ? AND ?`).get(desde, hasta);
    const checkouts = db.prepare(`SELECT COUNT(*) as cnt FROM checkins WHERE date(fecha_checkout_real) BETWEEN ? AND ?`).get(desde, hasta);

    res.json({
      ok: true,
      data: {
        por_metodo,
        total_ingresos: totales.total_ingresos || 0,
        total_isv: totales.total_isv || 0,
        total_iht: totales.total_iht || 0,
        total_checkins: checkins.cnt,
        total_checkouts: checkouts.cnt,
      }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── LIBRO DE VENTAS ─────────────────────────────────────────────
router.get('/libro-ventas', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query, true);

    const facturas = db.prepare(`
      SELECT f.id, f.numero_factura, f.created_at as fecha, f.cliente_nombre, f.cliente_rtn,
             f.subtotal_exento, f.subtotal_gravado_isv, f.subtotal_gravado_iht,
             f.isv_15, f.iht_4, f.total, f.metodo_pago
      FROM facturas f
      WHERE date(f.created_at) BETWEEN ? AND ? AND f.estado != 'ANULADA'
      ORDER BY f.created_at
    `).all(desde, hasta);

    const totales = db.prepare(`
      SELECT SUM(subtotal_exento) as total_exento, SUM(subtotal_gravado_isv) as total_gravado_isv,
        SUM(subtotal_gravado_iht) as total_gravado_iht, SUM(isv_15) as total_isv,
        SUM(iht_4) as total_iht, SUM(total) as total_general
      FROM facturas
      WHERE date(created_at) BETWEEN ? AND ? AND estado != 'ANULADA'
    `).get(desde, hasta);

    res.json({
      ok: true,
      data: {
        facturas,
        total_exento: totales.total_exento || 0,
        total_gravado_isv: totales.total_gravado_isv || 0,
        total_gravado_iht: totales.total_gravado_iht || 0,
        total_isv: totales.total_isv || 0,
        total_iht: totales.total_iht || 0,
        total_general: totales.total_general || 0,
      }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── LIBRO DE HUÉSPEDES ──────────────────────────────────────────
router.get('/libro-huespedes', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query);

    const data = db.prepare(`
      SELECT c.fecha_checkin, c.fecha_checkout_real as fecha_checkout,
        h.nombres, h.apellidos, h.numero_doc as numero_documento, h.nacionalidad,
        h.empresa, r.motivo_visita,
        hab.numero AS habitacion_numero, hab.tipo AS tipo_hab,
        r.adultos, r.ninos, r.tarifa_aplicada, r.moneda
      FROM checkins c
      JOIN huespedes h ON c.huesped_id = h.id
      JOIN habitaciones hab ON c.habitacion_id = hab.id
      JOIN reservas r ON c.reserva_id = r.id
      WHERE date(c.fecha_checkin) BETWEEN ? AND ?
      ORDER BY c.fecha_checkin
    `).all(desde, hasta);

    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── OCUPACIÓN ───────────────────────────────────────────────────
router.get('/ocupacion', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query);

    const total_habitaciones = db.prepare('SELECT COUNT(*) as cnt FROM habitaciones WHERE activa = 1').get().cnt;
    const dias_periodo = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1);

    const checkins_periodo = db.prepare(`
      SELECT c.id, c.fecha_checkin, c.fecha_checkout_real, c.fecha_checkout_prevista,
        hab.numero, hab.tipo, hab.piso, hab.id as habitacion_id
      FROM checkins c JOIN habitaciones hab ON c.habitacion_id = hab.id
      WHERE date(c.fecha_checkin) BETWEEN ? AND ?
    `).all(desde, hasta);

    // Noches vendidas: usa el check-out real si ya ocurrió, si no la fecha prevista
    let noches_vendidas = 0;
    const porHabitacion = {};
    checkins_periodo.forEach(c => {
      const salida = c.fecha_checkout_real || c.fecha_checkout_prevista;
      const noches = Math.max(1, Math.round((new Date(salida) - new Date(c.fecha_checkin)) / 86400000));
      noches_vendidas += noches;
      if (!porHabitacion[c.habitacion_id]) {
        porHabitacion[c.habitacion_id] = { numero: c.numero, tipo: c.tipo, piso: c.piso, noches: 0, ingresos: 0 };
      }
      porHabitacion[c.habitacion_id].noches += noches;
    });

    // Ingresos de hospedaje por habitación (vía facturas vinculadas al checkin)
    const ingresosPorCheckin = db.prepare(`
      SELECT checkin_id, SUM(total) as total FROM facturas
      WHERE checkin_id IS NOT NULL AND estado != 'ANULADA' AND date(created_at) BETWEEN ? AND ?
      GROUP BY checkin_id
    `).all(desde, hasta);
    const ingresoPorCheckinMap = Object.fromEntries(ingresosPorCheckin.map(i => [i.checkin_id, i.total]));
    checkins_periodo.forEach(c => {
      const ingreso = ingresoPorCheckinMap[c.id] || 0;
      if (porHabitacion[c.habitacion_id]) porHabitacion[c.habitacion_id].ingresos += ingreso;
    });

    const porcentaje_ocupacion = total_habitaciones > 0
      ? (noches_vendidas / (total_habitaciones * dias_periodo)) * 100
      : 0;

    res.json({
      ok: true,
      data: {
        total_habitaciones,
        total_checkins: checkins_periodo.length,
        noches_vendidas,
        porcentaje_ocupacion,
        por_habitacion: Object.values(porHabitacion).sort((a, b) => b.ingresos - a.ingresos),
      }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── BANCOS: Estado de Cuentas y Movimientos ────────────────────
router.get('/bancos', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query, true);

    const cuentas = db.prepare(`
      SELECT cb.id, cb.numero_cuenta, cb.moneda, cb.saldo_actual, cb.tipo_cuenta,
        b.nombre as banco_nombre,
        COALESCE((SELECT SUM(monto) FROM movimientos_bancarios
          WHERE cuenta_id = cb.id AND tipo IN ('DEPOSITO','INTERES') AND fecha BETWEEN ? AND ?), 0) as depositos_periodo,
        COALESCE((SELECT SUM(monto) FROM movimientos_bancarios
          WHERE cuenta_id = cb.id AND tipo IN ('RETIRO','COMISION','TRANSFERENCIA') AND fecha BETWEEN ? AND ?), 0) as retiros_periodo
      FROM cuentas_bancarias cb
      JOIN bancos b ON cb.banco_id = b.id
      WHERE cb.activa = 1
      ORDER BY b.nombre, cb.numero_cuenta
    `).all(desde, hasta, desde, hasta);

    const movimientos = db.prepare(`
      SELECT m.*, cb.numero_cuenta, b.nombre as banco_nombre
      FROM movimientos_bancarios m
      JOIN cuentas_bancarias cb ON m.cuenta_id = cb.id
      JOIN bancos b ON cb.banco_id = b.id
      WHERE m.fecha BETWEEN ? AND ?
      ORDER BY m.fecha DESC, m.id DESC
    `).all(desde, hasta);

    const saldo_total_hnl = cuentas.filter(c => c.moneda === 'HNL').reduce((s, c) => s + (c.saldo_actual || 0), 0);
    const saldo_total_usd = cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + (c.saldo_actual || 0), 0);
    const total_depositos = movimientos.filter(m => ['DEPOSITO', 'INTERES'].includes(m.tipo)).reduce((s, m) => s + m.monto, 0);
    const total_retiros = movimientos.filter(m => ['RETIRO', 'COMISION', 'TRANSFERENCIA'].includes(m.tipo)).reduce((s, m) => s + m.monto, 0);

    res.json({
      ok: true,
      data: { cuentas, movimientos, saldo_total_hnl, saldo_total_usd, total_depositos, total_retiros }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── CUENTAS POR COBRAR: Antigüedad de Saldos ───────────────────
router.get('/cxc-antiguedad', (req, res) => {
  try {
    const db = getDB();
    const { hasta } = rangoFechas(req.query);

    const cuentas = db.prepare(`
      SELECT cxc.*, c.razon_social as cliente_nombre, f.numero_factura
      FROM cuentas_cobrar cxc
      JOIN clientes_corporativos c ON cxc.cliente_id = c.id
      JOIN facturas f ON cxc.factura_id = f.id
      WHERE cxc.estado != 'PAGADA'
      ORDER BY cxc.fecha_vencimiento ASC
    `).all();

    const refFecha = new Date(hasta);
    const bucket = (fechaVenc) => {
      const dias = Math.floor((refFecha - new Date(fechaVenc)) / 86400000);
      if (dias <= 0) return 'vigente';
      if (dias <= 30) return 'd1_30';
      if (dias <= 60) return 'd31_60';
      if (dias <= 90) return 'd61_90';
      return 'mas_90';
    };

    const detalle = cuentas.map(c => ({ ...c, dias_vencido: Math.floor((refFecha - new Date(c.fecha_vencimiento)) / 86400000), rango: bucket(c.fecha_vencimiento) }));

    const resumen_por_rango = { vigente: 0, d1_30: 0, d31_60: 0, d61_90: 0, mas_90: 0 };
    detalle.forEach(c => { resumen_por_rango[c.rango] += c.saldo_pendiente; });

    res.json({
      ok: true,
      data: { detalle, resumen_por_rango, total_pendiente: detalle.reduce((s, c) => s + c.saldo_pendiente, 0) }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── CUENTAS POR PAGAR: Antigüedad de Saldos ────────────────────
router.get('/cxp-antiguedad', (req, res) => {
  try {
    const db = getDB();
    const { hasta } = rangoFechas(req.query);

    const cuentas = db.prepare(`
      SELECT cxp.*, cxp.descripcion as concepto, p.razon_social as proveedor_nombre
      FROM cuentas_pagar cxp
      JOIN proveedores p ON cxp.proveedor_id = p.id
      WHERE cxp.estado != 'PAGADA'
      ORDER BY cxp.fecha_vencimiento ASC
    `).all();

    const refFecha = new Date(hasta);
    const bucket = (fechaVenc) => {
      if (!fechaVenc) return 'vigente';
      const dias = Math.floor((refFecha - new Date(fechaVenc)) / 86400000);
      if (dias <= 0) return 'vigente';
      if (dias <= 30) return 'd1_30';
      if (dias <= 60) return 'd31_60';
      if (dias <= 90) return 'd61_90';
      return 'mas_90';
    };

    const detalle = cuentas.map(c => ({
      ...c,
      dias_vencido: c.fecha_vencimiento ? Math.floor((refFecha - new Date(c.fecha_vencimiento)) / 86400000) : 0,
      rango: bucket(c.fecha_vencimiento),
    }));

    const resumen_por_rango = { vigente: 0, d1_30: 0, d31_60: 0, d61_90: 0, mas_90: 0 };
    detalle.forEach(c => { resumen_por_rango[c.rango] += c.saldo_pendiente; });

    res.json({
      ok: true,
      data: { detalle, resumen_por_rango, total_pendiente: detalle.reduce((s, c) => s + c.saldo_pendiente, 0) }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── HOTELERO: Ingresos por Tipo de Habitación ──────────────────
router.get('/ingresos-habitacion', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query, true);

    const data = db.prepare(`
      SELECT hab.tipo, COUNT(DISTINCT ck.id) as estadias, SUM(f.total) as ingresos
      FROM facturas f
      JOIN checkins ck ON f.checkin_id = ck.id
      JOIN habitaciones hab ON ck.habitacion_id = hab.id
      WHERE date(f.created_at) BETWEEN ? AND ? AND f.estado != 'ANULADA'
      GROUP BY hab.tipo
      ORDER BY ingresos DESC
    `).all(desde, hasta);

    const conPromedio = data.map(d => ({ ...d, promedio_por_estadia: d.estadias > 0 ? d.ingresos / d.estadias : 0 }));
    const total_ingresos = data.reduce((s, d) => s + (d.ingresos || 0), 0);

    res.json({ ok: true, data: { por_tipo: conPromedio, total_ingresos } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── ADMINISTRACIÓN: Resumen Ejecutivo ──────────────────────────
router.get('/resumen-ejecutivo', (req, res) => {
  try {
    const db = getDB();
    const { desde, hasta } = rangoFechas(req.query, true);

    const ingresos = db.prepare(`
      SELECT SUM(total) as total FROM facturas WHERE date(created_at) BETWEEN ? AND ? AND estado = 'EMITIDA'
    `).get(desde, hasta);

    const movBanco = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo IN ('DEPOSITO','INTERES') THEN monto ELSE 0 END), 0) as depositos,
        COALESCE(SUM(CASE WHEN tipo IN ('RETIRO','COMISION','TRANSFERENCIA') THEN monto ELSE 0 END), 0) as retiros
      FROM movimientos_bancarios WHERE fecha BETWEEN ? AND ?
    `).get(desde, hasta);

    const cxcPendiente = db.prepare(`SELECT COALESCE(SUM(saldo_pendiente),0) as total FROM cuentas_cobrar WHERE estado != 'PAGADA'`).get();
    const cxpPendiente = db.prepare(`SELECT COALESCE(SUM(saldo_pendiente),0) as total FROM cuentas_pagar WHERE estado != 'PAGADA'`).get();

    const saldosBanco = db.prepare(`
      SELECT moneda, COALESCE(SUM(saldo_actual),0) as total FROM cuentas_bancarias WHERE activa = 1 GROUP BY moneda
    `).all();
    const saldo_bancario_hnl = saldosBanco.find(s => s.moneda === 'HNL')?.total || 0;
    const saldo_bancario_usd = saldosBanco.find(s => s.moneda === 'USD')?.total || 0;

    const total_habitaciones = db.prepare('SELECT COUNT(*) as cnt FROM habitaciones WHERE activa = 1').get().cnt;
    const dias_periodo = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1);
    const checkinsPeriodo = db.prepare(`
      SELECT fecha_checkin, fecha_checkout_real, fecha_checkout_prevista FROM checkins
      WHERE date(fecha_checkin) BETWEEN ? AND ?
    `).all(desde, hasta);
    let nochesVendidas = 0;
    checkinsPeriodo.forEach(c => {
      const salida = c.fecha_checkout_real || c.fecha_checkout_prevista;
      nochesVendidas += Math.max(1, Math.round((new Date(salida) - new Date(c.fecha_checkin)) / 86400000));
    });
    const ocupacion_promedio = total_habitaciones > 0 ? (nochesVendidas / (total_habitaciones * dias_periodo)) * 100 : 0;

    res.json({
      ok: true,
      data: {
        ingresos_facturado: ingresos.total || 0,
        depositos_periodo: movBanco.depositos,
        retiros_periodo: movBanco.retiros,
        cxc_pendiente: cxcPendiente.total,
        cxp_pendiente: cxpPendiente.total,
        saldo_bancario_hnl,
        saldo_bancario_usd,
        ocupacion_promedio,
      }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
