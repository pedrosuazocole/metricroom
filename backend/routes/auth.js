// routes/auth.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.post('/login', (req, res) => {
  try {
    const db = getDB();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });
    }

    const user = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1').get(username);
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }

    // Actualizar último login con fecha en JS (evita problemas de funciones SQL)
    const ahora = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare('UPDATE usuarios SET last_login = ? WHERE id = ?').run(ahora, user.id);

    const { password_hash, ...userSafe } = user;
    res.json({ ok: true, data: userSafe, message: 'Sesión iniciada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/me', (req, res) => {
  res.json({ ok: true, data: { message: 'ok' } });
});

module.exports = router;
