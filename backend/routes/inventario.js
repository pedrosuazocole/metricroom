const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { categoria, alerta } = req.query;
    let q = 'SELECT i.*, p.razon_social as proveedor_nombre FROM inventario i LEFT JOIN proveedores p ON i.proveedor_id = p.id WHERE i.activo = 1';
    const params = [];
    if (categoria) { q += ' AND i.categoria = ?'; params.push(categoria); }
    if (alerta === '1') q += ' AND i.stock_actual <= i.stock_minimo';
    q += ' ORDER BY i.nombre';
    res.json({ ok: true, data: db.prepare(q).all(...params) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { codigo, nombre, categoria, unidad_medida, stock_actual, stock_minimo, precio_costo, proveedor_id, ubicacion } = req.body;
    if (!nombre || !categoria) return res.status(400).json({ ok: false, error: 'nombre y categoria requeridos' });
    const r = db.prepare('INSERT INTO inventario (codigo,nombre,categoria,unidad_medida,stock_actual,stock_minimo,precio_costo,proveedor_id,ubicacion) VALUES (?,?,?,?,?,?,?,?,?)').run(codigo,nombre,categoria,unidad_medida||'UNIDAD',stock_actual||0,stock_minimo||0,precio_costo||0,proveedor_id,ubicacion);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/:id/movimiento', (req, res) => {
  try {
    const db = getDB();
    const { tipo, cantidad, motivo, referencia, usuario } = req.body;
    if (!tipo || !cantidad) return res.status(400).json({ ok: false, error: 'tipo y cantidad requeridos' });
    const mov = db.transaction(() => {
      db.prepare('INSERT INTO movimientos_inventario (inventario_id,tipo,cantidad,motivo,referencia,usuario) VALUES (?,?,?,?,?,?)').run(req.params.id,tipo,cantidad,motivo,referencia,usuario);
      const delta = tipo === 'ENTRADA' ? cantidad : tipo === 'SALIDA' ? -cantidad : cantidad;
      db.prepare('UPDATE inventario SET stock_actual = stock_actual + ? WHERE id = ?').run(delta, req.params.id);
    });
    mov();
    res.json({ ok: true, message: 'Movimiento registrado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
