// src/pages/ReservasPage.jsx
import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, RefreshCw, X, UserPlus, Building2, Users } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import DateRangePicker from '../components/common/DateRangePicker'
import ModalNuevoHuesped from '../components/common/ModalNuevoHuesped'
import ModalNuevoClienteCorp from '../components/common/ModalNuevoClienteCorp'
import MoneyInput from '../components/common/MoneyInput'
import PrecioDual from '../components/common/PrecioDual'
import { useTasaCambio } from '../context/TasaCambioContext'

const ESTADOS_BADGE = {
  PENDIENTE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMADA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  GARANTIZADA: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  CHECKIN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CHECKOUT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  CANCELADA: 'bg-red-500/20 text-red-400 border-red-500/30',
  NO_SHOW: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const FORM_INIT = {
  huesped_id: '', habitacion_id: '', fecha_entrada: '', fecha_salida: '',
  adultos: 1, ninos: 0, tipo_garantia: 'EFECTIVO', monto_deposito: 0,
  motivo_visita: 'TURISMO', empresa: '', cliente_corporativo_id: '',
  tarifa_aplicada: '', moneda: 'HNL', tasa_cambio: 1, notas: '',
  // Nota: tarifa_aplicada y monto_deposito siempre quedan en HNL gracias a
  // MoneyInput, que convierte automáticamente si el usuario tipeó en USD.
}

export default function ReservasPage() {
  const { tasaVenta, tieneTasa } = useTasaCambio() || {}
  const [reservas, setReservas] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [clientesCorp, setClientesCorp] = useState([])
  const [tiposHabitacion, setTiposHabitacion] = useState([])
  const [tarifasCliente, setTarifasCliente] = useState([]) // tarifas especiales del cliente corp. seleccionado
  const [ocupadas, setOcupadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [showNuevoHuesped, setShowNuevoHuesped] = useState(false)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [modoHuesped, setModoHuesped] = useState('existente') // 'existente' | 'nuevo'
  const [huespedSeleccionado, setHuespedSeleccionado] = useState(null) // objeto completo cuando es nuevo recién creado

  const [form, setForm] = useState(FORM_INIT)

  const cargar = async () => {
    setLoading(true)
    try {
      const [r, h, hab, cc, tipos] = await Promise.all([
        api.get('/reservas', { params: { estado: filtroEstado, limit: 100 } }),
        api.get('/huespedes', { params: { limit: 200 } }),
        api.get('/habitaciones', { params: { estado: 'DISPONIBLE' } }),
        api.get('/clientes'),
        api.get('/tipos-habitacion'),
      ])
      setReservas(r.data.data || [])
      setHuespedes(h.data.data || [])
      setHabitaciones(hab.data.data || [])
      setClientesCorp(cc.data.data || [])
      setTiposHabitacion(tipos.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroEstado])

  // Al elegir habitación, cargar fechas ocupadas para el calendario
  useEffect(() => {
    if (!form.habitacion_id) { setOcupadas([]); return }
    api.get(`/reservas/disponibilidad/${form.habitacion_id}`)
      .then(r => setOcupadas(r.data.data || []))
      .catch(() => setOcupadas([]))
  }, [form.habitacion_id])

  // Al elegir cliente corporativo, cargar sus tarifas especiales
  useEffect(() => {
    if (!form.cliente_corporativo_id) { setTarifasCliente([]); return }
    api.get(`/tipos-habitacion/tarifas-cliente/${form.cliente_corporativo_id}`)
      .then(r => setTarifasCliente(r.data.data || []))
      .catch(() => setTarifasCliente([]))
  }, [form.cliente_corporativo_id])

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar esta reserva?')) return
    await api.delete(`/reservas/${id}`)
    toast.success('Reserva cancelada')
    cargar()
  }

  const abrirNueva = () => {
    setForm(FORM_INIT)
    setModoHuesped('existente')
    setHuespedSeleccionado(null)
    setShowModal(true)
  }

  const onHuespedCreado = (huesped) => {
    setHuespedSeleccionado(huesped)
    setForm(p => ({ ...p, huesped_id: huesped.id, empresa: huesped.empresa || p.empresa }))
    setShowNuevoHuesped(false)
    setModoHuesped('existente') // ya queda seleccionado como "existente" tras crearse
  }

  const onClienteCreado = (cliente) => {
    setClientesCorp(prev => [...prev, cliente])
    setForm(p => ({ ...p, cliente_corporativo_id: cliente.id, empresa: cliente.razon_social }))
    setShowNuevoCliente(false)
    toast.success(`${cliente.razon_social} asociado a la reserva`)
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.fecha_entrada || !form.fecha_salida) {
      return toast.error('Seleccioná las fechas de entrada y salida en el calendario')
    }
    if (!form.habitacion_id) return toast.error('Seleccioná una habitación')
    if (!form.huesped_id) return toast.error('Seleccioná o registrá un huésped')

    try {
      await api.post('/reservas', form)
      toast.success('Reserva creada exitosamente')
      setShowModal(false)
      setForm(FORM_INIT)
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }

  const filtradas = reservas.filter(r =>
    !busqueda || r.huesped_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.codigo?.includes(busqueda) || r.habitacion_numero?.includes(busqueda)
  )

  const selHab = habitaciones.find(h => h.id == form.habitacion_id)
  useEffect(() => {
    if (selHab && !form.tarifa_aplicada) setForm(p => ({ ...p, tarifa_aplicada: selHab.precio_base }))
  }, [form.habitacion_id])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reservas</h1>
        <button onClick={abrirNueva} className="btn-primary">
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
      <div className="card p-0 overflow-x-auto">
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
                <td className="table-cell font-semibold text-slate-200"><PrecioDual monto={r.total_estimado || 0} size="sm" /></td>
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

      {/* Modal Nueva Reserva */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Nueva Reserva</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-5">

              {/* ── Sección Huésped ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Huésped *</label>
                  <div className="flex gap-1 bg-slate-900/50 rounded-lg p-0.5">
                    <button type="button" onClick={() => setModoHuesped('existente')}
                      className={`text-xs px-3 py-1 rounded-md transition-all ${modoHuesped === 'existente' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>
                      Existente
                    </button>
                    <button type="button" onClick={() => { setModoHuesped('nuevo'); setShowNuevoHuesped(true) }}
                      className={`text-xs px-3 py-1 rounded-md transition-all flex items-center gap-1 ${modoHuesped === 'nuevo' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>
                      <UserPlus className="w-3 h-3" /> Nuevo
                    </button>
                  </div>
                </div>

                {huespedSeleccionado ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-medium">{huespedSeleccionado.nombre_completo}</span>
                      <span className="text-xs text-slate-500">— recién registrado</span>
                    </div>
                    <button type="button" onClick={() => { setHuespedSeleccionado(null); setForm(p => ({ ...p, huesped_id: '' })) }}
                      className="text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select value={form.huesped_id} onChange={e => setForm(p => ({ ...p, huesped_id: e.target.value }))} className="input-field" required>
                    <option value="">Seleccionar huésped...</option>
                    {huespedes.map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos} — {h.numero_doc}</option>)}
                  </select>
                )}
              </div>

              {/* ── Sección Cliente Corporativo (opcional) ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Cliente Corporativo (opcional)</label>
                  <button type="button" onClick={() => setShowNuevoCliente(true)}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Nuevo cliente
                  </button>
                </div>
                <select value={form.cliente_corporativo_id}
                  onChange={e => {
                    const cc = clientesCorp.find(c => c.id == e.target.value)
                    setForm(p => ({ ...p, cliente_corporativo_id: e.target.value, empresa: cc?.razon_social || p.empresa }))
                  }}
                  className="input-field">
                  <option value="">Sin empresa asociada</option>
                  {clientesCorp.map(c => <option key={c.id} value={c.id}>{c.razon_social} — RTN {c.rtn}</option>)}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Habitación *</label>
                  <select value={form.habitacion_id} onChange={e => setForm(p => ({ ...p, habitacion_id: e.target.value, tarifa_aplicada: '', fecha_entrada: '', fecha_salida: '' }))} className="input-field" required>
                    <option value="">Seleccionar habitación...</option>
                    {habitaciones.map(h => <option key={h.id} value={h.id}>#{h.numero} — {h.tipo} — L. {h.precio_base}/noche</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fechas (Entrada → Salida) *</label>
                  <DateRangePicker
                    fechaEntrada={form.fecha_entrada}
                    fechaSalida={form.fecha_salida}
                    ocupadas={ocupadas}
                    disabled={!form.habitacion_id}
                    onChange={({ fecha_entrada, fecha_salida }) => setForm(p => ({ ...p, fecha_entrada, fecha_salida }))}
                  />
                  {!form.habitacion_id && <p className="text-xs text-slate-600 mt-1">Elegí primero una habitación</p>}
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
                  <label className="label">Tarifa/Noche *</label>
                  <MoneyInput
                    valueHNL={form.tarifa_aplicada}
                    onChange={val => setForm(p => ({ ...p, tarifa_aplicada: val }))}
                    required
                  />
                  {(() => {
                    const tipoHab = tiposHabitacion.find(t => t.nombre === selHab?.tipo)
                    const tarifaEspecial = tarifasCliente.find(t => t.tipo_habitacion_id === tipoHab?.id)
                    const opciones = []
                    if (tipoHab) {
                      opciones.push({ label: 'Normal', valor: tipoHab.precio_sugerido })
                      if (tipoHab.precio_10 != null) opciones.push({ label: '10% off', valor: tipoHab.precio_10 })
                      if (tipoHab.precio_15 != null) opciones.push({ label: '15% off', valor: tipoHab.precio_15 })
                      if (tipoHab.precio_20 != null) opciones.push({ label: '20% off', valor: tipoHab.precio_20 })
                    }
                    if (tarifaEspecial) opciones.push({ label: form.empresa || 'Especial', valor: tarifaEspecial.precio, destacado: true })

                    if (opciones.length === 0) return null
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {opciones.map((op, i) => (
                          <button key={i} type="button"
                            onClick={() => setForm(p => ({ ...p, tarifa_aplicada: op.valor }))}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                              op.destacado
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                            }`}>
                            {op.label}: <PrecioDual monto={op.valor} size="xs" />
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <label className="label">Tipo de Garantía</label>
                  <select value={form.tipo_garantia} onChange={e => setForm(p=>({...p,tipo_garantia:e.target.value}))} className="input-field">
                    {['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO_EMPRESA','VOUCHER'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Depósito</label>
                  <MoneyInput
                    valueHNL={form.monto_deposito}
                    onChange={val => setForm(p => ({ ...p, monto_deposito: val }))}
                  />
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

      {/* Ventana independiente: Nuevo Huésped */}
      {showNuevoHuesped && (
        <ModalNuevoHuesped
          onClose={() => { setShowNuevoHuesped(false); setModoHuesped('existente') }}
          onCreated={onHuespedCreado}
        />
      )}

      {/* Ventana independiente: Nuevo Cliente Corporativo */}
      {showNuevoCliente && (
        <ModalNuevoClienteCorp
          onClose={() => setShowNuevoCliente(false)}
          onCreated={onClienteCreado}
        />
      )}
    </div>
  )
}
