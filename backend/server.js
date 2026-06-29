// server.js - Servidor principal MetricRoom
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── TRUST PROXY — obligatorio en Railway/Heroku/cualquier proxy ─
app.set('trust proxy', 1);

// ─── Health check PRIMERO — antes de todo middleware ─────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Endpoint de reparación: recrea el admin si no existe ──────
// Uso: GET /api/repair?secret=metricroom2024
app.get('/api/repair', (req, res) => {
  if (req.query.secret !== 'metricroom2024') {
    return res.status(403).json({ ok: false, error: 'Acceso denegado' });
  }
  try {
    const { getDB } = require('./db/database');
    const db = getDB();
    const existe = db.prepare("SELECT id FROM usuarios WHERE username = 'admin'").get();
    if (!existe) {
      db.prepare("INSERT INTO usuarios (username, password_hash, nombre, rol, activo) VALUES ('admin','admin123','Administrador','ADMIN',1)").run();
      return res.json({ ok: true, message: 'Usuario admin recreado. Contraseña: admin123' });
    }
    // Si existe pero está inactivo, reactivarlo
    db.prepare("UPDATE usuarios SET activo = 1 WHERE username = 'admin'").run();
    return res.json({ ok: true, message: 'Admin ya existía — reactivado si estaba inactivo', id: existe.id });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Diagnóstico: ver el estado real de la tabla habitaciones en producción ──
// Uso: GET /api/diag?secret=metricroom2024
app.get('/api/diag', (req, res) => {
  if (req.query.secret !== 'metricroom2024') {
    return res.status(403).json({ ok: false, error: 'Acceso denegado' });
  }
  try {
    const { getDB } = require('./db/database');
    const fs = require('fs');
    const path = require('path');
    const db = getDB();

    // Verificar qué versión real del archivo reservas.js está corriendo
    const reservasJsPath = path.join(__dirname, 'routes', 'reservas.js');
    const reservasJsStat = fs.statSync(reservasJsPath);
    const reservasJsContent = fs.readFileSync(reservasJsPath, 'utf8');
    const lineasConHabitacionesOld = reservasJsContent
      .split('\n')
      .map((linea, i) => ({ linea: i + 1, texto: linea }))
      .filter(l => l.texto.includes('habitaciones_old'));

    const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
    const habRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='habitaciones'").get();
    const habOldRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='habitaciones_old'").get();
    const reservasRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reservas'").get();
    const tieneCheckViejo = habRow && /CHECK\s*\(\s*tipo\s+IN/i.test(habRow.sql);

    // PRAGMA foreign_key_list es el método confiable (parser nativo SQLite,
    // no depende de coincidencias de texto/formato en el SQL crudo)
    const fkReservas = db.prepare('PRAGMA foreign_key_list(reservas)').all();
    const fkCheckins = db.prepare('PRAGMA foreign_key_list(checkins)').all();

    // Buscar CUALQUIER objeto (índice, trigger, vista) que mencione habitaciones_old
    const objetosSospechosos = db.prepare(`
      SELECT type, name, tbl_name, sql FROM sqlite_master
      WHERE sql LIKE '%habitaciones_old%'
    `).all();

    // Probar en vivo el UPDATE exacto que usa el endpoint de reservas, para
    // ver si SQLite tira el error ahí mismo (sin afectar datos reales: rollback)
    let pruebaUpdate = null;
    try {
      const testTx = db.transaction(() => {
        db.prepare(`UPDATE habitaciones SET estado = 'RESERVADA' WHERE id = -999`).run();
        throw new Error('ROLLBACK_INTENCIONAL'); // siempre revertir, es solo una prueba
      });
      testTx();
    } catch (e) {
      pruebaUpdate = e.message === 'ROLLBACK_INTENCIONAL' ? 'OK — el UPDATE no tira error' : `FALLÓ: ${e.message}`;
    }

    // Prueba real: ejecutar el INSERT INTO reservas exacto (mismo texto SQL
    // que reservas.js línea ~196), con rollback garantizado para no afectar datos.
    // Usa el primer huésped/habitación reales que existan (no IDs inventados,
    // para no confundir una violación de FK válida con el bug que buscamos).
    let pruebaInsertReserva = null;
    try {
      const huespedReal = db.prepare('SELECT id FROM huespedes LIMIT 1').get();
      const habitacionReal = db.prepare('SELECT id FROM habitaciones LIMIT 1').get();
      if (!huespedReal || !habitacionReal) {
        pruebaInsertReserva = 'SKIP — no hay huéspedes u habitaciones para probar';
      } else {
        const testTx2 = db.transaction(() => {
          db.prepare(`
            INSERT INTO reservas (
              codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida, noches,
              adultos, ninos, tipo_garantia, monto_deposito, motivo_visita, empresa,
              cliente_corporativo_id, tarifa_aplicada, moneda, tasa_cambio, total_estimado,
              notas, origen, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA')
          `).run(
            'DIAG-TEST-' + Date.now(), huespedReal.id, habitacionReal.id, '2026-01-01', '2026-01-02', 1,
            1, 0, 'EFECTIVO', 0, 'TURISMO',
            null, null, 100, 'HNL', 1, 100,
            null, 'MOSTRADOR'
          );
          throw new Error('ROLLBACK_INTENCIONAL');
        });
        testTx2();
      }
    } catch (e) {
      if (e.message !== 'ROLLBACK_INTENCIONAL' && pruebaInsertReserva === null) {
        pruebaInsertReserva = `FALLÓ: ${e.message}`;
      } else if (pruebaInsertReserva === null) {
        pruebaInsertReserva = 'OK — el INSERT no tira error';
      }
    }

    res.json({
      ok: true,
      data: {
        tablas,
        habitaciones_existe: !!habRow,
        habitaciones_old_existe: !!habOldRow,
        habitaciones_tiene_check_viejo: !!tieneCheckViejo,
        habitaciones_sql: habRow?.sql,
        habitaciones_old_sql: habOldRow?.sql,
        reservas_sql: reservasRow?.sql,
        reservas_fk_apunta_a_habitaciones_old: reservasRow && /REFERENCES\s+habitaciones_old/i.test(reservasRow.sql),
        fk_reservas_pragma: fkReservas,
        fk_checkins_pragma: fkCheckins,
        objetos_que_mencionan_habitaciones_old: objetosSospechosos,
        prueba_update_habitaciones: pruebaUpdate,
        // Verificación de versión del archivo realmente desplegado
        reservas_js_modificado: reservasJsStat.mtime,
        reservas_js_tamano_bytes: reservasJsStat.size,
        reservas_js_lineas_con_habitaciones_old: lineasConHabitacionesOld,
        // Prueba real: ejecutar el INSERT exacto que usa POST /api/reservas
        prueba_insert_reserva_real: pruebaInsertReserva,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Reparación manual y forzada de la tabla habitaciones ──
// Uso: GET /api/repair-habitaciones?secret=metricroom2024
// Limpia cualquier habitaciones_old residual y, si "habitaciones" sigue con el
// CHECK viejo, la reconstruye de forma atómica preservando todos los datos.
app.get('/api/repair-habitaciones', (req, res) => {
  if (req.query.secret !== 'metricroom2024') {
    return res.status(403).json({ ok: false, error: 'Acceso denegado' });
  }
  try {
    const { getDB } = require('./db/database');
    const db = getDB();

    const tablaExiste = (nombre) =>
      !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nombre);

    const habRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='habitaciones'").get();
    const tieneCheckViejo = habRow && /CHECK\s*\(\s*tipo\s+IN/i.test(habRow.sql);
    const oldExistia = tablaExiste('habitaciones_old');

    if (!tieneCheckViejo && oldExistia) {
      db.exec('DROP TABLE habitaciones_old;');
      return res.json({ ok: true, message: 'habitaciones ya estaba migrada. Se limpió habitaciones_old residual.' });
    }

    if (tieneCheckViejo) {
      if (oldExistia) db.exec('DROP TABLE habitaciones_old;');

      const migrar = db.transaction(() => {
        db.exec('ALTER TABLE habitaciones RENAME TO habitaciones_old;');
        db.exec(`
          CREATE TABLE habitaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT NOT NULL UNIQUE,
            piso INTEGER NOT NULL DEFAULT 1,
            tipo TEXT NOT NULL,
            capacidad INTEGER NOT NULL DEFAULT 2,
            estado TEXT NOT NULL DEFAULT 'DISPONIBLE'
              CHECK(estado IN ('DISPONIBLE','OCUPADA','RESERVADA','BLOQUEADA','SUCIA','RESERVADA_GARANTIZADA')),
            precio_base REAL NOT NULL DEFAULT 0,
            precio_corporativo REAL,
            descripcion TEXT,
            amenidades TEXT,
            activa INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
          );
        `);
        db.exec(`
          INSERT INTO habitaciones (id, numero, piso, tipo, capacidad, estado, precio_base, precio_corporativo, descripcion, amenidades, activa, created_at, updated_at)
          SELECT id, numero, piso, tipo, capacidad, estado, precio_base, precio_corporativo, descripcion, amenidades, activa, created_at, updated_at
          FROM habitaciones_old;
        `);
        db.exec('DROP TABLE habitaciones_old;');
      });
      migrar();

      const total = db.prepare('SELECT COUNT(*) as cnt FROM habitaciones').get().cnt;
      return res.json({ ok: true, message: `Tabla habitaciones reconstruida correctamente. ${total} habitación(es) preservadas.` });
    }

    return res.json({ ok: true, message: 'habitaciones ya está en el esquema correcto. No se necesitó ninguna acción.' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Reparación de FK fosilizada en reservas/checkins ──
// Uso: GET /api/repair-fk?secret=metricroom2024
// Repara directamente reservas/checkins si su FOREIGN KEY quedó apuntando
// a "habitaciones_old" (detectado vía PRAGMA foreign_key_list, confiable).
app.get('/api/repair-fk', (req, res) => {
  if (req.query.secret !== 'metricroom2024') {
    return res.status(403).json({ ok: false, error: 'Acceso denegado' });
  }
  try {
    const { getDB } = require('./db/database');
    const db = getDB();
    const resultados = {};

    const fkFosilizada = (tabla) => {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tabla)) return false;
      const fks = db.prepare(`PRAGMA foreign_key_list(${tabla})`).all();
      return fks.some(fk => fk.table === 'habitaciones_old');
    };

    resultados.reservas_antes = db.prepare('PRAGMA foreign_key_list(reservas)').all();
    resultados.checkins_antes = db.prepare('PRAGMA foreign_key_list(checkins)').all();

    if (fkFosilizada('reservas')) {
      const cols = db.prepare('PRAGMA table_info(reservas)').all().map(c => c.name);
      const colsComunes = cols.filter(c =>
        ['id','codigo','huesped_id','habitacion_id','fecha_entrada','fecha_salida','noches',
         'adultos','ninos','estado','tipo_garantia','monto_deposito','motivo_visita','empresa',
         'cliente_corporativo_id','tarifa_aplicada','moneda','tasa_cambio','total_estimado',
         'notas','origen','created_by','created_at','updated_at'].includes(c)
      ).join(', ');

      const migrar = db.transaction(() => {
        db.exec('ALTER TABLE reservas RENAME TO reservas_fix_old;');
        db.exec(`
          CREATE TABLE reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            huesped_id INTEGER NOT NULL,
            habitacion_id INTEGER NOT NULL,
            fecha_entrada TEXT NOT NULL,
            fecha_salida TEXT NOT NULL,
            noches INTEGER NOT NULL,
            adultos INTEGER DEFAULT 1,
            ninos INTEGER DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'PENDIENTE'
              CHECK(estado IN ('PENDIENTE','CONFIRMADA','GARANTIZADA','CHECKIN','CHECKOUT','CANCELADA','NO_SHOW')),
            tipo_garantia TEXT CHECK(tipo_garantia IN ('EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO_EMPRESA','VOUCHER')),
            monto_deposito REAL DEFAULT 0,
            motivo_visita TEXT CHECK(motivo_visita IN ('TURISMO','NEGOCIOS','EVENTOS','FAMILIAR','OTRO')),
            empresa TEXT,
            cliente_corporativo_id INTEGER,
            tarifa_aplicada REAL NOT NULL,
            moneda TEXT DEFAULT 'HNL' CHECK(moneda IN ('HNL','USD')),
            tasa_cambio REAL DEFAULT 1,
            total_estimado REAL,
            notas TEXT,
            origen TEXT DEFAULT 'MOSTRADOR' CHECK(origen IN ('MOSTRADOR','ONLINE','TELEFONO','AGENCIA','CORPORATIVO')),
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
            FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
          );
        `);
        db.exec(`INSERT INTO reservas (${colsComunes}) SELECT ${colsComunes} FROM reservas_fix_old;`);
        db.exec('DROP TABLE reservas_fix_old;');
      });
      migrar();
      resultados.reservas_reparada = true;
    } else {
      resultados.reservas_reparada = 'no_necesitaba';
    }

    if (fkFosilizada('checkins')) {
      const cols = db.prepare('PRAGMA table_info(checkins)').all().map(c => c.name);
      const colsComunes = cols.filter(c =>
        ['id','reserva_id','huesped_id','habitacion_id','fecha_checkin','fecha_checkout_real',
         'fecha_checkout_prevista','estado','observaciones','atendido_por','created_at'].includes(c)
      ).join(', ');

      const migrar = db.transaction(() => {
        db.exec('ALTER TABLE checkins RENAME TO checkins_fix_old;');
        db.exec(`
          CREATE TABLE checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reserva_id INTEGER NOT NULL,
            huesped_id INTEGER NOT NULL,
            habitacion_id INTEGER NOT NULL,
            fecha_checkin TEXT NOT NULL,
            fecha_checkout_real TEXT,
            fecha_checkout_prevista TEXT NOT NULL,
            estado TEXT DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO','CHECKOUT','CANCELADO')),
            observaciones TEXT,
            atendido_por TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (reserva_id) REFERENCES reservas(id),
            FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
            FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
          );
        `);
        db.exec(`INSERT INTO checkins (${colsComunes}) SELECT ${colsComunes} FROM checkins_fix_old;`);
        db.exec('DROP TABLE checkins_fix_old;');
      });
      migrar();
      resultados.checkins_reparada = true;
    } else {
      resultados.checkins_reparada = 'no_necesitaba';
    }

    resultados.reservas_despues = db.prepare('PRAGMA foreign_key_list(reservas)').all();
    resultados.checkins_despues = db.prepare('PRAGMA foreign_key_list(checkins)').all();
    resultados.total_reservas = db.prepare('SELECT COUNT(*) as cnt FROM reservas').get().cnt;

    return res.json({ ok: true, data: resultados });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, stack: e.stack });
  }
});


try {
  const { getDB } = require('./db/database');
  getDB();
  console.log('✅ Base de datos inicializada');
} catch (err) {
  console.error('❌ Error BD:', err.message);
}

// ─── Rutas ──────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const habitacionesRoutes = require('./routes/habitaciones');
const tiposHabitacionRoutes = require('./routes/tipos_habitacion');
const huespedesRoutes    = require('./routes/huespedes');
const reservasRoutes     = require('./routes/reservas');
const checkinsRoutes     = require('./routes/checkins');
const facturasRoutes     = require('./routes/facturas');
const reportesRoutes     = require('./routes/reportes');
const inventarioRoutes   = require('./routes/inventario');
const clientesRoutes     = require('./routes/clientes');
const proveedoresRoutes  = require('./routes/proveedores');
const cxcRoutes          = require('./routes/cuentas_cobrar');
const cxpRoutes          = require('./routes/cuentas_pagar');
const configRoutes       = require('./routes/configuracion');
const cajaRoutes         = require('./routes/caja');
const tasaRoutes         = require('./routes/tasa_cambio');
const bancosRoutes       = require('./routes/bancos');
const usuariosRoutes     = require('./routes/usuarios');

// ─── Middleware ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — DESPUÉS del health check y CON trust proxy activo
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Montar rutas API ────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/habitaciones',   habitacionesRoutes);
app.use('/api/tipos-habitacion', tiposHabitacionRoutes);
app.use('/api/huespedes',      huespedesRoutes);
app.use('/api/reservas',       reservasRoutes);
app.use('/api/checkins',       checkinsRoutes);
app.use('/api/facturas',       facturasRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/inventario',     inventarioRoutes);
app.use('/api/clientes',       clientesRoutes);
app.use('/api/proveedores',    proveedoresRoutes);
app.use('/api/cuentas-cobrar', cxcRoutes);
app.use('/api/cuentas-pagar',  cxpRoutes);
app.use('/api/configuracion',  configRoutes);
app.use('/api/caja',           cajaRoutes);
app.use('/api/tasa-cambio',    tasaRoutes);
app.use('/api/bancos',         bancosRoutes);
app.use('/api/usuarios',       usuariosRoutes);

// ─── Servir frontend ─────────────────────────────────────────────
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏨 MetricRoom en puerto ${PORT}`);
  console.log(`📂 BD: ${process.env.DATABASE_PATH || './data/metricroom.db'}`);
});
