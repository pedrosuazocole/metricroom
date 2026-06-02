const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    res.json({ ok: true, data: db.prepare('SELECT * FROM clientes_corporativos WHERE activo = 1 ORDER BY razon_social').all() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { razon_social, rtn, contacto_nombre, contacto_telefono, contacto_email, direccion, limite_credito, dias_credito, descuento_habitaciones } = req.body;
    if (!razon_social || !rtn) return res.status(400).json({ ok: false, error: 'razon_social y rtn requeridos' });
    const r = db.prepare('INSERT INTO clientes_corporativos (razon_social,rtn,contacto_nombre,contacto_telefono,contacto_email,direccion,limite_credito,dias_credito,descuento_habitaciones) VALUES (?,?,?,?,?,?,?,?,?)').run(razon_social,rtn,contacto_nombre,contacto_telefono,contacto_email,direccion,limite_credito||0,dias_credito||30,descuento_habitaciones||0);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { razon_social, contacto_nombre, contacto_telefono, contacto_email, direccion, limite_credito, dias_credito, descuento_habitaciones, activo } = req.body;
    db.prepare('UPDATE clientes_corporativos SET razon_social=COALESCE(?,razon_social),contacto_nombre=COALESCE(?,contacto_nombre),contacto_telefono=COALESCE(?,contacto_telefono),contacto_email=COALESCE(?,contacto_email),direccion=COALESCE(?,direccion),limite_credito=COALESCE(?,limite_credito),dias_credito=COALESCE(?,dias_credito),descuento_habitaciones=COALESCE(?,descuento_habitaciones),activo=COALESCE(?,activo) WHERE id=?').run(razon_social,contacto_nombre,contacto_telefono,contacto_email,direccion,limite_credito,dias_credito,descuento_habitaciones,activo,req.params.id);
    res.json({ ok: true, message: 'Cliente actualizado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
