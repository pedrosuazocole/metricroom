// src/pages/HabitacionesPage.jsx - Gestión completa de habitaciones
import { useState, useEffect } from 'react'
import { BedDouble, Plus, Edit2, X, Check, Wifi, Wind, Tv, Coffee, Car, Bath } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

const ESTADOS = ['DISPONIBLE', 'OCUPADA', 'RESERVADA', 'BLOQUEADA', 'SUCIA', 'RESERVADA_GARANTIZADA']
const AMENIDADES_OPTS = ['WiFi','Aire Acondicionado','TV Cable','Cafetera','Minibar','Jacuzzi','Bañera','Balcón','Caja Fuerte','Estacionamiento']
const AMENIDAD_ICONS = { 'WiFi': Wifi, 'Aire Acondicionado': Wind, 'TV Cable': Tv, 'Cafetera': Coffee, 'Estacionamiento': Car, 'Jacuzzi': Bath }

const ESTADO_COLORS = {
  DISPONIBLE:            'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  OCUPADA:               'bg-red-500/20 text-red-400 border-red-500/30',
  RESERVADA:             'bg-blue-500/20 text-blue-400 border-blue-500/30',
  BLOQUEADA:             'bg-slate-500/20 text-slate-400 border-slate-500/30',
  SUCIA:                 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  RESERVADA_GARANTIZADA: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}

const FORM_INIT = { numero:'', piso:1, tipo:'', capacidad:2, precio_base:'', precio_corporativo:'', descripcion:'', amenidades:[], activa:1 }

