const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare(`
      SELECT cxc.*, cxc.monto_original as monto_total,
             (cxc.monto_original - cxc.saldo_pendiente) as monto_abonado,
             f.numero_factura, f.created_at as fecha_emision,
             ('Factura ' || f.numero_factura) as concepto,
             c.razon_social as cliente_nombre
      FROM cuentas_cobrar cxc
      JOIN facturas f ON cxc.factura_id = f.id
      JOIN clientes_corporativos c ON cxc.cliente_id = c.id
      ORDER BY cxc.fecha_vencimiento ASC
    `).all();

    const resumen = {
      total_pendiente: data.reduce((s, c) => s + (c.saldo_pendiente || 0), 0),
      total_cuentas: data.filter(c => c.estado !== 'PAGADA').length,
      saldo_vencido: data.filter(c => c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date() && c.estado !== 'PAGADA')
        .reduce((s, c) => s + (c.saldo_pendiente || 0), 0),
    };

    res.json({ ok: true, data, resumen });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/:id/abono', (req, res) => {
  try {
    const db = getDB();
    const { monto, metodo_pago, cuenta_bancaria_id } = req.body;
    if (!monto || monto <= 0) return res.status(400).json({ ok: false, error: 'monto requerido' });
    if (['TARJETA', 'TRANSFERENCIA'].includes(metodo_pago) && !cuenta_bancaria_id) {
      return res.status(400).json({ ok: false, error: 'Seleccioná la cuenta bancaria que recibe el abono' });
    }

    const cxc = db.prepare('SELECT * FROM cuentas_cobrar WHERE id = ?').get(req.params.id);
    if (!cxc) return res.status(404).json({ ok: false, error: 'CxC no encontrada' });
    const nuevo_saldo = Math.max(0, cxc.saldo_pendiente - monto);
    const estado = nuevo_saldo === 0 ? 'PAGADA' : 'PARCIAL';

    const registrarAbono = db.transaction(() => {
      db.prepare('UPDATE cuentas_cobrar SET saldo_pendiente=?, estado=? WHERE id=?').run(nuevo_saldo, estado, req.params.id);

      if (['TARJETA', 'TRANSFERENCIA'].includes(metodo_pago) && cuenta_bancaria_id) {
        db.prepare(`
          INSERT INTO movimientos_bancarios (cuenta_id, tipo, monto, descripcion, referencia, fecha, saldo_despues)
          VALUES (?, 'DEPOSITO', ?, ?, ?, date('now','localtime'),
            (SELECT saldo_actual FROM cuentas_bancarias WHERE id = ?) + ?)
        `).run(cuenta_bancaria_id, monto, `Abono CxC #${cxc.id}`, `CxC-${cxc.id}`, cuenta_bancaria_id, monto);
        db.prepare('UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id = ?').run(monto, cuenta_bancaria_id);
      }
    });
    registrarAbono();

    res.json({ ok: true, data: { nuevo_saldo, estado } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
