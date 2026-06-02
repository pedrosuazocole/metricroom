// src/App.jsx - Enrutador principal de MetricRoom
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage        from './pages/LoginPage'
import DashboardPage    from './pages/DashboardPage'
import HabitacionesPage from './pages/HabitacionesPage'
import PlanningPage     from './pages/PlanningPage'
import ReservasPage     from './pages/ReservasPage'
import HuespedesPage    from './pages/HuespedesPage'
import CheckInsPage     from './pages/CheckInsPage'
import FacturasPage     from './pages/FacturasPage'
import InventarioPage   from './pages/InventarioPage'
import ClientesPage     from './pages/ClientesPage'
import ProveedoresPage  from './pages/ProveedoresPage'
import BancosPage       from './pages/BancosPage'
import CxCPage          from './pages/CxCPage'
import CxPPage          from './pages/CxPPage'
import ReportesPage     from './pages/ReportesPage'
import UsuariosPage     from './pages/UsuariosPage'
import ConfiguracionPage from './pages/ConfiguracionPage'

function AppRoutes() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="habitaciones" element={<HabitacionesPage />} />
        <Route path="planning"     element={<PlanningPage />} />
        <Route path="reservas"     element={<ReservasPage />} />
        <Route path="huespedes"    element={<HuespedesPage />} />
        <Route path="checkins"     element={<CheckInsPage />} />
        <Route path="facturas"     element={<FacturasPage />} />
        <Route path="inventario"   element={<InventarioPage />} />
        <Route path="clientes"     element={<ClientesPage />} />
        <Route path="proveedores"  element={<ProveedoresPage />} />
        <Route path="bancos"       element={<BancosPage />} />
        <Route path="cxc"          element={<CxCPage />} />
        <Route path="cxp"          element={<CxPPage />} />
        <Route path="reportes"     element={<ReportesPage />} />
        <Route path="usuarios"     element={<UsuariosPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*"      element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
