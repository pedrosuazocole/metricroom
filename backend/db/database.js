// db/database.js - Inicialización y esquema completo de MetricRoom
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ruta persistente para Railway: usar variable de entorno o ruta local
const DB_PATH = process.env.DATABASE_PATH || '/data/metricroom.db';

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
      tipo TEXT NOT NULL,
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
    -- TABLA: tipos_habitacion (catálogo configurable)
    -- =============================================
    CREATE TABLE IF NOT EXISTS tipos_habitacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      capacidad_sugerida INTEGER NOT NULL DEFAULT 2,
      precio_sugerido REAL NOT NULL DEFAULT 0,
      -- Tarifas con descuento. Se calculan automáticamente desde precio_sugerido
      -- pero quedan como columnas editables porque el descuento real no siempre
      -- es un porcentaje exacto (ej: 1,757.48 no es exactamente 10% de 1,952.75)
      precio_10 REAL,
      precio_15 REAL,
      precio_20 REAL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- =============================================
    -- TABLA: tarifas_cliente_corporativo
    -- Tarifa especial negociada de un cliente corporativo, por tipo de habitación
    -- (ej: "Visión Mundial" paga L.1,875.00 en Sencilla Std en vez de la tarifa normal)
    -- =============================================
    CREATE TABLE IF NOT EXISTS tarifas_cliente_corporativo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_corporativo_id INTEGER NOT NULL,
      tipo_habitacion_id INTEGER NOT NULL,
      precio REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cliente_corporativo_id) REFERENCES clientes_corporativos(id),
      FOREIGN KEY (tipo_habitacion_id) REFERENCES tipos_habitacion(id),
      UNIQUE(cliente_corporativo_id, tipo_habitacion_id)
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
      exento_isv INTEGER DEFAULT 0,
      registro_exonerado TEXT,
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
      aplica_isv INTEGER DEFAULT 0,
      aplica_iht INTEGER DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (factura_id) REFERENCES facturas(id)
    );

    -- =============================================
    -- TABLA: tasa_cambio
    -- =============================================
    CREATE TABLE IF NOT EXISTS tasa_cambio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tasa_compra REAL NOT NULL,
      tasa_venta REAL NOT NULL,
      observaciones TEXT,
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

  // Migrar tablas con esquema viejo (de versiones anteriores ya desplegadas)
  // Envuelto en try/catch: si una migración puntual falla, no debe tumbar
  // todo el arranque del servidor — el resto del sistema sigue funcionando
  // y el problema se puede diagnosticar/reparar vía /api/diag y /api/repair-*.
  try {
    migrarEsquemaViejo();
  } catch (err) {
    console.error('⚠️  Error durante migrarEsquemaViejo():', err.message);
    console.error('   El servidor continúa arrancando. Usá /api/diag para revisar el estado.');
  }

  // Insertar datos iniciales si no existen
  seedInitialData();
}

function columnaExiste(db, tabla, columna) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
  return cols.some(c => c.name === columna);
}

