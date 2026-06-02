const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare(`
      SELECT cxc.*, f.numero_factura, c.razon_social as cliente_nombre
      FROM cuentas_cobrar cxc
      JOIN facturas f ON cxc.factura_id = f.id
      JOIN clientes_corporativos c ON cxc.cliente_id = c.id
      ORDER BY cxc.fecha_vencimiento ASC
    `).all();
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/:id/abono', (req, res) => {
  try {
    const db = getDB();
    const { monto } = req.body;
    const cxc = db.prepare('SELECT * FROM cuentas_cobrar WHERE id = ?').get(req.params.id);
    if (!cxc) return res.status(404).json({ ok: false, error: 'CxC no encontrada' });
    const nuevo_saldo = Math.max(0, cxc.saldo_pendiente - monto);
    const estado = nuevo_saldo === 0 ? 'PAGADA' : 'PARCIAL';
    db.prepare('UPDATE cuentas_cobrar SET saldo_pendiente=?, estado=? WHERE id=?').run(nuevo_saldo, estado, req.params.id);
    res.json({ ok: true, data: { nuevo_saldo, estado } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
