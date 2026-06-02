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

// ─── Inicializar BD ──────────────────────────────────────────────
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
