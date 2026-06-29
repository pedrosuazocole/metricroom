// routes/tipos_habitacion.js - Catálogo de tipos de habitación + tarifas con descuento
// Cada tipo tiene: precio Normal, y 3 tarifas con descuento (10%, 15%, 20%).
// Los descuentos se calculan automáticamente al crear/editar el precio Normal,
// pero quedan en columnas editables porque el % real negociado no siempre es exacto.
const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

function calcularDescuentos(precioNormal) {
  const base = parseFloat(precioNormal) || 0;
  return {
    precio_10: Math.round(base * 0.90 * 100) / 100,
    precio_15: Math.round(base * 0.85 * 100) / 100,
    precio_20: Math.round(base * 0.80 * 100) / 100,
  };
}

// GET /api/tipos-habitacion - Listar todos (activos por defecto)
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { incluir_inactivos } = req.query;
    const tipos = incluir_inactivos
      ? db.prepare('SELECT * FROM tipos_habitacion ORDER BY nombre').all()
      : db.prepare('SELECT * FROM tipos_habitacion WHERE activo = 1 ORDER BY nombre').all();
    res.json({ ok: true, data: tipos });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/tipos-habitacion - Crear nuevo tipo
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { nombre, capacidad_sugerida, precio_sugerido, precio_10, precio_15, precio_20, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, error: 'El nombre del tipo es requerido' });
    }
    const existe = db.prepare('SELECT id FROM tipos_habitacion WHERE nombre = ?').get(nombre.trim());
    if (existe) {
      return res.status(409).json({ ok: false, error: 'Ya existe un tipo de habitación con ese nombre' });
    }

    // Si no se especifican los descuentos, se calculan automáticamente del precio normal
    const auto = calcularDescuentos(precio_sugerido);
    const p10 = precio_10 !== undefined && precio_10 !== '' ? precio_10 : auto.precio_10;
    const p15 = precio_15 !== undefined && precio_15 !== '' ? precio_15 : auto.precio_15;
    const p20 = precio_20 !== undefined && precio_20 !== '' ? precio_20 : auto.precio_20;

    const r = db.prepare(`
      INSERT INTO tipos_habitacion (nombre, capacidad_sugerida, precio_sugerido, precio_10, precio_15, precio_20, descripcion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre.trim(), capacidad_sugerida || 2, precio_sugerido || 0, p10, p15, p20, descripcion || null);

    res.status(201).json({ ok: true, data: { id: r.lastInsertRowid }, message: 'Tipo de habitación creado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/tipos-habitacion/:id - Editar tipo existente
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const { nombre, capacidad_sugerida, precio_sugerido, precio_10, precio_15, precio_20, descripcion, activo } = req.body;

    const actual = db.prepare('SELECT * FROM tipos_habitacion WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ ok: false, error: 'Tipo no encontrado' });

    const nombreNuevo = nombre?.trim() || actual.nombre;
    if (nombreNuevo !== actual.nombre) {
      const duplicado = db.prepare('SELECT id FROM tipos_habitacion WHERE nombre = ? AND id != ?').get(nombreNuevo, req.params.id);
      if (duplicado) return res.status(409).json({ ok: false, error: 'Ya existe otro tipo con ese nombre' });
    }

    const precioFinal = precio_sugerido !== undefined && precio_sugerido !== '' ? precio_sugerido : actual.precio_sugerido;
    // Si solo cambió el precio normal y no se tocaron los descuentos, recalcularlos
    const auto = calcularDescuentos(precioFinal);
    const p10 = precio_10 !== undefined && precio_10 !== '' ? precio_10 : auto.precio_10;
    const p15 = precio_15 !== undefined && precio_15 !== '' ? precio_15 : auto.precio_15;
    const p20 = precio_20 !== undefined && precio_20 !== '' ? precio_20 : auto.precio_20;

    const actualizar = db.transaction(() => {
      db.prepare(`
        UPDATE tipos_habitacion
        SET nombre = ?, capacidad_sugerida = COALESCE(?, capacidad_sugerida),
            precio_sugerido = ?, precio_10 = ?, precio_15 = ?, precio_20 = ?,
            descripcion = ?, activo = COALESCE(?, activo)
        WHERE id = ?
      `).run(nombreNuevo, capacidad_sugerida, precioFinal, p10, p15, p20, descripcion, activo, req.params.id);

      if (nombreNuevo !== actual.nombre) {
        db.prepare('UPDATE habitaciones SET tipo = ? WHERE tipo = ?').run(nombreNuevo, actual.nombre);
      }
    });
    actualizar();

    res.json({ ok: true, message: 'Tipo de habitación actualizado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/tipos-habitacion/:id/toggle - Activar/desactivar
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDB();
    const tipo = db.prepare('SELECT * FROM tipos_habitacion WHERE id = ?').get(req.params.id);
    if (!tipo) return res.status(404).json({ ok: false, error: 'Tipo no encontrado' });

    const enUso = db.prepare('SELECT COUNT(*) as cnt FROM habitaciones WHERE tipo = ? AND activa = 1').get(tipo.nombre);
    if (tipo.activo && enUso.cnt > 0) {
      return res.status(409).json({ ok: false, error: `No se puede desactivar: ${enUso.cnt} habitación(es) usan este tipo` });
    }

    db.prepare('UPDATE tipos_habitacion SET activo = ? WHERE id = ?').run(tipo.activo ? 0 : 1, req.params.id);
    res.json({ ok: true, message: tipo.activo ? 'Tipo desactivado' : 'Tipo activado' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────
// Tarifas negociadas por cliente corporativo (ej: "Visión Mundial")
// ─────────────────────────────────────────────────────────────────

// GET /api/tipos-habitacion/tarifas-cliente/:cliente_id - Ver tarifas de un cliente
router.get('/tarifas-cliente/:cliente_id', (req, res) => {
  try {
    const db = getDB();
    const tarifas = db.prepare(`
      SELECT tc.*, th.nombre AS tipo_nombre, th.precio_sugerido AS tipo_precio_normal
      FROM tarifas_cliente_corporativo tc
      JOIN tipos_habitacion th ON tc.tipo_habitacion_id = th.id
      WHERE tc.cliente_corporativo_id = ?
      ORDER BY th.nombre
    `).all(req.params.cliente_id);
    res.json({ ok: true, data: tarifas });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/tipos-habitacion/tarifas-cliente/:cliente_id - Guardar/actualizar tarifas de un cliente
// Body: { tarifas: [{ tipo_habitacion_id, precio }] }
router.put('/tarifas-cliente/:cliente_id', (req, res) => {
  try {
    const db = getDB();
    const { tarifas } = req.body;
    if (!Array.isArray(tarifas)) {
      return res.status(400).json({ ok: false, error: 'tarifas debe ser un arreglo' });
    }

    const cliente = db.prepare('SELECT id FROM clientes_corporativos WHERE id = ?').get(req.params.cliente_id);
    if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente corporativo no encontrado' });

    const upsert = db.transaction(() => {
      tarifas.forEach(({ tipo_habitacion_id, precio }) => {
        if (!tipo_habitacion_id || precio === undefined || precio === '') return;
        db.prepare(`
          INSERT INTO tarifas_cliente_corporativo (cliente_corporativo_id, tipo_habitacion_id, precio)
          VALUES (?, ?, ?)
          ON CONFLICT(cliente_corporativo_id, tipo_habitacion_id) DO UPDATE SET precio = excluded.precio
        `).run(req.params.cliente_id, tipo_habitacion_id, parseFloat(precio));
      });
    });
    upsert();

    res.json({ ok: true, message: 'Tarifas del cliente actualizadas' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/tipos-habitacion/tarifas-cliente/:cliente_id/:tipo_id - Quitar tarifa especial de un tipo
router.delete('/tarifas-cliente/:cliente_id/:tipo_id', (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM tarifas_cliente_corporativo WHERE cliente_corporativo_id = ? AND tipo_habitacion_id = ?')
      .run(req.params.cliente_id, req.params.tipo_id);
    res.json({ ok: true, message: 'Tarifa especial eliminada' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