export default function HabitacionesPage() {
  const [habitaciones, setHabitaciones] = useState([])
  const [tiposHabitacion, setTiposHabitacion] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [showEstado, setShowEstado]     = useState(false)
  const [selected, setSelected]         = useState(null)
  const [filtroTipo, setFiltroTipo]     = useState('')
  const [filtroPiso, setFiltroPiso]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [form, setForm]                 = useState(FORM_INIT)
  const [nuevoEstado, setNuevoEstado]   = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const [r, tipos] = await Promise.all([
        api.get('/habitaciones'),
        api.get('/tipos-habitacion'),
      ])
      setHabitaciones(r.data.data || [])
      setTiposHabitacion(tipos.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const pisos = [...new Set(habitaciones.map(h => h.piso))].sort()
  const tiposEnUso = [...new Set(habitaciones.map(h => h.tipo))].sort()

  const filtradas = habitaciones.filter(h => {
    if (filtroTipo   && h.tipo   !== filtroTipo)              return false
    if (filtroPiso   && h.piso   !== parseInt(filtroPiso))    return false
    if (filtroEstado && h.estado !== filtroEstado)            return false
    return true
  })

  const abrirNueva  = () => { setForm(FORM_INIT); setShowModal(true) }
  const abrirEditar = (h) => {
    let amenArr = []
    try {
      const parsed = JSON.parse(h.amenidades || '[]')
      amenArr = Array.isArray(parsed) ? parsed : []
    } catch { amenArr = [] }
    setForm({ ...h, amenidades: amenArr })
    setShowModal(true)
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.numero || !form.precio_base) return toast.error('Número y precio base son requeridos')
    const payload = {
      ...form,
      amenidades: Array.isArray(form.amenidades) ? form.amenidades : [],
      piso: parseInt(form.piso), capacidad: parseInt(form.capacidad),
      precio_base: parseFloat(form.precio_base),
      precio_corporativo: form.precio_corporativo ? parseFloat(form.precio_corporativo) : null,
    }
    try {
      if (form.id) { await api.put(`/habitaciones/${form.id}`, payload); toast.success('Habitación actualizada') }
      else          { await api.post('/habitaciones', payload);           toast.success('Habitación creada') }
      setShowModal(false); cargar()
    } catch {}
  }

  const cambiarEstado = async () => {
    if (!nuevoEstado) return toast.error('Seleccioná un estado')
    await api.patch(`/habitaciones/${selected.id}/estado`, { estado: nuevoEstado })
    toast.success(`Estado cambiado a ${nuevoEstado}`)
    setShowEstado(false); setSelected(null); cargar()
  }

  const toggleAmenidad = (a) => setForm(p => ({
    ...p, amenidades: p.amenidades.includes(a) ? p.amenidades.filter(x => x !== a) : [...p.amenidades, a]
  }))

  const stats = ESTADOS.reduce((acc, e) => { acc[e] = habitaciones.filter(h => h.estado === e).length; return acc }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Habitaciones</h1>
        <button onClick={abrirNueva} className="btn-primary"><Plus className="w-4 h-4" /> Nueva Habitación</button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { e:'DISPONIBLE', label:'Disponibles', color:'text-emerald-400' },
          { e:'OCUPADA',    label:'Ocupadas',    color:'text-red-400' },
          { e:'RESERVADA',  label:'Reservadas',  color:'text-blue-400' },
          { e:'SUCIA',      label:'Sucias',      color:'text-orange-400' },
          { e:'BLOQUEADA',  label:'Bloqueadas',  color:'text-slate-400' },
          { e:'RESERVADA_GARANTIZADA', label:'Garantizadas', color:'text-violet-400' },
        ].map(({ e, label, color }) => (
          <div key={e} onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
            className={`stat-card text-center cursor-pointer hover:border-slate-500 transition-all ${filtroEstado === e ? 'border-slate-500' : ''}`}>
            <p className={`text-3xl font-bold ${color}`}>{stats[e] || 0}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select value={filtroPiso} onChange={e => setFiltroPiso(e.target.value)} className="input-field w-auto">
          <option value="">Todos los pisos</option>
          {pisos.map(p => <option key={p} value={p}>Piso {p}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input-field w-auto">
          <option value="">Todos los tipos</option>
          {tiposEnUso.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field w-auto">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
        </select>
        {(filtroTipo || filtroPiso || filtroEstado) && (
          <button onClick={() => { setFiltroTipo(''); setFiltroPiso(''); setFiltroEstado('') }} className="btn-secondary text-xs">✕ Limpiar</button>
        )}
        <span className="text-slate-500 text-sm self-center">{filtradas.length} habitaciones</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card text-center py-12 text-slate-600">Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-16 text-slate-600">
          <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Sin resultados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtradas.map(h => {
            let amenArr = []
            try {
              const parsed = JSON.parse(h.amenidades || '[]')
              amenArr = Array.isArray(parsed) ? parsed : []
            } catch { amenArr = [] }
            return (
              <div key={h.id} className={`card relative overflow-hidden transition-all hover:border-slate-600 ${!h.activa ? 'opacity-50' : ''}`}>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium absolute top-3 right-3 ${ESTADO_COLORS[h.estado] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                  {(h.estado || 'SIN ESTADO').replace(/_/g,' ')}
                </span>
                <div className="mb-3">
                  <p className="text-3xl font-black text-brand-400">{h.numero}</p>
                  <p className="text-xs text-slate-500">Piso {h.piso} · {h.tipo || 'Sin tipo'}</p>
                </div>
                <div className="space-y-1 text-xs text-slate-400 mb-3">
                  <div className="flex justify-between"><span>Capacidad</span><span className="text-slate-300">{h.capacidad} pax</span></div>
                  <div className="flex justify-between">
                    <span>Precio</span>
                    <span className="text-emerald-400 font-semibold">
                      <PrecioDual monto={parseFloat(h.precio_base) || 0} size="xs" />
                    </span>
                  </div>
                  {h.precio_corporativo && (
                    <div className="flex justify-between"><span>Corp.</span><span className="text-brand-400"><PrecioDual monto={parseFloat(h.precio_corporativo) || 0} size="xs" /></span></div>
                  )}
                </div>
                {amenArr.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {amenArr.slice(0,4).map(a => {
                      const Icon = AMENIDAD_ICONS[a]
                      return Icon ? <Icon key={a} className="w-3.5 h-3.5 text-slate-500" title={a} />
                        : <span key={a} className="text-[9px] text-slate-600 bg-slate-700/50 px-1 rounded">{a.slice(0,3)}</span>
                    })}
                    {amenArr.length > 4 && <span className="text-[9px] text-slate-600">+{amenArr.length-4}</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(h)}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 transition-colors flex items-center justify-center gap-1">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => { setSelected(h); setNuevoEstado(h.estado); setShowEstado(true) }}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700/50 transition-colors">
                    Estado
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{form.id ? `Editar Hab. ${form.numero}` : 'Nueva Habitación'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="label">N° Habitación *</label>
                  <input value={form.numero} onChange={e => setForm(p=>({...p,numero:e.target.value}))}
                    className="input-field" placeholder="101" required disabled={!!form.id} />
                </div>
                <div>
                  <label className="label">Piso</label>
                  <input type="number" min="1" max="30" value={form.piso}
                    onChange={e => setForm(p=>({...p,piso:e.target.value}))} className="input-field" />
                </div>
                <div>
                  <label className="label">Tipo *</label>
                  <select value={form.tipo} onChange={e => {
                      const tipoElegido = tiposHabitacion.find(t => t.nombre === e.target.value)
                      setForm(p => ({
                        ...p,
                        tipo: e.target.value,
                        // Solo autocompletar si el campo está vacío (no pisar valores ya puestos al editar)
                        capacidad: p.capacidad || tipoElegido?.capacidad_sugerida || 2,
                        precio_base: p.precio_base || tipoElegido?.precio_sugerido || '',
                      }))
                    }} className="input-field" required>
                    <option value="">Seleccionar tipo...</option>
                    {tiposHabitacion.map(t => (
                      <option key={t.id} value={t.nombre}>{t.nombre} — L. {(parseFloat(t.precio_sugerido) || 0).toFixed(0)}/noche</option>
                    ))}
                  </select>
                  {tiposHabitacion.length === 0 && (
                    <p className="text-xs text-yellow-500 mt-1">No hay tipos configurados. Creálos en Configuración → Tipos de Habitación.</p>
                  )}
                </div>
                <div>
                  <label className="label">Capacidad</label>
                  <input type="number" min="1" max="10" value={form.capacidad}
                    onChange={e => setForm(p=>({...p,capacidad:e.target.value}))} className="input-field" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio Base / Noche *</label>
                  <MoneyInput
                    valueHNL={form.precio_base}
                    onChange={val => setForm(p => ({ ...p, precio_base: val }))}
                    placeholder="800.00"
                    required
                  />
                </div>
                <div>
                  <label className="label">Precio Corporativo</label>
                  <MoneyInput
                    valueHNL={form.precio_corporativo || ''}
                    onChange={val => setForm(p => ({ ...p, precio_corporativo: val }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea value={form.descripcion||''} rows={2}
                  onChange={e => setForm(p=>({...p,descripcion:e.target.value}))} className="input-field" placeholder="Vista al mar, esquinera..." />
              </div>
              <div>
                <label className="label mb-2 block">Amenidades incluidas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENIDADES_OPTS.map(a => {
                    const activa = form.amenidades.includes(a)
                    const Icon = AMENIDAD_ICONS[a]
                    return (
                      <button key={a} type="button" onClick={() => toggleAmenidad(a)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          activa ? 'bg-brand-600/20 border-brand-500/50 text-brand-300' : 'border-slate-600 text-slate-500 hover:border-slate-500'
                        }`}>
                        {activa ? <Check className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                          : Icon ? <Icon className="w-3.5 h-3.5 flex-shrink-0" /> : <span className="w-3.5" />}
                        <span className="text-xs">{a}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-700/40 rounded-lg cursor-pointer">
                <input type="checkbox" checked={form.activa===1||form.activa===true}
                  onChange={e => setForm(p=>({...p,activa:e.target.checked?1:0}))} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-300">Habitación activa en el sistema</span>
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">
                  <BedDouble className="w-4 h-4" /> {form.id ? 'Guardar Cambios' : 'Crear Habitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
      {showEstado && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Cambiar Estado — Hab. {selected.numero}</h2>
              <button onClick={() => setShowEstado(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-2">
              {ESTADOS.map(e => (
                <button key={e} onClick={() => setNuevoEstado(e)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                    nuevoEstado === e ? ESTADO_COLORS[e] : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    e==='DISPONIBLE'?'bg-emerald-400':e==='OCUPADA'?'bg-red-400':e==='RESERVADA'?'bg-blue-400':e==='BLOQUEADA'?'bg-slate-400':e==='SUCIA'?'bg-orange-400':'bg-violet-400'
                  }`} />
                  {e.replace(/_/g,' ')}
                  {e === selected.estado && <span className="ml-auto text-xs opacity-60">actual</span>}
                </button>
              ))}
              <div className="flex gap-3 pt-3">
                <button onClick={() => setShowEstado(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button onClick={cambiarEstado} className="btn-primary flex-1 justify-center">
                  <Check className="w-4 h-4" /> Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
