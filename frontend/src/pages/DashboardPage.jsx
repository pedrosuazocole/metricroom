// src/pages/DashboardPage.jsx - Panel principal con métricas clave
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  BedDouble, Users, Calendar, TrendingUp, AlertTriangle,
  CheckCircle, Clock, DollarSign, Activity, ArrowRight
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../utils/api'

const ESTADO_COLORS = {
  DISPONIBLE: '#22c55e', OCUPADA: '#ef4444', RESERVADA: '#3b82f6',
  RESERVADA_GARANTIZADA: '#06b6d4', BLOQUEADA: '#6b7280', SUCIA: '#eab308',
}

export default function DashboardPage() {
  const [planning, setPlanning] = useState(null)
  const [reservasHoy, setReservasHoy] = useState(null)
  const [cierreHoy, setCierreHoy] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/habitaciones/planning'),
      api.get('/reservas/hoy'),
      api.get('/reportes/cierre-caja'),
    ]).then(([p, r, c]) => {
      setPlanning(p.data.data)
      setReservasHoy(r.data.data)
      setCierreHoy(c.data.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  const metricas = planning?.metricas || {}
  const hoy = new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })

  // Datos para gráfico de distribución
  const distribucionData = [
    { name: 'Disponibles', value: metricas.disponibles || 0, color: ESTADO_COLORS.DISPONIBLE },
    { name: 'Ocupadas', value: metricas.ocupadas || 0, color: ESTADO_COLORS.OCUPADA },
    { name: 'Reservadas', value: metricas.reservadas || 0, color: ESTADO_COLORS.RESERVADA },
    { name: 'Bloqueadas', value: metricas.bloqueadas || 0, color: ESTADO_COLORS.BLOQUEADA },
    { name: 'Sucias', value: metricas.sucias || 0, color: ESTADO_COLORS.SUCIA },
  ].filter(d => d.value > 0)

  const ventasPorMetodo = cierreHoy?.ventas_por_metodo || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm capitalize">{hoy}</p>
        </div>
        <Link to="/planning" className="btn-secondary text-sm">
          Ver Planning <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ocupación Hoy"
          value={`${metricas.porcentaje_ocupacion || 0}%`}
          sub={`${metricas.ocupadas || 0} de ${metricas.total || 0} hab.`}
          icon={Activity}
          color="brand"
        />
        <KPICard
          title="Check-Ins Hoy"
          value={reservasHoy?.checkins_hoy?.length || 0}
          sub="Llegadas esperadas"
          icon={CheckCircle}
          color="emerald"
        />
        <KPICard
          title="Check-Outs Hoy"
          value={reservasHoy?.checkouts_hoy?.length || 0}
          sub="Salidas programadas"
          icon={Clock}
          color="yellow"
        />
        <KPICard
          title="Ventas del Día"
          value={`L. ${(cierreHoy?.total_dia || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}
          sub={`ISV: L. ${(cierreHoy?.impuestos?.total_isv || 0).toFixed(2)}`}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Disponibles" value={metricas.disponibles || 0} icon={BedDouble} color="green" small />
        <KPICard title="Ocupadas" value={metricas.ocupadas || 0} icon={Users} color="red" small />
        <KPICard title="Reservadas" value={metricas.reservadas || 0} icon={Calendar} color="blue" small />
        <KPICard title="Pendientes Limpieza" value={metricas.sucias || 0} icon={AlertTriangle} color="yellow" small />
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribución de habitaciones */}
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">Distribución de Habitaciones</h3>
          {distribucionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distribucionData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {distribucionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-600">Sin datos</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {distribucionData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: <span className="font-semibold text-slate-300">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ventas por método de pago */}
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">Ventas por Método de Pago — Hoy</h3>
          {ventasPorMetodo.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ventasPorMetodo} barSize={36}>
                <XAxis dataKey="metodo_pago" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v) => `L. ${v.toFixed(2)}`} />
                <Bar dataKey="total_metodo" name="Total" fill="#4f7bf7" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-600 flex-col gap-2">
              <DollarSign className="w-8 h-8" />
              <p className="text-sm">No hay ventas registradas hoy</p>
            </div>
          )}
        </div>
      </div>

      {/* Movimientos del día */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Check-ins esperados */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">Llegadas de Hoy</h3>
            <Link to="/checkins" className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {reservasHoy?.checkins_hoy?.length > 0 ? (
            <div className="space-y-2">
              {reservasHoy.checkins_hoy.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.huesped_nombre}</p>
                    <p className="text-xs text-slate-500">Hab. {r.numero} · {r.tipo}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full badge-reservada">Confirmada</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-6">No hay llegadas programadas para hoy</p>
          )}
        </div>

        {/* Check-outs esperados */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">Salidas de Hoy</h3>
            <Link to="/checkins" className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {reservasHoy?.checkouts_hoy?.length > 0 ? (
            <div className="space-y-2">
              {reservasHoy.checkouts_hoy.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{c.huesped_nombre}</p>
                    <p className="text-xs text-slate-500">Hab. {c.numero}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full badge-ocupada">Check-out</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-6">No hay salidas programadas para hoy</p>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({ title, value, sub, icon: Icon, color, small }) {
  const colors = {
    brand: 'from-brand-500/20 to-brand-600/10 border-brand-500/20 text-brand-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20 text-green-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl ${small ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-slate-400 text-xs font-medium ${small ? 'text-xs' : 'text-sm'} mb-1`}>{title}</p>
          <p className={`font-bold text-white ${small ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white/5 ${colors[color].split(' ').find(c => c.startsWith('text-'))}`}>
          <Icon className={`${small ? 'w-5 h-5' : 'w-6 h-6'}`} />
        </div>
      </div>
    </div>
  )
}
