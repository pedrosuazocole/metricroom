// routes/habitaciones.js - CRUD completo de habitaciones + planning
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/habitaciones - Listar todas con estado actual
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { piso, estado, tipo } = req.query;
    let query = 'SELECT * FROM habitaciones WHERE activa = 1';
    const params = [];

    if (piso) { query += ' AND piso = ?'; params.push(piso); }
    if (estado) { query += ' AND estado = ?'; params.push(estado); }
    if (tipo) { query += ' AND tipo = ?'; params.push(tipo); }
    query += ' ORDER BY piso, numero';

    const habitaciones = db.prepare(query).all(...params);
    res.json({ ok: true, data: habitaciones });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/habitaciones/planning - Vista planning con info de huésped activo
router.get('/planning', (req, res) => {
  try {
    const db = getDB();
    const planning = db.prepare(`
      SELECT 
        h.*,
        c.id AS checkin_id,
        c.fecha_checkin,
        c.fecha_checkout_prevista,
        g.nombres || ' ' || g.apellidos AS huesped_nombre,
        g.telefono AS huesped_tel,
        g.nacionalidad,
        r.motivo_visita,
        g.empresa,
        r.tipo_garantia,
        r.id AS reserva_id,
        COALESCE((
          SELECT SUM(subtotal) FROM servicios_extras se WHERE se.checkin_id = c.id
        ), 0) + COALESCE(r.tarifa_aplicada, 0) * CAST(
          (julianday(COALESCE(c.fecha_checkout_prevista, date('now'))) - julianday(COALESCE(c.fecha_checkin, date('now'))))
          AS INTEGER)
        AS saldo_estimado
      FROM habitaciones h
      LEFT JOIN checkins c ON c.habitacion_id = h.id AND c.estado = 'ACTIVO'
      LEFT JOIN reservas r ON c.reserva_id = r.id
      LEFT JOIN huespedes g ON c.huesped_id = g.id
      WHERE h.activa = 1
      ORDER BY h.piso, h.numero
    `).all();

    // Agrupar por piso
    const porPiso = {};
    planning.forEach(hab => {
      const piso = hab.piso;
      if (!porPiso[piso]) porPiso[piso] = [];
      porPiso[piso].push(hab);
    });

    // Métricas de ocupación
    const total = planning.length;
    const ocupadas = planning.filter(h => h.estado === 'OCUPADA').length;
    const reservadas = planning.filter(h => ['RESERVADA','RESERVADA_GARANTIZADA'].includes(h.estado)).length;
    const disponibles = planning.filter(h => h.estado === 'DISPONIBLE').length;
    const bloqueadas = planning.filter(h => h.estado === 'BLOQUEADA').length;
    const sucias = planning.filter(h => h.estado === 'SUCIA').length;

    res.json({
      ok: true,
      data: {
        pisos: porPiso,
        metricas: {
          total, ocupadas, reservadas, disponibles, bloqueadas, sucias,
          porcentaje_ocupacion: total > 0 ? Math.round((ocupadas / total) * 100) : 0,
        }
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/habitaciones/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const hab = db.prepare('SELECT * FROM habitaciones WHERE id = ?').get(req.params.id);
    if (!hab) return res.status(404).json({ ok: false, error: 'Habitación no encontrada' });
    res.json({ ok: true, data: hab });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/habitaciones
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { numero, piso, tipo, capacidad, precio_base, precio_corporativo, descripcion, amenidades } = req.body;

    // Validaciones
    if (!numero || !piso || !tipo || !precio_base) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos: numero, piso, tipo, precio_base' });
    }
    const existe = db.prepare('SELECT id FROM habitaciones WHERE numero = ?').get(numero);
    if (existe) return res.status(409).json({ ok: false, error: `La habitación ${numero} ya existe` });

    const result = db.prepare(`
      INSERT INTO habitaciones (numero, piso, tipo, capacidad, precio_base, precio_corporativo, descripcion, amenidades)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(numero, piso, tipo, capacidad || 2, precio_base, precio_corporativo, descripcion, 
           amenidades ? JSON.stringify(amenidades) : null);

    res.status(201).json({ ok: true, data: { id: result.lastInsertRowid }, message: 'Habitación creada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT /api/habitaciones/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { numero, piso, tipo, capacidad, precio_base, precio_corporativo, descripcion, amenidades, activa } = req.body;

    const result = db.prepare(`
      UPDATE habitaciones SET
        numero = COALESCE(?, numero),
        piso = COALESCE(?, piso),
        tipo = COALESCE(?, tipo),
        capacidad = COALESCE(?, capacidad),
        precio_base = COALESCE(?, precio_base),
        precio_corporativo = COALESCE(?, precio_corporativo),
        descripcion = COALESCE(?, descripcion),
        amenidades = COALESCE(?, amenidades),
        activa = COALESCE(?, activa),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(numero, piso, tipo, capacidad, precio_base, precio_corporativo, descripcion,
           amenidades ? JSON.stringify(amenidades) : undefined, activa, req.params.id);

    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Habitación no encontrada' });
    res.json({ ok: true, message: 'Habitación actualizada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/habitaciones/:id/estado - Cambiar estado manualmente
router.patch('/:id/estado', (req, res) => {
  try {
    const db = getDB();
    const { estado } = req.body;
    const estadosValidos = ['DISPONIBLE','OCUPADA','RESERVADA','BLOQUEADA','SUCIA','RESERVADA_GARANTIZADA'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido' });
    }

    db.prepare('UPDATE habitaciones SET estado = ?, updated_at = datetime('now','localtime') WHERE id = ?')
      .run(estado, req.params.id);

    res.json({ ok: true, message: `Estado cambiado a ${estado}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
