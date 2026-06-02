const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/configuracion
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare('SELECT * FROM configuracion_hotel').all();
    const config = {};
    data.forEach(r => config[r.clave] = r.valor);
    res.json({ ok: true, data: config });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/configuracion
router.put('/', (req, res) => {
  try {
    const db = getDB();
    const update = db.prepare("UPDATE configuracion_hotel SET valor=?, updated_at=datetime('now','localtime') WHERE clave=?");
    const insert = db.prepare('INSERT OR IGNORE INTO configuracion_hotel (clave, valor) VALUES (?,?)');
    Object.entries(req.body).forEach(([k, v]) => {
      insert.run(k, v);
      update.run(v, k);
    });
    res.json({ ok: true, message: 'Configuración guardada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/configuracion/logo - Upload logo as base64
router.post('/logo', (req, res) => {
  try {
    const db = getDB();
    const { logo_base64 } = req.body;
    if (!logo_base64) return res.status(400).json({ ok: false, error: 'logo_base64 requerido' });

    // Validate it's a valid base64 image
    if (!logo_base64.startsWith('data:image/')) {
      return res.status(400).json({ ok: false, error: 'Formato inválido. Debe ser una imagen (PNG, JPG, SVG)' });
    }

    // Max ~500KB base64
    if (logo_base64.length > 700000) {
      return res.status(400).json({ ok: false, error: 'Logo demasiado grande. Máximo 500KB.' });
    }

    const insert = db.prepare('INSERT OR IGNORE INTO configuracion_hotel (clave, valor) VALUES (?,?)');
    const update = db.prepare("UPDATE configuracion_hotel SET valor=?, updated_at=datetime('now','localtime') WHERE clave=?");
    insert.run('hotel_logo', logo_base64);
    update.run(logo_base64, 'hotel_logo');

    res.json({ ok: true, message: 'Logo guardado correctamente' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/configuracion/logo
router.delete('/logo', (req, res) => {
  try {
    const db = getDB();
    db.prepare("UPDATE configuracion_hotel SET valor='' WHERE clave='hotel_logo'").run();
    res.json({ ok: true, message: 'Logo eliminado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
