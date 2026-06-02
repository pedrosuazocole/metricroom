const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/actual', (req, res) => {
  try {
    const db = getDB();
    const tasa = db.prepare('SELECT * FROM tasa_cambio ORDER BY fecha DESC, id DESC LIMIT 1').get();
    res.json({ ok: true, data: tasa });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { usd_a_hnl, fuente } = req.body;
    if (!usd_a_hnl || usd_a_hnl <= 0) return res.status(400).json({ ok: false, error: 'Tasa inválida' });
    const r = db.prepare('INSERT INTO tasa_cambio (fecha, usd_a_hnl, fuente) VALUES (date('now'), ?, ?)').run(usd_a_hnl, fuente || 'MANUAL');
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid, usd_a_hnl } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/historial', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare('SELECT * FROM tasa_cambio ORDER BY fecha DESC LIMIT 30').all();
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