function migrarEsquemaViejo() {
  // Usa la variable de módulo `db` (la instancia ya está abierta en initSchema)
  // Cada migración corre en su propio try/catch: si una falla, las demás
  // igual se ejecutan y el problema queda aislado a esa tabla puntual.

  // ── Migración: tasa_cambio (usd_a_hnl -> tasa_compra + tasa_venta) ──
  try {
    if (columnaExiste(db, 'tasa_cambio', 'usd_a_hnl') && !columnaExiste(db, 'tasa_cambio', 'tasa_compra')) {
      console.log('🔧 Migrando tabla tasa_cambio al esquema nuevo...');
      db.exec(`
        ALTER TABLE tasa_cambio RENAME TO tasa_cambio_old;
        CREATE TABLE tasa_cambio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          tasa_compra REAL NOT NULL,
          tasa_venta REAL NOT NULL,
          observaciones TEXT,
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );
      `);
      // Migrar datos viejos: usábamos un solo valor (usd_a_hnl) para ambos campos
      const viejos = db.prepare('SELECT * FROM tasa_cambio_old').all();
      const insertar = db.prepare(`
        INSERT INTO tasa_cambio (fecha, tasa_compra, tasa_venta, observaciones, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      viejos.forEach(v => {
        insertar.run(v.fecha, v.usd_a_hnl, v.usd_a_hnl, v.fuente || null, v.created_at);
      });
      db.exec('DROP TABLE tasa_cambio_old;');
      console.log(`✅ Migradas ${viejos.length} tasa(s) de cambio al esquema nuevo`);
    }
  } catch (err) {
    console.error('⚠️  Migración tasa_cambio falló:', err.message);
  }

  // ── Migración: detalle_facturas (tipo_impuesto -> aplica_isv + aplica_iht) ──
  try {
    if (columnaExiste(db, 'detalle_facturas', 'tipo_impuesto') && !columnaExiste(db, 'detalle_facturas', 'aplica_isv')) {
      console.log('🔧 Migrando tabla detalle_facturas al esquema nuevo...');
      db.exec(`ALTER TABLE detalle_facturas ADD COLUMN aplica_isv INTEGER DEFAULT 0;`);
      db.exec(`ALTER TABLE detalle_facturas ADD COLUMN aplica_iht INTEGER DEFAULT 0;`);
      db.exec(`UPDATE detalle_facturas SET aplica_isv = 1 WHERE tipo_impuesto = 'ISV';`);
      db.exec(`UPDATE detalle_facturas SET aplica_iht = 1 WHERE tipo_impuesto = 'IHT';`);
      console.log('✅ detalle_facturas migrada');
    }
  } catch (err) {
    console.error('⚠️  Migración detalle_facturas falló:', err.message);
  }

  // ── Migración: huespedes (agregar exento_isv si falta) ──
  try {
    if (!columnaExiste(db, 'huespedes', 'exento_isv')) {
      console.log('🔧 Agregando columna exento_isv a huespedes...');
      db.exec(`ALTER TABLE huespedes ADD COLUMN exento_isv INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    console.error('⚠️  Migración huespedes.exento_isv falló:', err.message);
  }

  // ── Migración: tipos_habitacion (agregar columnas de descuento si faltan) ──
  try {
    if (columnaExiste(db, 'tipos_habitacion', 'precio_sugerido') && !columnaExiste(db, 'tipos_habitacion', 'precio_10')) {
      console.log('🔧 Agregando columnas de tarifa con descuento a tipos_habitacion...');
      db.exec(`ALTER TABLE tipos_habitacion ADD COLUMN precio_10 REAL;`);
      db.exec(`ALTER TABLE tipos_habitacion ADD COLUMN precio_15 REAL;`);
      db.exec(`ALTER TABLE tipos_habitacion ADD COLUMN precio_20 REAL;`);
      // Calcular automáticamente los descuentos para los tipos ya existentes
      db.exec(`
        UPDATE tipos_habitacion
        SET precio_10 = ROUND(precio_sugerido * 0.90, 2),
            precio_15 = ROUND(precio_sugerido * 0.85, 2),
            precio_20 = ROUND(precio_sugerido * 0.80, 2)
        WHERE precio_10 IS NULL;
      `);
      console.log('✅ tipos_habitacion migrada con descuentos calculados');
    }
  } catch (err) {
    console.error('⚠️  Migración tipos_habitacion falló:', err.message);
  }

  // ── Migración: reservas (agregar cliente_corporativo_id si falta) ──
  try {
    if (!columnaExiste(db, 'reservas', 'cliente_corporativo_id')) {
      console.log('🔧 Agregando columna cliente_corporativo_id a reservas...');
      db.exec(`ALTER TABLE reservas ADD COLUMN cliente_corporativo_id INTEGER;`);
    }
  } catch (err) {
    console.error('⚠️  Migración reservas.cliente_corporativo_id falló:', err.message);
  }

  // ── Migración: habitaciones (quitar CHECK viejo de tipo fijo) ──
  // SQLite no permite ALTER para quitar un CHECK constraint, así que se reconstruye
  // la tabla completa preservando todos los datos existentes.
  try {
  const tablaExiste = (nombre) =>
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nombre);

  const habitacionesTieneCheckViejo = (() => {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='habitaciones'").get();
    return row && /CHECK\s*\(\s*tipo\s+IN/i.test(row.sql);
  })();

  // Caso A: una corrida anterior se interrumpió a mitad de la migración y dejó
  // "habitaciones_old" huérfana (la tabla "habitaciones" ya quedó migrada, pero
  // el DROP final nunca se ejecutó). Si "habitaciones" ya está bien, solo limpiar.
  if (!habitacionesTieneCheckViejo && tablaExiste('habitaciones_old')) {
    console.log('🧹 Limpiando tabla residual habitaciones_old de una migración interrumpida...');
    db.exec('DROP TABLE habitaciones_old;');
  }

  // Caso B: la migración nunca llegó a completarse y "habitaciones" sigue con
  // el CHECK viejo. Reconstruir de forma atómica (todo o nada) usando una
  // transacción real, para que un corte a mitad de camino no deje basura.
  if (habitacionesTieneCheckViejo) {
    console.log('🔧 Migrando tabla habitaciones para permitir tipos personalizados...');

    // Si ya existe una habitaciones_old residual de un intento previo fallido,
    // borrarla primero para que el RENAME no choque.
    if (tablaExiste('habitaciones_old')) {
      db.exec('DROP TABLE habitaciones_old;');
    }

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
    console.log('✅ Tabla habitaciones migrada — ya acepta cualquier tipo del catálogo');
  }
  } catch (err) {
    console.error('⚠️  Migración habitaciones (quitar CHECK viejo) falló:', err.message);
    console.error('   Usá GET /api/diag y /api/repair-habitaciones para diagnosticar y reparar manualmente.');
  }

  // ── Migración: FK fosilizada en tablas hijas tras el RENAME de su tabla padre ──
  // Cuando una tabla se renombra temporalmente (ej. "habitaciones" -> "habitaciones_old",
  // "checkins" -> "checkins_fix_old") durante su propia migración, SQLite no siempre
  // actualiza las FOREIGN KEY de las demás tablas que ya la referenciaban — su
  // definición SQL puede quedar fosilizada apuntando literalmente al nombre viejo,
  // aunque esa tabla temporal ya no exista. Esto se reconstruye igual que con
  // habitaciones: RENAME + CREATE + INSERT + DROP.
  //
  // IMPORTANTE: este bloque corre SIEMPRE en cada arranque del servidor, sin
  // importar si la migración de habitaciones de arriba falló o no — antes vivía
  // anidado por error dentro de ese catch, así que en un arranque normal (sin
  // error previo) nunca se ejecutaba y las FK fosilizadas quedaban sin reparar.
  //
  // La detección es genérica (cualquier FK que apunte a una tabla "*_old"), no
  // solo "habitaciones_old", porque el mismo problema se repite en cascada:
  // reparar "checkins" puede fosilizar a su vez las FK de "facturas" y
  // "servicios_extras" que apuntaban a checkins.
  //
  // Cada tabla se repara en su propio try/catch, y antes de intentar el RENAME
  // se limpia cualquier "<tabla>_fix_old" residual de un intento anterior
  // interrumpido — el mismo patrón defensivo que ya usamos para habitaciones.
  const tablaExisteGenerico = (nombre) =>
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nombre);

  // Usar PRAGMA foreign_key_list (parser nativo de SQLite) en vez de regex
  // sobre el texto del SQL — es 100% confiable sin importar formato/espacios.
  const fkFosilizada = (tabla) => {
    if (!tablaExisteGenerico(tabla)) return false;
    const fks = db.prepare(`PRAGMA foreign_key_list(${tabla})`).all();
    return fks.some(fk => fk.table.endsWith('_old'));
  };

  try {
    // 3 estados posibles para "reservas" / "reservas_fix_old":
    //  1) reservas existe y SIN FK fosilizada, sin residuo -> nada que hacer
    //  2) reservas existe y SIN FK fosilizada, CON residuo  -> ya migró antes,
    //     solo limpiar el residuo huérfano
    //  3) reservas existe CON FK fosilizada                -> reconstruir
    //  4) reservas NO existe pero reservas_fix_old SÍ       -> la migración se
    //     interrumpió justo después del RENAME, antes del CREATE. Hay que
    //     COMPLETAR el proceso (crear tabla nueva + copiar datos + dropear
    //     la vieja) — NUNCA solo borrar, o se pierden reservas reales.
    const reservasExiste = tablaExisteGenerico('reservas');
    const reservasOldExiste = tablaExisteGenerico('reservas_fix_old');

    if (reservasExiste && !fkFosilizada('reservas') && reservasOldExiste) {
      // Caso 2: ya migró exitosamente antes, solo quedó el residuo por limpiar
      console.log('🧹 Limpiando reservas_fix_old residual (la migración ya había completado)...');
      db.exec('DROP TABLE reservas_fix_old;');
    }

    if ((reservasExiste && fkFosilizada('reservas')) || (!reservasExiste && reservasOldExiste)) {
      // Caso 3 o Caso 4: hay que (re)construir la tabla nueva
      console.log('🔧 Reconstruyendo tabla reservas (FK fosilizada o migración interrumpida a medias)...');

      const migrar = db.transaction(() => {
        // Si "reservas" todavía existe (Caso 3), renombrarla primero.
        // Si no existe (Caso 4), ya está renombrada de un intento anterior.
        if (reservasExiste) {
          db.exec('ALTER TABLE reservas RENAME TO reservas_fix_old;');
        }
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
        // Insertar solo las columnas que existían en la tabla vieja (por si difiere)
        const colsViejas = db.prepare('PRAGMA table_info(reservas_fix_old)').all().map(c => c.name);
        const colsComunes = colsViejas.filter(c =>
          ['id','codigo','huesped_id','habitacion_id','fecha_entrada','fecha_salida','noches',
           'adultos','ninos','estado','tipo_garantia','monto_deposito','motivo_visita','empresa',
           'cliente_corporativo_id','tarifa_aplicada','moneda','tasa_cambio','total_estimado',
           'notas','origen','created_by','created_at','updated_at'].includes(c)
        ).join(', ');
        db.exec(`INSERT INTO reservas (${colsComunes}) SELECT ${colsComunes} FROM reservas_fix_old;`);
        db.exec('DROP TABLE reservas_fix_old;');
      });
      migrar();
      console.log('✅ Tabla reservas reconstruida con FK correcta — datos preservados');
    }
  } catch (err) {
    console.error('⚠️  Migración FK fosilizada (reservas) falló:', err.message);
  }

  // checkins se repara en su PROPIO try/catch — mismo patrón de 4 casos que reservas.
  try {
    const checkinsExiste = tablaExisteGenerico('checkins');
    const checkinsOldExiste = tablaExisteGenerico('checkins_fix_old');

    if (checkinsExiste && !fkFosilizada('checkins') && checkinsOldExiste) {
      console.log('🧹 Limpiando checkins_fix_old residual (la migración ya había completado)...');
      db.exec('DROP TABLE checkins_fix_old;');
    }

    if ((checkinsExiste && fkFosilizada('checkins')) || (!checkinsExiste && checkinsOldExiste)) {
      console.log('🔧 Reconstruyendo tabla checkins (FK fosilizada o migración interrumpida a medias)...');

      const migrar = db.transaction(() => {
        if (checkinsExiste) {
          db.exec('ALTER TABLE checkins RENAME TO checkins_fix_old;');
        }
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
        const colsViejas = db.prepare('PRAGMA table_info(checkins_fix_old)').all().map(c => c.name);
        const colsComunes = colsViejas.filter(c =>
          ['id','reserva_id','huesped_id','habitacion_id','fecha_checkin','fecha_checkout_real',
           'fecha_checkout_prevista','estado','observaciones','atendido_por','created_at'].includes(c)
        ).join(', ');
        db.exec(`INSERT INTO checkins (${colsComunes}) SELECT ${colsComunes} FROM checkins_fix_old;`);
        db.exec('DROP TABLE checkins_fix_old;');
      });
      migrar();
      console.log('✅ Tabla checkins reconstruida con FK correcta — datos preservados');
    }
  } catch (err) {
    console.error('⚠️  Migración FK fosilizada (checkins) falló:', err.message);
  }

  // ── Migración: FK fosilizada en facturas/servicios_extras (referencian checkins) ──
  // Efecto en cascada del bloque anterior: si "checkins" se renombró alguna vez
  // a "checkins_fix_old" durante SU propia reparación, las tablas que a su vez
  // referencian a checkins (facturas, servicios_extras) pueden haber quedado
  // fosilizadas apuntando a "checkins_fix_old" — que es exactamente el error
  // "no such table: main.checkins_fix_old" que se ve al hacer Check-Out
  // (el checkout inserta en facturas y lee servicios_extras).
  try {
    const facturasExiste = tablaExisteGenerico('facturas');
    const facturasOldExiste = tablaExisteGenerico('facturas_fix_old');

    if (facturasExiste && !fkFosilizada('facturas') && facturasOldExiste) {
      console.log('🧹 Limpiando facturas_fix_old residual (la migración ya había completado)...');
      db.exec('DROP TABLE facturas_fix_old;');
    }

    if ((facturasExiste && fkFosilizada('facturas')) || (!facturasExiste && facturasOldExiste)) {
      console.log('🔧 Reconstruyendo tabla facturas (FK fosilizada hacia checkins_fix_old)...');

      const migrar = db.transaction(() => {
        if (facturasExiste) {
          db.exec('ALTER TABLE facturas RENAME TO facturas_fix_old;');
        }
        db.exec(`
          CREATE TABLE facturas (
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
        `);
        const colsViejas = db.prepare('PRAGMA table_info(facturas_fix_old)').all().map(c => c.name);
        const colsComunes = colsViejas.filter(c =>
          ['id','numero_factura','cai','checkin_id','reserva_id','huesped_id','cliente_nombre',
           'cliente_rtn','cliente_direccion','moneda','tasa_cambio','subtotal_exento',
           'subtotal_gravado_isv','subtotal_gravado_iht','isv_15','iht_4','descuento','total',
           'estado','metodo_pago','observaciones','impresa','enviada_email','created_by','created_at'].includes(c)
        ).join(', ');
        db.exec(`INSERT INTO facturas (${colsComunes}) SELECT ${colsComunes} FROM facturas_fix_old;`);
        db.exec('DROP TABLE facturas_fix_old;');
      });
      migrar();
      console.log('✅ Tabla facturas reconstruida con FK correcta — datos preservados');
    }
  } catch (err) {
    console.error('⚠️  Migración FK fosilizada (facturas) falló:', err.message);
  }

  try {
    const extrasExiste = tablaExisteGenerico('servicios_extras');
    const extrasOldExiste = tablaExisteGenerico('servicios_extras_fix_old');

    if (extrasExiste && !fkFosilizada('servicios_extras') && extrasOldExiste) {
      console.log('🧹 Limpiando servicios_extras_fix_old residual (la migración ya había completado)...');
      db.exec('DROP TABLE servicios_extras_fix_old;');
    }

    if ((extrasExiste && fkFosilizada('servicios_extras')) || (!extrasExiste && extrasOldExiste)) {
      console.log('🔧 Reconstruyendo tabla servicios_extras (FK fosilizada hacia checkins_fix_old)...');

      const migrar = db.transaction(() => {
        if (extrasExiste) {
          db.exec('ALTER TABLE servicios_extras RENAME TO servicios_extras_fix_old;');
        }
        db.exec(`
          CREATE TABLE servicios_extras (
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
        `);
        const colsViejas = db.prepare('PRAGMA table_info(servicios_extras_fix_old)').all().map(c => c.name);
        const colsComunes = colsViejas.filter(c =>
          ['id','checkin_id','descripcion','cantidad','precio_unitario','subtotal','categoria','fecha'].includes(c)
        ).join(', ');
        db.exec(`INSERT INTO servicios_extras (${colsComunes}) SELECT ${colsComunes} FROM servicios_extras_fix_old;`);
        db.exec('DROP TABLE servicios_extras_fix_old;');
      });
      migrar();
      console.log('✅ Tabla servicios_extras reconstruida con FK correcta — datos preservados');
    }
  } catch (err) {
    console.error('⚠️  Migración FK fosilizada (servicios_extras) falló:', err.message);
  }
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
    ['smtp_host', '', 'Servidor SMTP para envío de correos'],
    ['smtp_port', '587', 'Puerto SMTP'],
    ['smtp_user', '', 'Usuario SMTP'],
    ['smtp_pass', '', 'Contraseña SMTP'],
    ['smtp_from', '', 'Correo remitente de notificaciones'],
    ['notif_email_reservas', '1', '1=enviar email al crear reserva'],
    ['notif_email_checkin', '1', '1=enviar email al hacer check-in'],
    ['notif_email_factura', '1', '1=enviar email al emitir factura'],
    ['hora_checkin', '15:00', 'Hora estándar de check-in'],
    ['hora_checkout', '12:00', 'Hora estándar de check-out'],
    ['recargo_hora_porcentaje', '10', 'Recargo % por hora/fracción fuera de horario'],
  ];

  const insertConfig = db.prepare(
    'INSERT OR IGNORE INTO configuracion_hotel (clave, valor, descripcion) VALUES (?, ?, ?)'
  );
  configs.forEach(([clave, valor, desc]) => insertConfig.run(clave, valor, desc));

  // Catálogo inicial de tipos de habitación (los que ya existían, ahora editables)
  const tiposExisten = db.prepare('SELECT id FROM tipos_habitacion LIMIT 1').get();
  if (!tiposExisten) {
    const insertTipo = db.prepare(
      'INSERT INTO tipos_habitacion (nombre, capacidad_sugerida, precio_sugerido, descripcion) VALUES (?, ?, ?, ?)'
    );
    [
      ['SENCILLA',  1, 700,  'Habitación individual estándar'],
      ['DOBLE',     2, 900,  'Habitación con dos camas o cama doble'],
      ['SUITE',     2, 1500, 'Suite con sala de estar'],
      ['EJECUTIVA', 2, 1800, 'Habitación ejecutiva con amenidades premium'],
      ['FAMILIAR',  4, 1300, 'Habitación amplia para familias'],
    ].forEach(([nombre, cap, precio, desc]) => insertTipo.run(nombre, cap, precio, desc));
  }

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
    db.prepare(`INSERT INTO tasa_cambio (fecha, tasa_compra, tasa_venta, observaciones) VALUES (date('now'), ?, ?, ?)`)
      .run(24.85, 25.10, 'Tasa inicial del sistema');
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
