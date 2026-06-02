const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/caja/turno-activo
router.get('/turno-activo', (req, res) => {
  try {
    const db = getDB();
    const turno = db.prepare(
      "SELECT * FROM caja_turnos WHERE estado = 'ABIERTO' ORDER BY id DESC LIMIT 1"
    ).get();
    res.json({ ok: true, data: turno });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/caja/abrir
router.post('/abrir', (req, res) => {
  try {
    const db = getDB();
    const { usuario, monto_apertura } = req.body;
    const abierto = db.prepare("SELECT id FROM caja_turnos WHERE estado = 'ABIERTO'").get();
    if (abierto) return res.status(409).json({ ok: false, error: 'Ya hay un turno de caja abierto' });
    const r = db.prepare(
      `INSERT INTO caja_turnos (usuario, fecha_apertura, monto_apertura, estado)
       VALUES (?, datetime('now','localtime'), ?, 'ABIERTO')`
    ).run(usuario, monto_apertura || 0);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/caja/:id/cerrar
router.post('/:id/cerrar', (req, res) => {
  try {
    const db = getDB();
    const { monto_cierre, observaciones } = req.body;
    const turno = db.prepare('SELECT * FROM caja_turnos WHERE id = ?').get(req.params.id);
    if (!turno || turno.estado === 'CERRADO') {
      return res.status(400).json({ ok: false, error: 'Turno inválido o ya cerrado' });
    }

    // Calcular totales del turno
    const totales = db.prepare(`
      SELECT metodo_pago, SUM(total) as total
      FROM facturas
      WHERE datetime(created_at) >= ? AND estado = 'EMITIDA'
      GROUP BY metodo_pago
    `).all(turno.fecha_apertura);

    const efs  = totales.find(t => t.metodo_pago === 'EFECTIVO')?.total || 0;
    const tar  = totales.find(t => t.metodo_pago === 'TARJETA')?.total || 0;
    const tra  = totales.find(t => t.metodo_pago === 'TRANSFERENCIA')?.total || 0;
    const cred = totales.find(t => t.metodo_pago === 'CREDITO')?.total || 0;

    db.prepare(`
      UPDATE caja_turnos
      SET estado = 'CERRADO',
          fecha_cierre = datetime('now','localtime'),
          monto_cierre = ?,
          total_efectivo = ?,
          total_tarjeta = ?,
          total_transferencia = ?,
          total_credito = ?,
          observaciones = ?
      WHERE id = ?
    `).run(monto_cierre || 0, efs, tar, tra, cred, observaciones, req.params.id);

    res.json({ ok: true, data: { total_efectivo: efs, total_tarjeta: tar, total_transferencia: tra, total_credito: cred } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
