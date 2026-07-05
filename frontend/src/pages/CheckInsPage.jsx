// src/pages/CheckInsPage.jsx - Gestión de check-ins activos y check-outs
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogIn, LogOut, Plus, DollarSign, X, FileText, Printer, UserPlus } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import ModalNuevoHuesped from '../components/common/ModalNuevoHuesped'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

export default function CheckInsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activos, setActivos] = useState([])
  const [reservasListas, setReservasListas] = useState([])
  const [habitacionesDisp, setHabitacionesDisp] = useState([])
  const [selected, setSelected] = useState(null)
  const [extras, setExtras] = useState([])

  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [showNuevoHuesped, setShowNuevoHuesped] = useState(false)

  // Modo del modal de check-in: 'reserva' usa una reserva ya confirmada,
  // 'directo' crea reserva + check-in de una sola vez (walk-in)
  const [modoCheckin, setModoCheckin] = useState('reserva')
  const [reservaId, setReservaId] = useState('')
  const [directoForm, setDirectoForm] = useState({
    huesped_id: '', habitacion_id: '', noches: 1, tarifa_aplicada: '', tipo_garantia: 'EFECTIVO',
  })
  const [huespedSeleccionado, setHuespedSeleccionado] = useState(null)

  const [extraForm, setExtraForm] = useState({ descripcion:'', cantidad:1, precio_unitario:'', categoria:'OTROS' })
  const [loading, setLoading] = useState(true)
  const [facturaCheckout, setFacturaCheckout] = useState(null)
  const [showHojaRecepcion, setShowHojaRecepcion] = useState(false)
  const [hojaDetalle, setHojaDetalle] = useState(null)
  const [autoPrintHoja, setAutoPrintHoja] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const [a, r, hab] = await Promise.all([
        api.get('/checkins/activos'),
        api.get('/reservas', { params: { estado: 'CONFIRMADA', limit: 100 } }),
        api.get('/habitaciones', { params: { estado: 'DISPONIBLE' } }),
      ])
      setActivos(a.data.data || [])
      setReservasListas(r.data.data || [])
      setHabitacionesDisp(hab.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  // Si llegamos desde Planning con una reserva específica (click en "Check-In"
  // sobre una habitación Reservada/Garantizada), abrir el modal directamente
  // con esa reserva ya preseleccionada — sin tener que buscarla en el dropdown.
  useEffect(() => {
    const reservaDesdeP = location.state?.preseleccionarReservaId
    if (!reservaDesdeP || loading) return

    const preseleccionar = async () => {
      try {
        // Traer la reserva específica por si no está en los primeros 100
        // resultados de reservasListas, y garantizar que aparezca en el select.
        const r = await api.get(`/reservas/${reservaDesdeP}`)
        const reserva = r.data.data
        if (reserva) {
          setReservasListas(prev =>
            prev.some(x => x.id === reserva.id) ? prev : [reserva, ...prev]
          )
        }
      } catch { /* si falla el fetch puntual, igual queda preseleccionado por id */ }

      setModoCheckin('reserva')
      setReservaId(String(reservaDesdeP))
      setShowCheckinModal(true)
      // Limpiar el state de navegación para que un refresh no vuelva a abrir el modal
      navigate(location.pathname, { replace: true, state: {} })
    }
    preseleccionar()
  }, [location.state, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarExtras = async (checkinId) => {
    const r = await api.get(`/checkins/${checkinId}/extras`)
    setExtras(r.data.data || [])
  }

  const selectCheckin = async (c) => {
    setSelected(c)
    await cargarExtras(c.id)
  }

  const abrirHojaRecepcion = async (checkinId, auto = false) => {
    const r = await api.get(`/checkins/${checkinId}`)
    setHojaDetalle(r.data.data)
    setAutoPrintHoja(auto)
    setShowHojaRecepcion(true)
  }

  const abrirNuevoCheckin = () => {
    setModoCheckin('reserva')
    setReservaId('')
    setDirectoForm({ huesped_id: '', habitacion_id: '', noches: 1, tarifa_aplicada: '', tipo_garantia: 'EFECTIVO' })
    setHuespedSeleccionado(null)
    setShowCheckinModal(true)
  }

  // Check-in a partir de una reserva confirmada existente
  const doCheckinDesdeReserva = async (e) => {
    e.preventDefault()
    if (!reservaId) return toast.error('Seleccioná una reserva')
    try {
      const r = await api.post('/checkins', { reserva_id: reservaId })
      toast.success('Check-in realizado exitosamente 🎉')
      setShowCheckinModal(false)
      await abrirHojaRecepcion(r.data.data.checkin_id, true)
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }

  // Check-in directo (walk-in): crea la reserva del día y el check-in en un solo paso
  const doCheckinDirecto = async (e) => {
    e.preventDefault()
    const { huesped_id, habitacion_id, noches, tarifa_aplicada, tipo_garantia } = directoForm
    if (!huesped_id) return toast.error('Seleccioná o registrá un huésped')
    if (!habitacion_id) return toast.error('Seleccioná una habitación')
    if (!tarifa_aplicada) return toast.error('Indicá la tarifa por noche')

    try {
      const hoy = new Date()
      const salida = new Date(hoy)
      salida.setDate(salida.getDate() + (parseInt(noches) || 1))
      const fecha_entrada = hoy.toISOString().split('T')[0]
      const fecha_salida = salida.toISOString().split('T')[0]

      const rRes = await api.post('/reservas', {
        huesped_id, habitacion_id, fecha_entrada, fecha_salida,
        tarifa_aplicada, tipo_garantia, origen: 'MOSTRADOR',
      })
      const rCheckin = await api.post('/checkins', { reserva_id: rRes.data.data.id })
      toast.success('Check-in directo realizado exitosamente 🎉')
      setShowCheckinModal(false)
      await abrirHojaRecepcion(rCheckin.data.data.checkin_id, true)
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }

  const onHuespedCreadoDirecto = (huesped) => {
    setHuespedSeleccionado(huesped)
    setDirectoForm(p => ({ ...p, huesped_id: huesped.id }))
    setShowNuevoHuesped(false)
  }

  const doCheckout = async (checkin) => {
    if (!confirm(`¿Confirmar check-out de ${checkin.huesped_nombre}?`)) return
    try {
      const r = await api.post(`/checkins/${checkin.id}/checkout`, {
        metodo_pago: 'EFECTIVO',
        generar_factura: true,
      })
      if (r.data.data?.factura_generada) {
        const msg = r.data.data?.factura_reutilizada
          ? `✅ Check-out completado. Se usó la factura ya emitida ${r.data.data.numero_factura}.`
          : `✅ Check-out completado. Factura ${r.data.data.numero_factura} generada.`
        toast.success(msg)
        setFacturaCheckout(r.data.data)
      } else {
        toast.success('Check-out completado. Habitación enviada a limpieza.')
        toast('⚠️ Sin factura: configure el CAI en Configuración → SAR', { icon: '⚠️' })
      }
      setSelected(null)
      cargar()
    } catch(e) {
      toast.error(e.response?.data?.error || 'Error al hacer check-out')
    }
  }

  // Agregar o quitar una noche de la estadía activa (ajusta el check-out
  // previsto del folio, con validación de traslape en el backend).
  const cambiarNoches = async (delta) => {
    if (!selected?.fecha_checkout_prevista) return
    const actual = new Date(selected.fecha_checkout_prevista.split(' ')[0].split('T')[0])
    actual.setDate(actual.getDate() + delta)
    const nuevaFecha = actual.toISOString().split('T')[0]
    try {
      await api.patch(`/checkins/${selected.id}/fecha-salida`, { fecha_checkout_prevista: nuevaFecha })
      toast.success(delta > 0 ? 'Noche agregada' : 'Noche quitada')
      setSelected(prev => prev ? { ...prev, fecha_checkout_prevista: nuevaFecha } : prev)
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }

  const agregarExtra = async (e) => {
    e.preventDefault()
    await api.post(`/checkins/${selected.id}/extras`, extraForm)
    toast.success('Servicio agregado al folio')
    setShowExtraModal(false)
    setExtraForm({ descripcion:'', cantidad:1, precio_unitario:'', categoria:'OTROS' })
    await cargarExtras(selected.id)
  }

  const selHabDirecto = habitacionesDisp.find(h => h.id == directoForm.habitacion_id)
  useEffect(() => {
    if (selHabDirecto && !directoForm.tarifa_aplicada) {
      setDirectoForm(p => ({ ...p, tarifa_aplicada: selHabDirecto.precio_base }))
    }
  }, [directoForm.habitacion_id])

  return (
    <div className="flex gap-5 min-h-0">
      {/* Lista de check-ins activos */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Check-In / Check-Out</h1>
          <button onClick={abrirNuevoCheckin} className="btn-primary">
            <LogIn className="w-4 h-4" /> Nuevo Check-In
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="card text-center py-12 text-slate-600">Cargando...</div>
          ) : activos.length === 0 ? (
            <div className="card text-center py-16 text-slate-600">
              <LogIn className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay check-ins activos en este momento</p>
            </div>
          ) : activos.map(c => (
            <div key={c.id}
              onClick={() => selectCheckin(c)}
              className={`card cursor-pointer transition-all hover:border-brand-500/50 ${selected?.id === c.id ? 'border-brand-500/50 bg-slate-700/50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
                    <span className="text-brand-400 font-bold text-sm">{c.numero}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{c.huesped_nombre}</p>
                    <p className="text-xs text-slate-500">Hab. {c.numero} · {c.tipo} · Piso {c.piso}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-400"><PrecioDual monto={(c.tarifa_aplicada || 0) + (c.total_extras || 0)} size="sm" /></p>
                  <p className="text-xs text-slate-500">Sale: {c.fecha_checkout_prevista?.split(' ')[0]}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de detalle */}
      {selected && (
        <div className="w-96 flex-shrink-0 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">Folio — Hab. {selected.numero}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-slate-500">Huésped</span><span className="text-slate-200">{selected.huesped_nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Teléfono</span><span className="text-slate-200">{selected.telefono || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Empresa</span><span className="text-slate-200">{selected.empresa || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Garantía</span><span className="text-slate-200">{selected.tipo_garantia}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Check-in</span><span className="text-slate-200">{selected.fecha_checkin?.split(' ')[0]}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Check-out</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => cambiarNoches(-1)} title="Quitar 1 noche"
                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 hover:bg-red-600/40 text-slate-300 text-sm leading-none">−</button>
                  <span className="text-brand-400 font-medium">{selected.fecha_checkout_prevista?.split(' ')[0]}</span>
                  <button type="button" onClick={() => cambiarNoches(1)} title="Agregar 1 noche"
                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 hover:bg-emerald-600/40 text-slate-300 text-sm leading-none">+</button>
                </div>
              </div>
            </div>

            {/* Extras del folio */}
            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Servicios Extra</h4>
                <button onClick={() => setShowExtraModal(true)} className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              <div className="space-y-1.5">
                {extras.map(e => (
                  <div key={e.id} className="flex justify-between text-xs">
                    <span className="text-slate-400">{e.descripcion} x{e.cantidad}</span>
                    <span className="text-slate-300"><PrecioDual monto={e.subtotal} size="xs" /></span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-slate-700/50">
                  <span className="text-slate-400">Total Extras</span>
                  <span className="text-slate-300"><PrecioDual monto={extras.reduce((s, e) => s + e.subtotal, 0)} size="xs" /></span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-brand-600/10 border border-brand-500/20 rounded-lg p-3 mt-4">
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">TOTAL FOLIO</span>
                <span className="text-brand-400 text-lg"><PrecioDual monto={(selected.cargo_habitacion || 0) + extras.reduce((s,e)=>s+e.subtotal,0)} size="lg" /></span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => abrirHojaRecepcion(selected.id)} className="btn-secondary flex-1 justify-center">
                <Printer className="w-4 h-4" /> Hoja Recepción
              </button>
              <button onClick={() => doCheckout(selected)} className="btn-danger flex-1 justify-center">
                <LogOut className="w-4 h-4" /> Check-Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-In — ventana independiente con dos modos */}
      {showCheckinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Realizar Check-In</h2>
              <button onClick={() => setShowCheckinModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            {/* Selector de modo */}
            <div className="px-6 pt-4">
              <div className="flex gap-1 bg-slate-900/50 rounded-lg p-1">
                <button onClick={() => setModoCheckin('reserva')}
                  className={`flex-1 text-xs py-2 rounded-md transition-all ${modoCheckin === 'reserva' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>
                  Desde Reserva
                </button>
                <button onClick={() => setModoCheckin('directo')}
                  className={`flex-1 text-xs py-2 rounded-md transition-all ${modoCheckin === 'directo' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>
                  Walk-In Directo
                </button>
              </div>
            </div>

            {modoCheckin === 'reserva' ? (
              <form onSubmit={doCheckinDesdeReserva} className="p-6 space-y-4">
                <div>
                  <label className="label">Reserva Confirmada *</label>
                  <select value={reservaId} onChange={e => setReservaId(e.target.value)} className="input-field" required>
                    <option value="">Seleccionar reserva...</option>
                    {reservasListas.map(r => (
                      <option key={r.id} value={r.id}>{r.codigo} — {r.huesped_nombre} — Hab. {r.habitacion_numero} — {r.fecha_entrada}</option>
                    ))}
                  </select>
                </div>
                {reservasListas.length === 0 && <p className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">No hay reservas confirmadas pendientes. Probá con "Walk-In Directo".</p>}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowCheckinModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-success"><LogIn className="w-4 h-4" /> Check-In</button>
                </div>
              </form>
            ) : (
              <form onSubmit={doCheckinDirecto} className="p-6 space-y-4">
                <p className="text-xs text-slate-500 -mt-1">Crea la reserva y el check-in en un solo paso (huésped sin reserva previa)</p>

                {/* Huésped */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Huésped *</label>
                    <button type="button" onClick={() => setShowNuevoHuesped(true)}
                      className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                      <UserPlus className="w-3 h-3" /> Nuevo
                    </button>
                  </div>
                  {huespedSeleccionado ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                      <span className="text-sm text-emerald-300">{huespedSeleccionado.nombre_completo}</span>
                      <button type="button" onClick={() => { setHuespedSeleccionado(null); setDirectoForm(p => ({...p, huesped_id:''})) }}>
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <input value={directoForm.huesped_id} onChange={() => {}} placeholder="Usá el botón 'Nuevo' para registrar al huésped"
                      className="input-field text-slate-500" readOnly />
                  )}
                </div>

                <div>
                  <label className="label">Habitación *</label>
                  <select value={directoForm.habitacion_id} onChange={e => setDirectoForm(p => ({ ...p, habitacion_id: e.target.value, tarifa_aplicada: '' }))} className="input-field" required>
                    <option value="">Seleccionar habitación disponible...</option>
                    {habitacionesDisp.map(h => <option key={h.id} value={h.id}>#{h.numero} — {h.tipo} — L. {h.precio_base}/noche</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Noches</label>
                    <input type="number" min="1" value={directoForm.noches} onChange={e => setDirectoForm(p => ({ ...p, noches: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Tarifa/Noche *</label>
                    <MoneyInput valueHNL={directoForm.tarifa_aplicada} onChange={val => setDirectoForm(p => ({ ...p, tarifa_aplicada: val }))} required />
                  </div>
                </div>

                <div>
                  <label className="label">Tipo de Garantía</label>
                  <select value={directoForm.tipo_garantia} onChange={e => setDirectoForm(p => ({ ...p, tipo_garantia: e.target.value }))} className="input-field">
                    {['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO_EMPRESA','VOUCHER'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowCheckinModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-success"><LogIn className="w-4 h-4" /> Crear y Check-In</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Ventana independiente: Nuevo Huésped (usado desde Walk-In Directo) */}
      {showNuevoHuesped && (
        <ModalNuevoHuesped
          onClose={() => setShowNuevoHuesped(false)}
          onCreated={onHuespedCreadoDirecto}
        />
      )}

      {/* Modal Extra */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Agregar Servicio</h2>
              <button onClick={() => setShowExtraModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={agregarExtra} className="p-6 space-y-4">
              <div><label className="label">Descripción *</label><input value={extraForm.descripcion} onChange={e=>setExtraForm(p=>({...p,descripcion:e.target.value}))} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Cantidad</label><input type="number" min="1" value={extraForm.cantidad} onChange={e=>setExtraForm(p=>({...p,cantidad:e.target.value}))} className="input-field" /></div>
                <div><label className="label">Precio Unit.</label><MoneyInput valueHNL={extraForm.precio_unitario} onChange={val => setExtraForm(p=>({...p,precio_unitario:val}))} required /></div>
              </div>
              <div><label className="label">Categoría</label>
                <select value={extraForm.categoria} onChange={e=>setExtraForm(p=>({...p,categoria:e.target.value}))} className="input-field">
                  {['MINIBAR','RESTAURANTE','LAVANDERIA','TELEFONO','TRANSPORTE','OTROS'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-500 bg-slate-900/50 rounded-lg px-3 py-2">
                💡 Estos servicios se facturan con ISV 15%. El hospedaje se factura aparte con ISV 15% + Impuesto Turístico 4%.
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowExtraModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><DollarSign className="w-4 h-4" /> Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Factura generada en checkout */}
      {facturaCheckout && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Factura Generada</h3>
                <p className="text-slate-400 text-sm">Check-out completado exitosamente</p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Número de Factura</span>
                <span className="text-white font-mono font-semibold">{facturaCheckout.numero_factura}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { window.location.href = '/facturas'; setFacturaCheckout(null) }}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Ir a Facturas
              </button>
              <button
                onClick={() => setFacturaCheckout(null)}
                className="flex-1 btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Hoja de Recepción imprimible (formato Hotel Las Cascadas) */}
      {showHojaRecepcion && hojaDetalle && (
        <HojaRecepcionModal
          detalle={hojaDetalle}
          autoPrint={autoPrintHoja}
          onClose={() => { setShowHojaRecepcion(false); setAutoPrintHoja(false) }}
        />
      )}
    </div>
  )
}

// ─── Hoja de Recepción — formato basado en hoja física de referencia ──────────
function HojaRecepcionModal({ detalle, onClose, autoPrint = false }) {
  const handlePrint = () => {
    const el = document.getElementById('hoja-recepcion-print')
    const win = window.open('', '_blank', 'width=850,height=1000')
    win.document.write(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Recepción - Hab. ${detalle.numero}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color:#111; }
        table { width:100%; border-collapse:collapse; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head>
      <body>${el.innerHTML}</body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 350)
  }

  // Recién hecho el check-in: imprimir la hoja de recepción automáticamente,
  // sin que el recepcionista tenga que buscarla y darle clic a "Imprimir".
  // El modal igual queda abierto por si necesita reimprimir o revisar algo.
  useEffect(() => {
    if (autoPrint) handlePrint()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const h = detalle.hotel || {}
  const fechaImpresion = new Date()
  const horaCheckin = h.hora_checkin || '15:00'
  const horaCheckout = h.hora_checkout || '12:00'
  const recargo = h.recargo_hora_porcentaje || '10'

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b rounded-t-xl flex-shrink-0">
          <span className="font-semibold text-gray-700 text-sm">Hoja de Recepción — Hab. {detalle.numero}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300">
              <X className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 bg-gray-100 p-4">
          <div id="hoja-recepcion-print" style={{maxWidth:'750px',margin:'0 auto',padding:'24px 28px',background:'#fff',fontFamily:'Arial,Helvetica,sans-serif',fontSize:'11px',color:'#111'}}>

            {/* Encabezado */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div style={{fontSize:'16px',fontWeight:900,letterSpacing:'0.5px'}}>{h.hotel_nombre || 'HOTEL'}</div>
              <div style={{textAlign:'right',fontSize:'10px',color:'#555'}}>
                <div>{fechaImpresion.toLocaleDateString('es-HN')} Pág. 0001</div>
                <div>{fechaImpresion.toLocaleTimeString('es-HN')}</div>
              </div>
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <div style={{fontSize:'10px',color:'#555'}}>Fecha: {detalle.fecha_checkin?.split(' ')[0]} {detalle.fecha_checkin?.split(' ')[1]?.slice(0,8)}</div>
              <div style={{fontSize:'14px',fontWeight:700}}>Recepción N° {String(detalle.id).padStart(9,'0')}</div>
            </div>

            {/* Tabla de habitación */}
            <table style={{border:'1px solid #999',marginBottom:'10px'}}>
              <thead>
                <tr style={{background:'#f3f4f6'}}>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Habitación<br/><span style={{fontWeight:400}}>Room</span></th>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Tipo Habitación<br/><span style={{fontWeight:400}}>Room type</span></th>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Tipo Tarifa<br/><span style={{fontWeight:400}}>Rate</span></th>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Fecha Entrada<br/><span style={{fontWeight:400}}>Date of arrival</span></th>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Fecha Salida<br/><span style={{fontWeight:400}}>Date of Departure</span></th>
                  <th style={{border:'1px solid #999',padding:'4px',fontSize:'9px'}}>Recepcionista</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center',fontWeight:700,fontSize:'13px'}}>{detalle.numero}</td>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center'}}>{detalle.tipo}</td>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center'}}>{detalle.moneda === 'USD' ? 'TARIFUSD' : 'TARIF20'}</td>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center'}}>{detalle.fecha_entrada}</td>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center'}}>{detalle.fecha_checkout_prevista?.split(' ')[0]}</td>
                  <td style={{border:'1px solid #999',padding:'8px',textAlign:'center'}}>{detalle.atendido_por || '—'}</td>
                </tr>
              </tbody>
            </table>

            {/* Datos del huésped */}
            <div style={{lineHeight:'1.9',fontSize:'10.5px',marginBottom:'10px'}}>
              <div><strong>C. I. / Passport:</strong> {detalle.numero_doc}</div>
              <div><strong>Huésped/Full Name:</strong> {detalle.nombres} {detalle.apellidos}</div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span><strong>País/Country:</strong> {detalle.pais || 'HONDURAS'}</span>
                <span><strong>Dirección/Home Address:</strong> {detalle.direccion || detalle.ciudad || '—'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span><strong>Teléfonos/Phones:</strong> {detalle.telefono || '—'}</span>
                <span><strong>Profesión/Profession:</strong> {detalle.cargo || '—'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span><strong>Nacionalidad/Nationality:</strong> {detalle.nacionalidad}</span>
                <span><strong>Procedencia/Coming from:</strong> —</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span><strong>Fecha de Nac./Birth Date:</strong> —</span>
                <span><strong>Destino/Destination:</strong> —</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span><strong>Estado Civil/Marital Status:</strong> —</span>
                <span><strong>Grupo/Group:</strong> {detalle.adultos} adulto(s){detalle.ninos ? `, ${detalle.ninos} niño(s)` : ''}</span>
              </div>
            </div>

            <div style={{border:'1px solid #999',padding:'4px 8px',marginBottom:'10px',fontSize:'10px'}}>
              <strong>C.I. / Passport N°</strong> &nbsp; <span style={{color:'#888'}}>Nombre del Acompañante / Full name</span>
            </div>

            <div style={{fontSize:'10px',marginBottom:'10px'}}>
              <strong>Observaciones:</strong> {detalle.empresa ? `${detalle.empresa} / ` : ''}{detalle.codigo} {detalle.motivo_visita ? `/ ${detalle.motivo_visita}` : ''}
            </div>

            {/* Normas y condiciones */}
            <div style={{fontSize:'9.5px',lineHeight:'1.7',marginBottom:'14px'}}>
              <p style={{fontWeight:700,marginBottom:'4px'}}>Normas y Condiciones:</p>
              <p style={{fontWeight:700}}>- Hora de Entrada (Check-in): {horaCheckin} - Hora de Salida (Check-out): {horaCheckout}</p>
              <p style={{fontWeight:700,marginBottom:'6px'}}>Cualquier entrada antes de la hora estipulada o salida posterior tendrá un recargo que equivale al {recargo}% por cada hora o fracción de hora.</p>
              <p>* El dinero, prendas y otros valores deben ser depositados en las cajas de seguridad de su habitación.</p>
              <p>* En Honduras, la Ley Especial para el Control del Tabaco prohíbe fumar en todos los espacios públicos cerrados y semicerrados. En el hotel, es prohibido fumar dentro de las habitaciones y de todos los espacios públicos cerrados y abiertos. La violación a esta disposición es penalizada por $300.00 para cubrir los costos de limpieza y rehabilitación del espacio.</p>
              <p>* No atendemos check-in de menores de 18 años. Los menores de edad que se hospeden en la misma habitación con sus padres deben presentar su respectiva acta de nacimiento.</p>
              <p style={{marginTop:'4px'}}>* Recomendamos a nuestros huéspedes resguardar su dinero y cualquier objeto de valor en las cajas de seguridad de sus habitaciones. El hotel no se hace responsable de daños o pérdidas de dinero y objetos de valor olvidados en las instalaciones y habitación.</p>
            </div>

            {/* Firma */}
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
              <div style={{textAlign:'center',width:'220px'}}>
                <div style={{borderBottom:'1px solid #333',height:'34px'}} />
                <p style={{fontSize:'9.5px',marginTop:'2px'}}>Firma del Huésped / Signature</p>
              </div>
            </div>

            {/* Tabla de cargos */}
            <table style={{border:'1px solid #999'}}>
              <thead>
                <tr style={{background:'#f3f4f6'}}>
                  <th style={{border:'1px solid #999',padding:'5px',fontSize:'9.5px',width:'15%'}}>Fecha</th>
                  <th style={{border:'1px solid #999',padding:'5px',fontSize:'9.5px',width:'45%'}}>Descripción del Cargo</th>
                  <th style={{border:'1px solid #999',padding:'5px',fontSize:'9.5px',width:'15%'}}>Monto</th>
                  <th style={{border:'1px solid #999',padding:'5px',fontSize:'9.5px',width:'25%'}}>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {(detalle.extras || []).map((ex, i) => (
                  <tr key={i}>
                    <td style={{border:'1px solid #999',padding:'8px',fontSize:'9.5px'}}>{ex.fecha?.split(' ')[0]}</td>
                    <td style={{border:'1px solid #999',padding:'8px',fontSize:'9.5px'}}>{ex.descripcion} x{ex.cantidad}</td>
                    <td style={{border:'1px solid #999',padding:'8px',fontSize:'9.5px',textAlign:'right'}}>L. {Number(ex.subtotal).toFixed(2)}</td>
                    <td style={{border:'1px solid #999',padding:'8px',fontSize:'9.5px'}}></td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 6 - (detalle.extras?.length || 0)) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td style={{border:'1px solid #999',padding:'12px'}}></td>
                    <td style={{border:'1px solid #999',padding:'12px'}}></td>
                    <td style={{border:'1px solid #999',padding:'12px'}}></td>
                    <td style={{border:'1px solid #999',padding:'12px'}}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{textAlign:'center',fontSize:'10px',color:'#666',marginTop:'16px'}}>
              ● Uso Exclusivo {h.hotel_nombre || 'del Hotel'} ●
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
