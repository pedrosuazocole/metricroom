// routes/usuarios.js - CRUD de usuarios del sistema MetricRoom
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

const ROLES = ['ADMIN', 'GERENTE', 'RECEPCION', 'AMA_LLAVES', 'CONTABILIDAD'];

// GET /api/usuarios
router.get('/', (req, res) => {
  try {
    const db = getDB();
    // Nunca devolver el password_hash
    const usuarios = db.prepare(
      'SELECT id, username, nombre, rol, email, activo, last_login, created_at FROM usuarios ORDER BY nombre'
    ).all();
    res.json({ ok: true, data: usuarios });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/usuarios/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const u = db.prepare(
      'SELECT id, username, nombre, rol, email, activo, last_login, created_at FROM usuarios WHERE id = ?'
    ).get(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, data: u });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/usuarios
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { username, password, nombre, rol, email } = req.body;

    if (!username || !password || !nombre || !rol) {
      return res.status(400).json({ ok: false, error: 'username, password, nombre y rol son requeridos' });
    }
    if (!ROLES.includes(rol)) {
      return res.status(400).json({ ok: false, error: `Rol inválido. Debe ser uno de: ${ROLES.join(', ')}` });
    }
    if (username.length < 3) {
      return res.status(400).json({ ok: false, error: 'El username debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existe = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username);
    if (existe) return res.status(409).json({ ok: false, error: `El usuario "${username}" ya existe` });

    const r = db.prepare(
      'INSERT INTO usuarios (username, password_hash, nombre, rol, email) VALUES (?, ?, ?, ?, ?)'
    ).run(username, password, nombre, rol, email || null);

    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid }, message: 'Usuario creado exitosamente' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/usuarios/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { nombre, rol, email, activo } = req.body;

    if (rol && !ROLES.includes(rol)) {
      return res.status(400).json({ ok: false, error: `Rol inválido. Debe ser uno de: ${ROLES.join(', ')}` });
    }

    db.prepare(`
      UPDATE usuarios SET
        nombre = COALESCE(?, nombre),
        rol = COALESCE(?, rol),
        email = COALESCE(?, email),
        activo = COALESCE(?, activo)
      WHERE id = ?
    `).run(nombre, rol, email, activo, req.params.id);

    res.json({ ok: true, message: 'Usuario actualizado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/usuarios/:id/password - Cambiar contraseña
router.patch('/:id/password', (req, res) => {
  try {
    const db = getDB();
    const { password_actual, password_nuevo } = req.body;

    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ ok: false, error: 'password_actual y password_nuevo son requeridos' });
    }
    if (password_nuevo.length < 6) {
      return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (user.password_hash !== password_actual) {
      return res.status(401).json({ ok: false, error: 'La contraseña actual es incorrecta' });
    }

    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(password_nuevo, req.params.id);
    res.json({ ok: true, message: 'Contraseña actualizada exitosamente' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/usuarios/:id/toggle - Activar/desactivar usuario
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT id, username, activo FROM usuarios WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (user.username === 'admin') {
      return res.status(403).json({ ok: false, error: 'No se puede desactivar el usuario admin' });
    }
    const nuevoEstado = user.activo ? 0 : 1;
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(nuevoEstado, user.id);
    res.json({ ok: true, data: { activo: nuevoEstado }, message: nuevoEstado ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
