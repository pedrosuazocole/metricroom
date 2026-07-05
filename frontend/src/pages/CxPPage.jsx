// src/pages/CxPPage.jsx - Cuentas por Pagar
import { useState, useEffect } from 'react'
import { TrendingDown, Plus, X } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

export default function CxPPage() {
  const [cuentas, setCuentas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cuentasBancarias, setCuentasBancarias] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showPagarModal, setShowPagarModal] = useState(false)
  const [cuentaAPagar, setCuentaAPagar] = useState(null)
  const [pagoForm, setPagoForm] = useState({ metodo_pago: 'EFECTIVO', cuenta_bancaria_id: '' })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    proveedor_id: '', concepto: '', numero_factura_proveedor: '',
    monto_total: '', fecha_vencimiento: '', observaciones: ''
  })

  const cargar = async () => {
    setLoading(true)
    try {
      const [c, p, cb] = await Promise.all([
        api.get('/cuentas-pagar'),
        api.get('/proveedores'),
        api.get('/bancos/cuentas').catch(() => ({ data: { data: [] } })),
      ])
      setCuentas(c.data.data || [])
      setProveedores(p.data.data || [])
      setCuentasBancarias(cb.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const guardar = async (e) => {
    e.preventDefault()
    await api.post('/cuentas-pagar', form)
    toast.success('Cuenta por pagar registrada')
    setShowModal(false)
    setForm({ proveedor_id: '', concepto: '', numero_factura_proveedor: '', monto_total: '', fecha_vencimiento: '', observaciones: '' })
    cargar()
  }

  const abrirPagar = (cuenta) => {
    setCuentaAPagar(cuenta)
    setPagoForm({ metodo_pago: 'EFECTIVO', cuenta_bancaria_id: '' })
    setShowPagarModal(true)
  }

  const confirmarPago = async (e) => {
    e.preventDefault()
    if (pagoForm.metodo_pago === 'TRANSFERENCIA' && !pagoForm.cuenta_bancaria_id) {
      return toast.error('Seleccioná la cuenta bancaria desde la que se paga')
    }
    await api.patch(`/cuentas-pagar/${cuentaAPagar.id}/pagar`, pagoForm)
    toast.success('Cuenta marcada como pagada')
    setShowPagarModal(false)
    setCuentaAPagar(null)
    cargar()
  }

  const totalPendiente = cuentas.filter(c => c.estado === 'PENDIENTE').reduce((s, c) => s + parseFloat(c.monto_total || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Cuentas por Pagar</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar Factura
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Total Pendiente</p>
          <p className="text-2xl font-bold text-red-400"><PrecioDual monto={totalPendiente} size="xl" /></p>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Facturas Pendientes</p>
          <p className="text-2xl font-bold text-orange-400">{cuentas.filter(c => c.estado === 'PENDIENTE').length}</p>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto"><table className="w-full">
          <thead>
            <tr>
              {['Proveedor', 'Concepto', 'N° Factura', 'Vence', 'Monto', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-600">Cargando...</td></tr>
            ) : cuentas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-600">
                <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay cuentas por pagar registradas</p>
              </td></tr>
            ) : cuentas.map(c => {
              const vencido = new Date(c.fecha_vencimiento) < new Date() && c.estado === 'PENDIENTE'
              return (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-medium text-slate-200">{c.proveedor_nombre || '—'}</td>
                  <td className="table-cell text-slate-400 text-sm">{c.concepto}</td>
                  <td className="table-cell font-mono text-xs text-slate-400">{c.numero_factura_proveedor || '—'}</td>
                  <td className={`table-cell text-sm ${vencido ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                    {c.fecha_vencimiento?.split('T')[0]}
                    {vencido && <span className="text-xs block">VENCIDA</span>}
                  </td>
                  <td className="table-cell font-semibold text-slate-200"><PrecioDual monto={c.monto_total} size="sm" /></td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.estado === 'PAGADA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : vencido ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="table-cell">
                    {c.estado === 'PENDIENTE' && (
                      <button onClick={() => abrirPagar(c)} className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 rounded border border-emerald-500/30">
                        Pagado
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Registrar Factura de Proveedor</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div>
                <label className="label">Proveedor *</label>
                <select value={form.proveedor_id} onChange={e => setForm(p => ({ ...p, proveedor_id: e.target.value }))} className="input-field" required>
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Concepto *</label>
                <input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">N° Factura Proveedor</label>
                  <input value={form.numero_factura_proveedor} onChange={e => setForm(p => ({ ...p, numero_factura_proveedor: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Monto Total *</label>
                  <MoneyInput valueHNL={form.monto_total} onChange={val => setForm(p => ({ ...p, monto_total: val }))} required />
                </div>
                <div className="col-span-2">
                  <label className="label">Fecha de Vencimiento *</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} className="input-field" rows={2} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPagarModal && cuentaAPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Marcar como Pagada</h2>
              <button onClick={() => setShowPagarModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={confirmarPago} className="p-6 space-y-4">
              <div className="text-sm text-slate-400">
                <span className="text-slate-200 font-medium">{cuentaAPagar.proveedor_nombre}</span> — {cuentaAPagar.concepto}
                <div className="mt-1"><PrecioDual monto={cuentaAPagar.monto_total} size="sm" /></div>
              </div>
              <div>
                <label className="label">Método de Pago *</label>
                <select value={pagoForm.metodo_pago} onChange={e => setPagoForm(p => ({ ...p, metodo_pago: e.target.value }))} className="input-field">
                  {['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {pagoForm.metodo_pago === 'TRANSFERENCIA' && (
                <div>
                  <label className="label">Cuenta Bancaria * <span className="text-slate-500 font-normal">(de dónde sale el dinero)</span></label>
                  <select value={pagoForm.cuenta_bancaria_id} onChange={e => setPagoForm(p => ({ ...p, cuenta_bancaria_id: e.target.value }))} className="input-field" required>
                    <option value="">Seleccionar cuenta bancaria...</option>
                    {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.banco_nombre} — {c.numero_cuenta} ({c.moneda})</option>)}
                  </select>
                  {cuentasBancarias.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">No hay cuentas bancarias registradas. Creá una en el módulo Bancos.</p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPagarModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Confirmar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
