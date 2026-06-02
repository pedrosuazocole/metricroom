// src/pages/CheckInsPage.jsx - Gestión de check-ins activos y check-outs
import { useState, useEffect } from 'react'
import { LogIn, LogOut, Plus, DollarSign, X, ChevronDown } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function CheckInsPage() {
  const [activos, setActivos] = useState([])
  const [reservasListas, setReservasListas] = useState([])
  const [selected, setSelected] = useState(null)
  const [extras, setExtras] = useState([])
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [reservaId, setReservaId] = useState('')
  const [extraForm, setExtraForm] = useState({ descripcion:'', cantidad:1, precio_unitario:'', categoria:'OTROS' })
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const [a, r] = await Promise.all([
        api.get('/checkins/activos'),
        api.get('/reservas', { params: { estado: 'CONFIRMADA', limit: 100 } }),
      ])
      setActivos(a.data.data || [])
      setReservasListas(r.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const cargarExtras = async (checkinId) => {
    const r = await api.get(`/checkins/${checkinId}/extras`)
    setExtras(r.data.data || [])
  }

  const selectCheckin = async (c) => {
    setSelected(c)
    await cargarExtras(c.id)
  }

  const doCheckin = async (e) => {
    e.preventDefault()
    await api.post('/checkins', { reserva_id: reservaId })
    toast.success('Check-in realizado exitosamente 🎉')
    setShowCheckinModal(false)
    setReservaId('')
    cargar()
  }

  const doCheckout = async (checkin) => {
    if (!confirm(`¿Confirmar check-out de ${checkin.huesped_nombre}?`)) return
    await api.post(`/checkins/${checkin.id}/checkout`)
    toast.success('Check-out completado. Habitación enviada a limpieza.')
    setSelected(null)
    cargar()
  }

  const agregarExtra = async (e) => {
    e.preventDefault()
    await api.post(`/checkins/${selected.id}/extras`, extraForm)
    toast.success('Servicio agregado al folio')
    setShowExtraModal(false)
    setExtraForm({ descripcion:'', cantidad:1, precio_unitario:'', categoria:'OTROS' })
    await cargarExtras(selected.id)
  }

  const calcularSaldo = (c) => {
    const noches = Math.max(1, Math.ceil((new Date(c.fecha_checkout_prevista) - new Date(c.fecha_checkin)) / 86400000))
    return (c.tarifa_aplicada * noches) + (extras.reduce((s, e) => s + e.subtotal, 0))
  }

  return (
    <div className="flex gap-5 min-h-0">
      {/* Lista de check-ins activos */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Check-In / Check-Out</h1>
          <button onClick={() => setShowCheckinModal(true)} className="btn-primary">
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
                  <p className="text-sm font-semibold text-brand-400">L. {((c.tarifa_aplicada || 0) + (c.total_extras || 0)).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
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
              <div className="flex justify-between"><span className="text-slate-500">Check-out</span><span className="text-brand-400 font-medium">{selected.fecha_checkout_prevista?.split(' ')[0]}</span></div>
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
                    <span className="text-slate-300">L. {e.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-slate-700/50">
                  <span className="text-slate-400">Total Extras</span>
                  <span className="text-slate-300">L. {extras.reduce((s, e) => s + e.subtotal, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-brand-600/10 border border-brand-500/20 rounded-lg p-3 mt-4">
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">TOTAL FOLIO</span>
                <span className="text-brand-400 text-lg">L. {(selected.cargo_habitacion + extras.reduce((s,e)=>s+e.subtotal,0)).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={() => doCheckout(selected)} className="btn-danger w-full justify-center mt-4">
              <LogOut className="w-4 h-4" /> Realizar Check-Out
            </button>
          </div>
        </div>
      )}

      {/* Modal Check-In */}
      {showCheckinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Realizar Check-In</h2>
              <button onClick={() => setShowCheckinModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={doCheckin} className="p-6 space-y-4">
              <div>
                <label className="label">Reserva Confirmada *</label>
                <select value={reservaId} onChange={e => setReservaId(e.target.value)} className="input-field" required>
                  <option value="">Seleccionar reserva...</option>
                  {reservasListas.map(r => (
                    <option key={r.id} value={r.id}>{r.codigo} — {r.huesped_nombre} — Hab. {r.habitacion_numero} — {r.fecha_entrada}</option>
                  ))}
                </select>
              </div>
              {reservasListas.length === 0 && <p className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">No hay reservas confirmadas pendientes de check-in</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCheckinModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-success"><LogIn className="w-4 h-4" /> Check-In</button>
              </div>
            </form>
          </div>
        </div>
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
                <div><label className="label">Precio Unit. (L.)</label><input type="number" step="0.01" value={extraForm.precio_unitario} onChange={e=>setExtraForm(p=>({...p,precio_unitario:e.target.value}))} className="input-field" required /></div>
              </div>
              <div><label className="label">Categoría</label>
                <select value={extraForm.categoria} onChange={e=>setExtraForm(p=>({...p,categoria:e.target.value}))} className="input-field">
                  {['MINIBAR','RESTAURANTE','LAVANDERIA','TELEFONO','TRANSPORTE','OTROS'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowExtraModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><DollarSign className="w-4 h-4" /> Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
