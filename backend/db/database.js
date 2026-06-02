// db/database.js - Inicialización y esquema completo de MetricRoom
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ruta persistente para Railway: usar variable de entorno o ruta local
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'metricroom.db');

// Garantizar que el directorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDB() {
  if (!db) {
    // Si DB_RESET=true en variables Railway, borrar la BD y recrear limpia
    if (process.env.DB_RESET === 'true' && fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('BD reseteada por DB_RESET=true');
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF');
    initSchema();
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- =============================================
    -- TABLA: habitaciones
    -- =============================================
    CREATE TABLE IF NOT EXISTS habitaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      piso INTEGER NOT NULL DEFAULT 1,
      tipo TEXT NOT NULL CHECK(tipo IN ('SENCILLA','DOBLE','SUITE','EJECUTIVA','FAMILIAR')),
      capacidad INTEGER NOT NULL DEFAULT 2,
      estado TEXT NOT NULL DEFAULT 'DISPONIBLE' 
        CHECK(estado IN ('DISPONIBLE','OCUPADA','RESERVADA','BLOQUEADA','SUCIA','RESERVADA_GARANTIZADA')),
      precio_base REAL NOT NULL DEFAULT 0,
      precio_corporativo REAL,
      descripcion TEXT,
      amenidades TEXT, -- JSON array
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: huespedes
    -- =============================================
    CREATE TABLE IF NOT EXISTS huespedes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      tipo_doc TEXT NOT NULL CHECK(tipo_doc IN ('CEDULA','PASAPORTE','RTN','CARNET_RESIDENTE')),
      numero_doc TEXT NOT NULL,
      rtn TEXT,
      email TEXT,
      telefono TEXT,
      telefono2 TEXT,
      nacionalidad TEXT DEFAULT 'Hondureña',
      fecha_nacimiento TEXT,
      empresa TEXT,
      cargo TEXT,
      direccion TEXT,
      ciudad TEXT,
      pais TEXT DEFAULT 'Honduras',
      observaciones TEXT,
      vip INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: reservas
    -- =============================================
    CREATE TABLE IF NOT EXISTS reservas (
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

    -- =============================================
    -- TABLA: checkins (registro operativo)
    -- =============================================
    CREATE TABLE IF NOT EXISTS checkins (
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

    -- =============================================
    -- TABLA: servicios_extras
    -- =============================================
    CREATE TABLE IF NOT EXISTS servicios_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      categoria TEXT DEFAULT 'SERVICIO' 
        CHECK(categoria IN ('MINIBAR','RESTAURANTE','LAVANDERIA','TELEFONO','TRANSPORTE','OTROS','SERVICIO')),
      fecha TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (checkin_id) REFERENCES checkins(id)
    );

    -- =============================================
    -- TABLA: configuracion_sar (CAI y rangos fiscales)
    -- =============================================
    CREATE TABLE IF NOT EXISTS configuracion_sar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cai TEXT NOT NULL,
      rango_inicial TEXT NOT NULL,
      rango_final TEXT NOT NULL,
      fecha_limite_emision TEXT NOT NULL,
      correlativo_actual INTEGER NOT NULL DEFAULT 1,
      establecimiento TEXT DEFAULT '001',
      punto_emision TEXT DEFAULT '001',
      tipo_documento TEXT DEFAULT '01',
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: facturas
    -- =============================================
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura TEXT NOT NULL UNIQUE,
      cai TEXT NOT NULL,
      checkin_id INTEGER,
      reserva_id INTEGER,
      huesped_id INTEGER NOT NULL,
      cliente_nombre TEXT NOT NULL,
      cliente_rtn TEXT,
      cliente_direccion TEXT,
      moneda TEXT DEFAULT 'HNL',
      tasa_cambio REAL DEFAULT 1,
      subtotal_exento REAL DEFAULT 0,
      subtotal_gravado_isv REAL DEFAULT 0,
      subtotal_gravado_iht REAL DEFAULT 0,
      isv_15 REAL DEFAULT 0,
      iht_4 REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      total REAL NOT NULL,
      estado TEXT DEFAULT 'EMITIDA' CHECK(estado IN ('EMITIDA','ANULADA','CREDITO')),
      metodo_pago TEXT CHECK(metodo_pago IN ('EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO','MIXTO')),
      observaciones TEXT,
      impresa INTEGER DEFAULT 0,
      enviada_email INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (checkin_id) REFERENCES checkins(id),
      FOREIGN KEY (huesped_id) REFERENCES huespedes(id)
    );

    -- =============================================
    -- TABLA: detalle_facturas
    -- =============================================
    CREATE TABLE IF NOT EXISTS detalle_facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      tipo_impuesto TEXT DEFAULT 'ISV' CHECK(tipo_impuesto IN ('ISV','IHT','EXENTO')),
      subtotal REAL NOT NULL,
      FOREIGN KEY (factura_id) REFERENCES facturas(id)
    );

    -- =============================================
    -- TABLA: tasa_cambio
    -- =============================================
    CREATE TABLE IF NOT EXISTS tasa_cambio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      usd_a_hnl REAL NOT NULL,
      fuente TEXT DEFAULT 'MANUAL',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: clientes_corporativos
    -- =============================================
    CREATE TABLE IF NOT EXISTS clientes_corporativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      rtn TEXT NOT NULL UNIQUE,
      contacto_nombre TEXT,
      contacto_telefono TEXT,
      contacto_email TEXT,
      direccion TEXT,
      limite_credito REAL DEFAULT 0,
      saldo_actual REAL DEFAULT 0,
      dias_credito INTEGER DEFAULT 30,
      descuento_habitaciones REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: proveedores
    -- =============================================
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      rtn TEXT,
      contacto TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      categoria TEXT,
      condiciones_pago TEXT,
      dias_credito INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: cuentas_cobrar
    -- =============================================
    CREATE TABLE IF NOT EXISTS cuentas_cobrar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      monto_original REAL NOT NULL,
      saldo_pendiente REAL NOT NULL,
      fecha_vencimiento TEXT,
      estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','PARCIAL','PAGADA','VENCIDA')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (factura_id) REFERENCES facturas(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes_corporativos(id)
    );

    -- =============================================
    -- TABLA: cuentas_pagar
    -- =============================================
    CREATE TABLE IF NOT EXISTS cuentas_pagar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      numero_factura_proveedor TEXT,
      monto REAL NOT NULL,
      saldo_pendiente REAL NOT NULL,
      fecha_vencimiento TEXT,
      estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','PARCIAL','PAGADA','VENCIDA')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    );

    -- =============================================
    -- TABLA: inventario
    -- =============================================
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL CHECK(categoria IN ('AMENIDADES','ROPA_CAMA','ALIMENTOS','BEBIDAS','LIMPIEZA','MANTENIMIENTO','OTROS')),
      unidad_medida TEXT DEFAULT 'UNIDAD',
      stock_actual REAL DEFAULT 0,
      stock_minimo REAL DEFAULT 0,
      precio_costo REAL DEFAULT 0,
      proveedor_id INTEGER,
      ubicacion TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    );

    -- =============================================
    -- TABLA: movimientos_inventario
    -- =============================================
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('ENTRADA','SALIDA','AJUSTE')),
      cantidad REAL NOT NULL,
      motivo TEXT,
      referencia TEXT,
      usuario TEXT,
      fecha TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (inventario_id) REFERENCES inventario(id)
    );

    -- =============================================
    -- TABLA: tarifas_temporadas
    -- =============================================
    CREATE TABLE IF NOT EXISTS tarifas_temporadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('ALTA','BAJA','FIN_SEMANA','CORPORATIVA','ESPECIAL')),
      fecha_inicio TEXT,
      fecha_fin TEXT,
      multiplicador REAL DEFAULT 1.0,
      aplica_domingo INTEGER DEFAULT 1,
      aplica_lunes INTEGER DEFAULT 1,
      aplica_martes INTEGER DEFAULT 1,
      aplica_miercoles INTEGER DEFAULT 1,
      aplica_jueves INTEGER DEFAULT 1,
      aplica_viernes INTEGER DEFAULT 1,
      aplica_sabado INTEGER DEFAULT 1,
      activa INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: notificaciones_log
    -- =============================================
    CREATE TABLE IF NOT EXISTS notificaciones_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT,
      destinatario TEXT,
      mensaje TEXT,
      canal TEXT DEFAULT 'WHATSAPP',
      estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','ENVIADO','ERROR')),
      respuesta TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: configuracion_hotel
    -- =============================================
    CREATE TABLE IF NOT EXISTS configuracion_hotel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      valor TEXT,
      descripcion TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: usuarios
    -- =============================================
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT DEFAULT 'RECEPCION' CHECK(rol IN ('ADMIN','GERENTE','RECEPCION','AMA_LLAVES','CONTABILIDAD')),
      email TEXT,
      activo INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: caja_turnos
    -- =============================================
    CREATE TABLE IF NOT EXISTS caja_turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      fecha_apertura TEXT NOT NULL,
      fecha_cierre TEXT,
      monto_apertura REAL DEFAULT 0,
      monto_cierre REAL,
      total_efectivo REAL DEFAULT 0,
      total_tarjeta REAL DEFAULT 0,
      total_transferencia REAL DEFAULT 0,
      total_credito REAL DEFAULT 0,
      estado TEXT DEFAULT 'ABIERTO' CHECK(estado IN ('ABIERTO','CERRADO')),
      observaciones TEXT
    );
  `);

  // Insertar datos iniciales si no existen
  seedInitialData();
}

function seedInitialData() {
  // Configuración del hotel por defecto
  const configs = [
    ['hotel_nombre', 'Hotel MetricRoom', 'Nombre del hotel'],
    ['hotel_rtn', '08011985123456', 'RTN del hotel'],
    ['hotel_direccion', 'Col. Palmira, Tegucigalpa, Honduras', 'Dirección fiscal'],
    ['hotel_telefono', '+504 2234-5678', 'Teléfono principal'],
    ['hotel_email', 'info@metricroom.hn', 'Email del hotel'],
    ['isv_porcentaje', '15', 'Porcentaje ISV'],
    ['iht_porcentaje', '4', 'Porcentaje IHT turístico'],
    ['callmebot_api_key', '', 'API Key de CallMeBot WhatsApp'],
    ['moneda_principal', 'HNL', 'Moneda principal del sistema'],
    ['vista_previa_impresion', '1', '1=siempre vista previa, 0=impresión directa'],
    ['impresion_copias_default', '1', 'Número de copias por defecto'],
  ];

  const insertConfig = db.prepare(
    'INSERT OR IGNORE INTO configuracion_hotel (clave, valor, descripcion) VALUES (?, ?, ?)'
  );
  configs.forEach(([clave, valor, desc]) => insertConfig.run(clave, valor, desc));

  // Usuario admin por defecto
  const adminExists = db.prepare('SELECT id FROM usuarios WHERE username = ?').get('admin');
  if (!adminExists) {
    // Password: admin123 (en producción usar bcrypt)
    db.prepare(
      'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)'
    ).run('admin', 'admin123', 'Administrador', 'ADMIN');
  }

  // Habitaciones de muestra (3 pisos, varios tipos)
  const habExiste = db.prepare('SELECT id FROM habitaciones LIMIT 1').get();
  if (!habExiste) {
    const tiposHab = [
      { piso: 1, nums: ['101','102','103','104'], tipo: 'SENCILLA', precio: 800 },
      { piso: 1, nums: ['105','106'], tipo: 'DOBLE', precio: 1200 },
      { piso: 2, nums: ['201','202','203','204'], tipo: 'DOBLE', precio: 1400 },
      { piso: 2, nums: ['205','206'], tipo: 'EJECUTIVA', precio: 2000 },
      { piso: 3, nums: ['301','302'], tipo: 'SUITE', precio: 3500 },
      { piso: 3, nums: ['303'], tipo: 'FAMILIAR', precio: 2800 },
    ];
    const insertHab = db.prepare(
      'INSERT OR IGNORE INTO habitaciones (numero, piso, tipo, precio_base, estado) VALUES (?, ?, ?, ?, ?)'
    );
    tiposHab.forEach(({ piso, nums, tipo, precio }) => {
      nums.forEach(num => insertHab.run(num, piso, tipo, precio, 'DISPONIBLE'));
    });
  }

  // Tasa de cambio inicial
  const tasaExiste = db.prepare('SELECT id FROM tasa_cambio LIMIT 1').get();
  if (!tasaExiste) {
    db.prepare('INSERT INTO tasa_cambio (fecha, usd_a_hnl) VALUES (date('now'), ?)').run(24.85);
  }

  // Temporada por defecto
  const tempExiste = db.prepare('SELECT id FROM tarifas_temporadas LIMIT 1').get();
  if (!tempExiste) {
    db.prepare(
      'INSERT INTO tarifas_temporadas (nombre, tipo, multiplicador) VALUES (?, ?, ?)'
    ).run('Tarifa Estándar', 'BAJA', 1.0);
  }
}

module.exports = { getDB };
