// routes/reportes.js - Reportes operativos y financieros
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// Cierre de caja diario
router.get('/cierre-caja', (req, res) => {
  try {
    const db = getDB();
    const { fecha } = req.query;
    const dia = fecha || new Date().toISOString().split('T')[0];
    const ventas = db.prepare(`
      SELECT metodo_pago, SUM(total) as total_metodo, COUNT(*) as cantidad
      FROM facturas WHERE date(created_at) = ? AND estado = 'EMITIDA'
      GROUP BY metodo_pago
    `).all(dia);
    const totalDia = ventas.reduce((s, v) => s + v.total_metodo, 0);
    const impuestos = db.prepare(`
      SELECT SUM(isv_15) as total_isv, SUM(iht_4) as total_iht, SUM(total) as gran_total
      FROM facturas WHERE date(created_at) = ? AND estado = 'EMITIDA'
    `).get(dia);
    const checkins = db.prepare(`SELECT COUNT(*) as cnt FROM checkins WHERE date(fecha_checkin) = ?`).get(dia);
    const checkouts = db.prepare(`SELECT COUNT(*) as cnt FROM checkins WHERE date(fecha_checkout_real) = ?`).get(dia);
    res.json({ ok: true, data: { fecha: dia, ventas_por_metodo: ventas, total_dia: totalDia, impuestos, checkins: checkins.cnt, checkouts: checkouts.cnt } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Libro de ventas mensual
router.get('/libro-ventas', (req, res) => {
  try {
    const db = getDB();
    const { mes, anio } = req.query;
    const m = mes || (new Date().getMonth() + 1);
    const a = anio || new Date().getFullYear();
    const facturas = db.prepare(`
      SELECT f.*, 
        (SELECT nombres || ' ' || apellidos FROM huespedes WHERE id = f.huesped_id) AS cliente
      FROM facturas f
      WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
        AND estado != 'ANULADA'
      ORDER BY created_at
    `).all(String(m).padStart(2,'0'), String(a));
    const totales = db.prepare(`
      SELECT SUM(subtotal_gravado_isv) as base_isv, SUM(subtotal_gravado_iht) as base_iht,
        SUM(subtotal_exento) as exento, SUM(isv_15) as isv, SUM(iht_4) as iht, SUM(total) as total
      FROM facturas
      WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ? AND estado != 'ANULADA'
    `).get(String(m).padStart(2,'0'), String(a));
    res.json({ ok: true, data: { mes: m, anio: a, facturas, totales } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Libro de huéspedes
router.get('/libro-huespedes', (req, res) => {
  try {
    const db = getDB();
    const { fecha_desde, fecha_hasta } = req.query;
    const desde = fecha_desde || new Date().toISOString().split('T')[0];
    const hasta = fecha_hasta || desde;
    const data = db.prepare(`
      SELECT c.fecha_checkin, c.fecha_checkout_prevista, c.fecha_checkout_real,
        h.nombres, h.apellidos, h.tipo_doc, h.numero_doc, h.nacionalidad,
        h.empresa, r.motivo_visita,
        hab.numero AS habitacion, hab.tipo AS tipo_hab,
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

// Ocupación por período
router.get('/ocupacion', (req, res) => {
  try {
    const db = getDB();
    const { fecha_desde, fecha_hasta } = req.query;
    const desde = fecha_desde || new Date().toISOString().split('T')[0];
    const hasta = fecha_hasta || desde;
    const total_hab = db.prepare('SELECT COUNT(*) as cnt FROM habitaciones WHERE activa = 1').get().cnt;
    const ocupadas_periodo = db.prepare(`
      SELECT date(c.fecha_checkin) as dia, COUNT(DISTINCT c.habitacion_id) as ocupadas
      FROM checkins c WHERE date(c.fecha_checkin) BETWEEN ? AND ?
      GROUP BY date(c.fecha_checkin)
    `).all(desde, hasta);
    res.json({ ok: true, data: { total_habitaciones: total_hab, ocupacion_por_dia: ocupadas_periodo } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
