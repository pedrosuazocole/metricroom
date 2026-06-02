const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare(`
      SELECT cxp.*, p.razon_social as proveedor_nombre
      FROM cuentas_pagar cxp
      JOIN proveedores p ON cxp.proveedor_id = p.id
      ORDER BY cxp.fecha_vencimiento ASC
    `).all();
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { proveedor_id, descripcion, numero_factura_proveedor, monto, fecha_vencimiento } = req.body;
    if (!proveedor_id || !monto) return res.status(400).json({ ok: false, error: 'proveedor_id y monto requeridos' });
    const r = db.prepare('INSERT INTO cuentas_pagar (proveedor_id,descripcion,numero_factura_proveedor,monto,saldo_pendiente,fecha_vencimiento) VALUES (?,?,?,?,?,?)').run(proveedor_id,descripcion,numero_factura_proveedor,monto,monto,fecha_vencimiento);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
