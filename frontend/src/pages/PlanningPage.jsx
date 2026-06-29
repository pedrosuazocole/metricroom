// src/pages/PlanningPage.jsx - Vista planning hotelero
// Panel lateral como modal en móvil, columna en desktop
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, BedDouble, X, Calendar, LogIn, LogOut, ArrowLeftRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'

const ESTADOS = {
  DISPONIBLE:            { label: 'Disponible',  bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-400', dot: '#22c55e' },
  OCUPADA:               { label: 'Ocupada',     bg: 'bg-red-500',     border: 'border-red-400',     text: 'text-red-400',     dot: '#ef4444' },
  RESERVADA:             { label: 'Reservada',   bg: 'bg-blue-600',    border: 'border-blue-400',    text: 'text-blue-400',    dot: '#3b82f6' },
  RESERVADA_GARANTIZADA: { label: 'Garantizada', bg: 'bg-cyan-600',    border: 'border-cyan-400',    text: 'text-cyan-400',    dot: '#06b6d4' },
  BLOQUEADA:             { label: 'Bloqueada',   bg: 'bg-slate-600',   border: 'border-slate-500',   text: 'text-slate-400',   dot: '#6b7280' },
  SUCIA:                 { label: 'Limpieza',    bg: 'bg-yellow-500',  border: 'border-yellow-400',  text: 'text-yellow-400',  dot: '#eab308' },
}

// Modal de Cambio de Habitación
function ModalCambioHabitacion({ checkinId, habActual, onClose, onDone }) {
  const [habitaciones, setHabitaciones] = useState([])
  const [habDestino, setHabDestino]     = useState('')
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    api.get('/habitaciones', { params: { estado: 'DISPONIBLE' } })
      .then(r => setHabitaciones((r.data.data || []).filter(h => h.id !== habActual.id)))
      .catch(() => {})
  }, [habActual.id])

  const confirmar = async () => {
    if (!habDestino) return toast.error('Seleccioná la habitación destino')
    setLoading(true)
    try {
      await api.post(`/checkins/${checkinId}/cambio-habitacion`, { nueva_habitacion_id: habDestino })
      toast.success('Habitación cambiada exitosamente')
      onDone()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al cambiar habitación')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-brand-400" /> Cambio de Habitación
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
            <span className="text-slate-500">Habitación actual: </span>
            <span className="text-white font-semibold">Hab. {habActual.numero}</span>
          </div>
          <div>
            <label className="label">Habitación destino (disponibles)</label>
            <select value={habDestino} onChange={e => setHabDestino(e.target.value)} className="input-field">
              <option value="">Seleccioná una habitación...</option>
              {habitaciones.map(h => (
                <option key={h.id} value={h.id}>
                  Hab. {h.numero} — {h.tipo} · Piso {h.piso} · L. {parseFloat(h.precio_base).toLocaleString('es-HN')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={confirmar} disabled={loading || !habDestino} className="btn-primary flex-1 justify-center">
              <ArrowLeftRight className="w-4 h-4" /> {loading ? 'Cambiando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlanningPage() {
  const navigate = useNavigate()
  const [data, setData]                 = useState(null)
  const [selected, setSelected]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [cambiando, setCambiando]       = useState(false)
  const [showCambio, setShowCambio]     = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/habitaciones/planning')
      setData(res.data.data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    const t = setInterval(cargar, 60000)
    return () => clearInterval(t)
  }, [cargar])

  const cambiarEstado = async (habId, nuevoEstado) => {
    setCambiando(true)
    try {
      await api.patch(`/habitaciones/${habId}/estado`, { estado: nuevoEstado })
      toast.success(`Estado → ${ESTADOS[nuevoEstado]?.label}`)
      await cargar()
      setSelected(prev => prev?.id === habId ? { ...prev, estado: nuevoEstado } : prev)
    } finally { setCambiando(false) }
  }

  const handleCheckout = () => {
    // En vez de hacer el check-out directo, llevamos al recepcionista a
    // Facturación con el huésped/habitación/checkin ya precargados. El
    // check-out real de la habitación se hace después, como paso separado
    // (el recepcionista vuelve a Planning y usa el botón de Check-In/Out o
    // lo hace desde el módulo de Check-Ins una vez que la factura ya existe).
    if (!selected?.checkin_id) return toast.error('No hay check-in activo')
    navigate('/facturas', {
      state: {
        precargarDesdeCheckin: {
          checkin_id: selected.checkin_id,
          huesped_nombre: selected.huesped_nombre,
          habitacion_numero: selected.numero,
          tarifa_aplicada: selected.precio_base,
          saldo_estimado: selected.saldo_estimado,
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  const metricas  = data?.metricas || {}
  const pisos     = data?.pisos || {}
  const pisosList = Object.keys(pisos).sort((a, b) => parseInt(a) - parseInt(b))

  // Botones de acción según el estado de la habitación
  const acciones = selected ? [
    // Reserva — solo si está DISPONIBLE o SUCIA
    {
      show: ['DISPONIBLE', 'SUCIA', 'BLOQUEADA'].includes(selected.estado),
      icon: Calendar,
      label: 'Nueva Reserva',
      color: 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30',
      onClick: () => navigate('/reservas'),
    },
    // Check-In — solo si está RESERVADA o RESERVADA_GARANTIZADA
    {
      show: ['RESERVADA', 'RESERVADA_GARANTIZADA'].includes(selected.estado),
      icon: LogIn,
      label: 'Check-In',
      color: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30',
      onClick: () => navigate('/checkins', {
        state: { preseleccionarReservaId: selected.reserva_pendiente_id }
      }),
    },
    // Cambio de habitación — solo si está OCUPADA
    {
      show: selected.estado === 'OCUPADA' && !!selected.checkin_id,
      icon: ArrowLeftRight,
      label: 'Cambiar Habitación',
      color: 'bg-brand-600/20 border-brand-500/40 text-brand-400 hover:bg-brand-600/30',
      onClick: () => setShowCambio(true),
    },
    // Check-Out — solo si está OCUPADA
    {
      show: selected.estado === 'OCUPADA' && !!selected.checkin_id,
      icon: LogOut,
      label: 'Check-Out',
      color: 'bg-red-600/20 border-red-500/40 text-red-400 hover:bg-red-600/30',
      onClick: handleCheckout,
    },
  ].filter(a => a.show) : []

  return (
    <div className="flex gap-0 lg:gap-5 h-full relative">

      {/* ─── Panel principal ─── */}
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto pr-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Planning de Habitaciones</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Ocupación: <span className="text-brand-400 font-semibold">{metricas.porcentaje_ocupacion || 0}%</span>
              {' '}· {metricas.ocupadas || 0} ocupadas de {metricas.total || 0} hab.
            </p>
          </div>
          <button onClick={cargar} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        {/* Filtros de estado */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltroEstado('TODOS')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
              ${filtroEstado === 'TODOS'
                ? 'bg-slate-600 text-white border-transparent'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
          >
            Todos ({metricas.total || 0})
          </button>
          {Object.entries(ESTADOS).map(([key, est]) => {
            const count =
              key === 'DISPONIBLE' ? metricas.disponibles :
              key === 'OCUPADA'    ? metricas.ocupadas :
              key === 'RESERVADA'  ? metricas.reservadas :
              key === 'BLOQUEADA'  ? metricas.bloqueadas :
              key === 'SUCIA'      ? metricas.sucias : 0
            return (
              <button
                key={key}
                onClick={() => setFiltroEstado(filtroEstado === key ? 'TODOS' : key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                  ${filtroEstado === key
                    ? `${est.bg} text-white border-transparent`
                    : `bg-slate-800 ${est.border}/30 ${est.text} hover:bg-slate-700`}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: est.dot }} />
                {est.label}
                <span className="font-bold">{count || 0}</span>
              </button>
            )
          })}
        </div>

        {/* Rejilla por pisos */}
        <div className="space-y-3">
          {pisosList.map(piso => {
            const habitaciones = pisos[piso].filter(h =>
              filtroEstado === 'TODOS' || h.estado === filtroEstado
            )
            if (habitaciones.length === 0) return null
            return (
              <div key={piso} className="card py-3 px-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-brand-600/20 rounded-md flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-400 text-xs font-bold">{piso}</span>
                  </div>
                  <span className="font-semibold text-slate-300 text-sm">Piso {piso}</span>
                  <span className="text-xs text-slate-600">({pisos[piso].length} hab.)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                  {habitaciones.map(hab => {
                    const est = ESTADOS[hab.estado] || ESTADOS.DISPONIBLE
                    const isSel = selected?.id === hab.id
                    return (
                      <button
                        key={hab.id}
                        onClick={() => setSelected(isSel ? null : hab)}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-150
                          ${isSel
                            ? `${est.bg} border-transparent shadow-lg scale-105`
                            : `bg-slate-900/50 ${est.border} hover:scale-105 hover:shadow-md`}`}
                        title={`${hab.numero} · ${est.label}${hab.huesped_nombre ? ` · ${hab.huesped_nombre}` : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full mb-0.5 ${isSel ? 'bg-white' : est.bg}`} />
                        <span className={`text-xs font-bold leading-none ${isSel ? 'text-white' : 'text-slate-200'}`}>
                          {hab.numero}
                        </span>
                        <span className={`text-[8px] mt-0.5 ${isSel ? 'text-white/70' : 'text-slate-600'}`}>
                          {hab.tipo?.slice(0, 3)}
                        </span>
                        {hab.huesped_nombre && !isSel && (
                          <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Panel lateral ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSelected(null)} />

          <div className={[
            'bg-slate-800 border border-slate-700 rounded-2xl overflow-y-auto',
            'fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-b-none',
            'lg:static lg:w-72 lg:flex-shrink-0 lg:max-h-full lg:rounded-2xl lg:z-auto',
          ].join(' ')}>

            {/* Header */}
            <div className={`px-4 pt-4 pb-3 rounded-t-2xl ${ESTADOS[selected.estado]?.bg || 'bg-slate-700'}`}>
              <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-3 lg:hidden" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">HABITACIÓN</p>
                  <h2 className="text-3xl font-black text-white">{selected.numero}</h2>
                  <p className="text-white/80 text-sm">{selected.tipo} · Piso {selected.piso}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => setSelected(null)}
                    className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <p className="text-white font-semibold text-sm">{ESTADOS[selected.estado]?.label}</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">

              {/* ── BOTONES DE ACCIÓN ── */}
              {acciones.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Acciones</p>
                  <div className="grid grid-cols-2 gap-2">
                    {acciones.map(({ icon: Icon, label, color, onClick }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${color}`}
                      >
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Info huésped */}
              {selected.huesped_nombre ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Huésped</p>
                  {[
                    { label: 'Nombre',   value: selected.huesped_nombre },
                    { label: 'Teléfono', value: selected.huesped_tel || '—' },
                    { label: 'Entrada',  value: selected.fecha_checkin?.split(' ')[0] || '—', hi: true },
                    { label: 'Salida',   value: selected.fecha_checkout_prevista?.split(' ')[0] || '—', hi: true },
                    { label: 'Saldo',    value: `L. ${(selected.saldo_estimado || 0).toFixed(2)}`, hi: true },
                  ].map(({ label, value, hi }) => (
                    <div key={label} className="flex justify-between items-start gap-2 text-sm">
                      <span className="text-slate-500 flex-shrink-0">{label}</span>
                      <span className={`text-right ${hi ? 'text-brand-400 font-medium' : 'text-slate-300'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-slate-600">
                  <BedDouble className="w-8 h-8 mx-auto mb-1 opacity-40" />
                  <p className="text-xs">Sin huésped activo</p>
                </div>
              )}

              {/* Tarifa */}
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tarifa</span>
                  <span className="text-white font-semibold"><PrecioDual monto={selected.precio_base || 0} size="sm" />/noche</span>
                </div>
              </div>

              {/* Cambiar estado */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cambiar Estado</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(ESTADOS).filter(([k]) => k !== selected.estado).map(([key, est]) => (
                    <button
                      key={key}
                      disabled={cambiando}
                      onClick={() => cambiarEstado(selected.id, key)}
                      className={`text-xs px-2 py-2 rounded-lg border ${est.border}/40 ${est.text} hover:bg-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 justify-center`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: est.dot }} />
                      {est.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Cambio de Habitación */}
      {showCambio && selected && (
        <ModalCambioHabitacion
          checkinId={selected.checkin_id}
          habActual={selected}
          onClose={() => setShowCambio(false)}
          onDone={() => { setShowCambio(false); setSelected(null); cargar() }}
        />
      )}
    </div>
  )
}
