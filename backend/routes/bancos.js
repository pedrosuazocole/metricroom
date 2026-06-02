// routes/bancos.js - Gestión de bancos, cuentas bancarias y movimientos
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// ─── BANCOS ──────────────────────────────────────────────────────

// GET /api/bancos
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const bancos = db.prepare('SELECT * FROM bancos WHERE activo = 1 ORDER BY nombre').all();
    res.json({ ok: true, data: bancos });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/bancos
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { nombre, codigo, tipo, pais } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, error: 'El nombre del banco es requerido' });
    const existe = db.prepare('SELECT id FROM bancos WHERE nombre = ?').get(nombre);
    if (existe) return res.status(409).json({ ok: false, error: 'Ya existe un banco con ese nombre' });
    const r = db.prepare('INSERT INTO bancos (nombre, codigo, tipo, pais) VALUES (?, ?, ?, ?)').run(nombre, codigo, tipo || 'NACIONAL', pais || 'Honduras');
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid }, message: 'Banco creado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/bancos/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { nombre, codigo, tipo, pais, activo } = req.body;
    db.prepare(`UPDATE bancos SET nombre=COALESCE(?,nombre), codigo=COALESCE(?,codigo),
      tipo=COALESCE(?,tipo), pais=COALESCE(?,pais), activo=COALESCE(?,activo) WHERE id=?`)
      .run(nombre, codigo, tipo, pais, activo, req.params.id);
    res.json({ ok: true, message: 'Banco actualizado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/bancos/:id (desactivar)
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    db.prepare('UPDATE bancos SET activo = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, message: 'Banco desactivado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── CUENTAS BANCARIAS ───────────────────────────────────────────

// GET /api/bancos/cuentas
router.get('/cuentas', (req, res) => {
  try {
    const db = getDB();
    const cuentas = db.prepare(`
      SELECT cb.*, b.nombre AS banco_nombre, b.codigo AS banco_codigo
      FROM cuentas_bancarias cb
      JOIN bancos b ON cb.banco_id = b.id
      WHERE cb.activa = 1
      ORDER BY b.nombre, cb.numero_cuenta
    `).all();
    // Totales por moneda
    const totalHNL = cuentas.filter(c => c.moneda === 'HNL').reduce((s, c) => s + (c.saldo_actual || 0), 0);
    const totalUSD = cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + (c.saldo_actual || 0), 0);
    res.json({ ok: true, data: cuentas, resumen: { totalHNL, totalUSD, total_cuentas: cuentas.length } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/bancos/cuentas
router.post('/cuentas', (req, res) => {
  try {
    const db = getDB();
    const { banco_id, numero_cuenta, tipo_cuenta, moneda, nombre_titular, rtn_titular, saldo_inicial, descripcion } = req.body;
    if (!banco_id || !numero_cuenta || !nombre_titular) {
      return res.status(400).json({ ok: false, error: 'banco_id, numero_cuenta y nombre_titular son requeridos' });
    }
    const saldo = parseFloat(saldo_inicial) || 0;
    const r = db.prepare(`
      INSERT INTO cuentas_bancarias (banco_id, numero_cuenta, tipo_cuenta, moneda, nombre_titular, rtn_titular, saldo_inicial, saldo_actual, descripcion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(banco_id, numero_cuenta, tipo_cuenta || 'CORRIENTE', moneda || 'HNL', nombre_titular, rtn_titular, saldo, saldo, descripcion);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid }, message: 'Cuenta creada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/bancos/cuentas/:id
router.put('/cuentas/:id', (req, res) => {
  try {
    const db = getDB();
    const { numero_cuenta, tipo_cuenta, moneda, nombre_titular, rtn_titular, descripcion, activa } = req.body;
    db.prepare(`UPDATE cuentas_bancarias SET
      numero_cuenta=COALESCE(?,numero_cuenta), tipo_cuenta=COALESCE(?,tipo_cuenta),
      moneda=COALESCE(?,moneda), nombre_titular=COALESCE(?,nombre_titular),
      rtn_titular=COALESCE(?,rtn_titular), descripcion=COALESCE(?,descripcion),
      activa=COALESCE(?,activa) WHERE id=?`)
      .run(numero_cuenta, tipo_cuenta, moneda, nombre_titular, rtn_titular, descripcion, activa, req.params.id);
    res.json({ ok: true, message: 'Cuenta actualizada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── MOVIMIENTOS BANCARIOS ───────────────────────────────────────

// GET /api/bancos/cuentas/:id/movimientos
router.get('/cuentas/:id/movimientos', (req, res) => {
  try {
    const db = getDB();
    const { limit = 50 } = req.query;
    const movs = db.prepare(`
      SELECT * FROM movimientos_bancarios
      WHERE cuenta_id = ?
      ORDER BY fecha DESC, created_at DESC
      LIMIT ?
    `).all(req.params.id, parseInt(limit));
    res.json({ ok: true, data: movs });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/bancos/cuentas/:id/movimientos
router.post('/cuentas/:id/movimientos', (req, res) => {
  try {
    const db = getDB();
    const { tipo, monto, descripcion, referencia, fecha } = req.body;
    if (!tipo || !monto || !descripcion) {
      return res.status(400).json({ ok: false, error: 'tipo, monto y descripcion son requeridos' });
    }
    const cuenta = db.prepare('SELECT * FROM cuentas_bancarias WHERE id = ?').get(req.params.id);
    if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });

    const montoParsed = parseFloat(monto);
    let nuevoSaldo = cuenta.saldo_actual;

    if (['DEPOSITO', 'INTERES'].includes(tipo)) {
      nuevoSaldo += montoParsed;
    } else if (['RETIRO', 'COMISION', 'TRANSFERENCIA'].includes(tipo)) {
      nuevoSaldo -= montoParsed;
    } else {
      nuevoSaldo = montoParsed; // AJUSTE: valor absoluto
    }

    // Transacción atómica
    const registrar = db.transaction(() => {
      db.prepare(`
        INSERT INTO movimientos_bancarios (cuenta_id, tipo, monto, descripcion, referencia, fecha, saldo_despues)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.params.id, tipo, montoParsed, descripcion, referencia, fecha || new Date().toISOString().split('T')[0], nuevoSaldo);

      db.prepare('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ?').run(nuevoSaldo, req.params.id);
    });
    registrar();

    res.status(201).json({ ok: true, data: { nuevo_saldo: nuevoSaldo }, message: 'Movimiento registrado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
