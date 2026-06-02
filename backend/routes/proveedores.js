const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    res.json({ ok: true, data: db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY razon_social').all() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { razon_social, rtn, contacto, telefono, email, direccion, categoria, condiciones_pago, dias_credito } = req.body;
    if (!razon_social) return res.status(400).json({ ok: false, error: 'razon_social requerido' });
    const r = db.prepare('INSERT INTO proveedores (razon_social,rtn,contacto,telefono,email,direccion,categoria,condiciones_pago,dias_credito) VALUES (?,?,?,?,?,?,?,?,?)').run(razon_social,rtn,contacto,telefono,email,direccion,categoria,condiciones_pago,dias_credito||0);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
