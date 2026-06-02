// routes/huespedes.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { q, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM huespedes WHERE 1=1';
    const params = [];
    if (q) {
      query += ' AND (nombres LIKE ? OR apellidos LIKE ? OR numero_doc LIKE ? OR email LIKE ?)';
      const s = `%${q}%`;
      params.push(s, s, s, s);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const data = db.prepare(query).all(...params);
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const h = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(req.params.id);
    if (!h) return res.status(404).json({ ok: false, error: 'Huésped no encontrado' });
    const historial = db.prepare(`
      SELECT r.*, hab.numero FROM reservas r 
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE r.huesped_id = ? ORDER BY r.fecha_entrada DESC
    `).all(req.params.id);
    res.json({ ok: true, data: { ...h, historial } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono, telefono2,
      nacionalidad, fecha_nacimiento, empresa, cargo, direccion, ciudad, pais, observaciones, vip } = req.body;
    if (!nombres || !apellidos || !tipo_doc || !numero_doc) {
      return res.status(400).json({ ok: false, error: 'nombres, apellidos, tipo_doc y numero_doc son requeridos' });
    }
    const r = db.prepare(`
      INSERT INTO huespedes (nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono, telefono2,
        nacionalidad, fecha_nacimiento, empresa, cargo, direccion, ciudad, pais, observaciones, vip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono, telefono2,
           nacionalidad || 'Hondureña', fecha_nacimiento, empresa, cargo, direccion, ciudad,
           pais || 'Honduras', observaciones, vip || 0);
    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { nombres, apellidos, tipo_doc, numero_doc, rtn, email, telefono, telefono2,
      nacionalidad, empresa, cargo, direccion, ciudad, observaciones, vip } = req.body;
    db.prepare(`
      UPDATE huespedes SET nombres=COALESCE(?,nombres), apellidos=COALESCE(?,apellidos),
        tipo_doc=COALESCE(?,tipo_doc), numero_doc=COALESCE(?,numero_doc), rtn=COALESCE(?,rtn),
        email=COALESCE(?,email), telefono=COALESCE(?,telefono), telefono2=COALESCE(?,telefono2),
        nacionalidad=COALESCE(?,nacionalidad), empresa=COALESCE(?,empresa), cargo=COALESCE(?,cargo),
        direccion=COALESCE(?,direccion), ciudad=COALESCE(?,ciudad), observaciones=COALESCE(?,observaciones),
        vip=COALESCE(?,vip), updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(nombres,apellidos,tipo_doc,numero_doc,rtn,email,telefono,telefono2,
           nacionalidad,empresa,cargo,direccion,ciudad,observaciones,vip,req.params.id);
    res.json({ ok: true, message: 'Huésped actualizado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
