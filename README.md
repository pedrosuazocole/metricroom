# 🏨 MetricRoom — Sistema Hotelero Premium

Software de gestión hotelera empresarial con cumplimiento fiscal SAR Honduras, planning visual de habitaciones, facturación electrónica, y notificaciones automáticas por WhatsApp.

---

## ✨ Características Principales

| Módulo | Funcionalidades |
|--------|----------------|
| **Planning** | Rejilla visual por pisos, 6 estados con código de colores, panel lateral con datos del huésped |
| **Reservas** | Motor completo con verificación de traslape, código de reserva, depósitos |
| **Check-In/Out** | Proceso express, folio de huésped, servicios extras |
| **Facturación SAR** | CAI, rangos autorizados, ISV 15% + IHT 4%, impresión en hoja Carta |
| **Inventario** | Stock de amenidades, alertas de mínimos, movimientos |
| **CxC / CxP** | Cuentas por cobrar/pagar, abonos, saldos envejecidos |
| **Reportes** | Cierre de caja, libro de ventas, libro de huéspedes, ocupación |
| **WhatsApp** | Notificaciones automáticas vía CallMeBot API |
| **Tasa de Cambio** | Control diario HNL/USD con historial |

---

## 🛠 Stack Tecnológico

- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons + Recharts
- **Backend**: Node.js + Express.js
- **Base de Datos**: SQLite (better-sqlite3)
- **Despliegue**: Railway (Dockerfile multi-etapa)
- **Notificaciones**: CallMeBot API (WhatsApp)

---

## 🚀 Instalación Local (Desarrollo)

### Requisitos
- Node.js >= 18
- npm >= 9

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/metricroom.git
cd metricroom
```

### 2. Configurar el Backend
```bash
cd backend
cp ../.env.example .env
# Edita .env con tus valores
npm install
node server.js
```
El backend corre en `http://localhost:3001`

### 3. Configurar el Frontend
```bash
cd frontend
npm install
npm run dev
```
El frontend corre en `http://localhost:5173`

### 4. Credenciales por defecto
| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

> ⚠️ **Cambia la contraseña del administrador en producción.**

---

## ☁️ Despliegue en Railway

### Paso 1: Preparar el proyecto
```bash
git add .
git commit -m "Initial commit MetricRoom"
git push origin main
```

### Paso 2: Crear proyecto en Railway
1. Ingresa a [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona tu repositorio

### Paso 3: Configurar Variables de Entorno
En Railway > tu servicio > **Variables**, agrega:

```
DATABASE_PATH=/data/metricroom.db
NODE_ENV=production
PORT=3001
JWT_SECRET=<cadena-aleatoria-larga-y-segura>
```

### Paso 4: Montar Volumen Persistente (¡IMPORTANTE!)
En Railway > tu servicio > **Volumes**:
- Mount Path: `/data`
- Esto garantiza que la base de datos SQLite **NO se borra** entre deploys.

### Paso 5: Deploy
Railway detecta automáticamente el `Dockerfile` y construye el proyecto.

---

## 📱 Configurar Notificaciones WhatsApp

1. Guarda el número **+34 644 65 21 68** en tus contactos de WhatsApp
2. Envía el mensaje: `I allow callmebot to send me messages`
3. Recibirás tu **API KEY** en minutos
4. En MetricRoom → **Configuración** → **WhatsApp**, ingresa tu número y API Key
5. Activa las notificaciones deseadas (reservas, check-in, check-out, facturas)

---

## 🧾 Configurar SAR Honduras

1. Ve a **Configuración** → **SAR / CAI**
2. Ingresa el **CAI** exactamente como aparece en tu resolución SAR
3. Configura el **rango de facturación** autorizado
4. Establece la **fecha límite de emisión**
5. El sistema genera automáticamente el correlativo en formato `001-001-01-00000001`

---

## 📁 Estructura del Proyecto

```
metricroom/
├── backend/
│   ├── db/
│   │   └── database.js          # Esquema SQLite + datos semilla
│   ├── routes/
│   │   ├── auth.js
│   │   ├── habitaciones.js
│   │   ├── reservas.js
│   │   ├── checkins.js
│   │   ├── facturas.js
│   │   ├── inventario.js
│   │   ├── clientes.js
│   │   ├── proveedores.js
│   │   ├── cuentas_cobrar.js
│   │   ├── cuentas_pagar.js
│   │   ├── reportes.js
│   │   ├── configuracion.js
│   │   ├── tasa_cambio.js
│   │   └── caja.js
│   ├── utils/
│   │   └── whatsapp.js          # Integración CallMeBot
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   └── layout/
│   │   │       └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── PlanningPage.jsx
│   │   │   ├── ReservasPage.jsx
│   │   │   ├── HuespedesPage.jsx
│   │   │   ├── CheckInsPage.jsx
│   │   │   ├── FacturasPage.jsx
│   │   │   ├── InventarioPage.jsx
│   │   │   ├── ClientesPage.jsx
│   │   │   ├── ProveedoresPage.jsx
│   │   │   ├── CxCPage.jsx
│   │   │   ├── CxPPage.jsx
│   │   │   ├── ReportesPage.jsx
│   │   │   └── ConfiguracionPage.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── Dockerfile
├── docker-compose.yml
├── railway.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🏨 Datos de Prueba (Semilla)

El sistema se inicializa con:
- **15 habitaciones** distribuidas en 3 pisos
- **Usuario administrador**: admin / admin123
- **Tasa de cambio** inicial: L. 24.85 / USD
- Configuración del hotel lista para personalizar

---

## 📄 Licencia

Desarrollado para uso empresarial. MetricRoom © 2025.
