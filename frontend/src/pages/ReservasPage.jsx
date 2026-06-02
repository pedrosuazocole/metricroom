// src/pages/ReservasPage.jsx
import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, RefreshCw, Eye, X } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const ESTADOS_BADGE = {
  PENDIENTE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMADA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  GARANTIZADA: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  CHECKIN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CHECKOUT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  CANCELADA: 'bg-red-500/20 text-red-400 border-red-500/30',
  NO_SHOW: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export default function ReservasPage() {
  const [reservas, setReservas] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ huesped_id:'', habitacion_id:'', fecha_entrada:'', fecha_salida:'', adultos:1, ninos:0, tipo_garantia:'EFECTIVO', monto_deposito:0, motivo_visita:'TURISMO', tarifa_aplicada:'', moneda:'HNL', notas:'' })

  const cargar = async () => {
    setLoading(true)
    try {
      const [r, h, hab] = await Promise.all([
        api.get('/reservas', { params: { estado: filtroEstado, limit: 100 } }),
        api.get('/huespedes', { params: { limit: 200 } }),
        api.get('/habitaciones', { params: { estado: 'DISPONIBLE' } }),
      ])
      setReservas(r.data.data || [])
      setHuespedes(h.data.data || [])
      setHabitaciones(hab.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar esta reserva?')) return
    await api.delete(`/reservas/${id}`)
    toast.success('Reserva cancelada')
    cargar()
  }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      await api.post('/reservas', form)
      toast.success('Reserva creada exitosamente')
      setShowModal(false)
      setForm({ huesped_id:'', habitacion_id:'', fecha_entrada:'', fecha_salida:'', adultos:1, ninos:0, tipo_garantia:'EFECTIVO', monto_deposito:0, motivo_visita:'TURISMO', tarifa_aplicada:'', moneda:'HNL', notas:'' })
      cargar()
    } catch { /* toast manejado */ }
  }

  const filtradas = reservas.filter(r =>
    !busqueda || r.huesped_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.codigo?.includes(busqueda) || r.habitacion_numero?.includes(busqueda)
  )

  // Autocompletar tarifa al seleccionar habitación
  const selHab = habitaciones.find(h => h.id == form.habitacion_id)
  useEffect(() => {
    if (selHab && !form.tarifa_aplicada) setForm(p => ({ ...p, tarifa_aplicada: selHab.precio_base }))
  }, [form.habitacion_id])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reservas</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Reserva
        </button>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por huésped, código o habitación..." className="input-field pl-9" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field w-auto">
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_BADGE).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={cargar} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Código','Huésped','Habitación','Entrada','Salida','Noches','Total','Estado','Acciones'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-600">Cargando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-600">No hay reservas</td></tr>
              ) : filtradas.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-brand-400">{r.codigo}</td>
                  <td className="table-cell"><p className="font-medium text-slate-200">{r.huesped_nombre}</p></td>
                  <td className="table-cell"><span className="text-brand-400 font-semibold">{r.habitacion_numero}</span><span className="text-slate-500 text-xs ml-1">{r.habitacion_tipo}</span></td>
                  <td className="table-cell text-slate-400 text-xs">{r.fecha_entrada}</td>
                  <td className="table-cell text-slate-400 text-xs">{r.fecha_salida}</td>
                  <td className="table-cell text-center text-slate-300">{r.noches}</td>
                  <td className="table-cell font-semibold text-slate-200">L. {(r.total_estimado||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ESTADOS_BADGE[r.estado] || ''}`}>{r.estado}</span>
                  </td>
                  <td className="table-cell">
                    {['PENDIENTE','CONFIRMADA','GARANTIZADA'].includes(r.estado) && (
                      <button onClick={() => cancelar(r.id)} className="text-red-500 hover:text-red-400 transition-colors p-1" title="Cancelar">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva reserva */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Nueva Reserva</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Huésped *</label>
                  <select value={form.huesped_id} onChange={e => setForm(p => ({...p, huesped_id: e.target.value}))} className="input-field" required>
                    <option value="">Seleccionar huésped...</option>
                    {huespedes.map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos} — {h.numero_doc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Habitación *</label>
                  <select value={form.habitacion_id} onChange={e => setForm(p => ({...p, habitacion_id: e.target.value, tarifa_aplicada: ''}))} className="input-field" required>
                    <option value="">Seleccionar habitación...</option>
                    {habitaciones.map(h => <option key={h.id} value={h.id}>#{h.numero} — {h.tipo} — L. {h.precio_base}/noche</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha de Entrada *</label>
                  <input type="date" value={form.fecha_entrada} onChange={e => setForm(p=>({...p,fecha_entrada:e.target.value}))} className="input-field" required />
                </div>
                <div>
                  <label className="label">Fecha de Salida *</label>
                  <input type="date" value={form.fecha_salida} onChange={e => setForm(p=>({...p,fecha_salida:e.target.value}))} className="input-field" required />
                </div>
                <div>
                  <label className="label">Adultos</label>
                  <input type="number" min="1" value={form.adultos} onChange={e => setForm(p=>({...p,adultos:e.target.value}))} className="input-field" />
                </div>
                <div>
                  <label className="label">Niños</label>
                  <input type="number" min="0" value={form.ninos} onChange={e => setForm(p=>({...p,ninos:e.target.value}))} className="input-field" />
                </div>
                <div>
                  <label className="label">Tarifa/Noche (L.) *</label>
                  <input type="number" step="0.01" value={form.tarifa_aplicada} onChange={e => setForm(p=>({...p,tarifa_aplicada:e.target.value}))} className="input-field" required />
                </div>
                <div>
                  <label className="label">Tipo de Garantía</label>
                  <select value={form.tipo_garantia} onChange={e => setForm(p=>({...p,tipo_garantia:e.target.value}))} className="input-field">
                    {['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO_EMPRESA','VOUCHER'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Depósito (L.)</label>
                  <input type="number" step="0.01" value={form.monto_deposito} onChange={e => setForm(p=>({...p,monto_deposito:e.target.value}))} className="input-field" />
                </div>
                <div>
                  <label className="label">Motivo de Visita</label>
                  <select value={form.motivo_visita} onChange={e => setForm(p=>({...p,motivo_visita:e.target.value}))} className="input-field">
                    {['TURISMO','NEGOCIOS','EVENTOS','FAMILIAR','OTRO'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(p=>({...p,notas:e.target.value}))} rows={2} className="input-field" placeholder="Observaciones especiales..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Calendar className="w-4 h-4" /> Crear Reserva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
