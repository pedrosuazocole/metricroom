// routes/tasa_cambio.js - Tasa de cambio USD/HNL
// La "Tasa de Venta" es la tasa oficial usada en todo el sistema para convertir
// USD -> HNL en reservas y facturas (es la tasa a la que el hotel le "vende" lempiras
// al cliente cuando cobra en USD). La "Tasa de Compra" es solo referencial.
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/tasa-cambio/actual - Última tasa registrada
router.get('/actual', (req, res) => {
  try {
    const db = getDB();
    const tasa = db.prepare('SELECT * FROM tasa_cambio ORDER BY fecha DESC, id DESC LIMIT 1').get();
    res.json({ ok: true, data: tasa });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/tasa-cambio - Registrar nueva tasa del día
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { tasa_compra, tasa_venta, observaciones } = req.body;

    const compra = parseFloat(tasa_compra);
    const venta = parseFloat(tasa_venta);

    if (!tasa_compra || isNaN(compra) || compra <= 0) {
      return res.status(400).json({ ok: false, error: 'Tasa de compra inválida' });
    }
    if (!tasa_venta || isNaN(venta) || venta <= 0) {
      return res.status(400).json({ ok: false, error: 'Tasa de venta inválida' });
    }

    const r = db.prepare(`
      INSERT INTO tasa_cambio (fecha, tasa_compra, tasa_venta, observaciones)
      VALUES (date('now'), ?, ?, ?)
    `).run(compra, venta, observaciones || null);

    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid, tasa_compra: compra, tasa_venta: venta } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/tasa-cambio/historial - Últimas 30 tasas registradas
router.get('/historial', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare('SELECT * FROM tasa_cambio ORDER BY fecha DESC, id DESC LIMIT 30').all();
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
