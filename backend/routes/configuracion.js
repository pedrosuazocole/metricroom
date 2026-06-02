const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare('SELECT * FROM configuracion_hotel').all();
    const config = {};
    data.forEach(r => config[r.clave] = r.valor);
    res.json({ ok: true, data: config });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/', (req, res) => {
  try {
    const db = getDB();
    const update = db.prepare('UPDATE configuracion_hotel SET valor=?, updated_at=datetime('now','localtime') WHERE clave=?');
    const insert = db.prepare('INSERT OR IGNORE INTO configuracion_hotel (clave, valor) VALUES (?,?)');
    Object.entries(req.body).forEach(([k, v]) => {
      insert.run(k, v);
      update.run(v, k);
    });
    res.json({ ok: true, message: 'Configuración guardada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
