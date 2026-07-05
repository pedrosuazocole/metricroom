const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const data = db.prepare(`
      SELECT cxp.*, cxp.descripcion as concepto, cxp.monto as monto_total,
             p.razon_social as proveedor_nombre
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
    // Acepta tanto descripcion/monto (nombres de columna) como concepto/monto_total (nombres del formulario)
    const { proveedor_id, descripcion, concepto, numero_factura_proveedor, monto, monto_total, fecha_vencimiento, observaciones } = req.body;
    const desc = descripcion ?? concepto;
    const montoFinal = monto ?? monto_total;
    if (!proveedor_id || !montoFinal) return res.status(400).json({ ok: false, error: 'proveedor_id y monto requeridos' });
    const r = db.prepare('INSERT INTO cuentas_pagar (proveedor_id,descripcion,numero_factura_proveedor,monto,saldo_pendiente,fecha_vencimiento) VALUES (?,?,?,?,?,?)')
      .run(proveedor_id, desc, numero_factura_proveedor, montoFinal, montoFinal, fecha_vencimiento);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.patch('/:id/pagar', (req, res) => {
  try {
    const db = getDB();
    const { metodo_pago, cuenta_bancaria_id } = req.body;
    const cxp = db.prepare('SELECT * FROM cuentas_pagar WHERE id = ?').get(req.params.id);
    if (!cxp) return res.status(404).json({ ok: false, error: 'Cuenta por pagar no encontrada' });

    // Transferencia (pago a proveedor desde el banco) requiere elegir de qué
    // cuenta sale el dinero, para poder registrar el retiro correspondiente.
    if (metodo_pago === 'TRANSFERENCIA' && !cuenta_bancaria_id) {
      return res.status(400).json({ ok: false, error: 'Seleccioná la cuenta bancaria desde la que se paga' });
    }

    const pagar = db.transaction(() => {
      db.prepare("UPDATE cuentas_pagar SET saldo_pendiente = 0, estado = 'PAGADA', metodo_pago = ?, cuenta_bancaria_id = ? WHERE id = ?")
        .run(metodo_pago || null, cuenta_bancaria_id || null, req.params.id);

      if (metodo_pago === 'TRANSFERENCIA' && cuenta_bancaria_id) {
        db.prepare(`
          INSERT INTO movimientos_bancarios (cuenta_id, tipo, monto, descripcion, referencia, fecha, saldo_despues)
          VALUES (?, 'RETIRO', ?, ?, ?, date('now','localtime'),
            (SELECT saldo_actual FROM cuentas_bancarias WHERE id = ?) - ?)
        `).run(cuenta_bancaria_id, cxp.saldo_pendiente, `Pago a proveedor: ${cxp.descripcion}`, `CxP-${cxp.id}`, cuenta_bancaria_id, cxp.saldo_pendiente);
        db.prepare('UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id = ?').run(cxp.saldo_pendiente, cuenta_bancaria_id);
      }
    });
    pagar();

    res.json({ ok: true, message: 'Cuenta marcada como pagada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
