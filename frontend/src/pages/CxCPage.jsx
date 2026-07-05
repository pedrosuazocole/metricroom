// src/pages/CxCPage.jsx - Cuentas por Cobrar
import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, X, Plus } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

export default function CxCPage() {
  const [cuentas, setCuentas] = useState([])
  const [resumen, setResumen] = useState({})
  const [showAbono, setShowAbono] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [abono, setAbono] = useState({ monto: '', metodo_pago: 'EFECTIVO', observaciones: '' })
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await api.get('/cuentas-cobrar')
      setCuentas(r.data.data || [])
      setResumen(r.data.resumen || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abonar = async (e) => {
    e.preventDefault()
    await api.post(`/cuentas-cobrar/${selectedId}/abono`, abono)
    toast.success('Abono registrado')
    setShowAbono(false)
    setAbono({ monto: '', metodo_pago: 'EFECTIVO', observaciones: '' })
    cargar()
  }

  const diasVencimiento = (fecha) => {
    const diff = Math.floor((new Date() - new Date(fecha)) / 86400000)
    return diff
  }

  const colorVenc = (dias) => {
    if (dias <= 0) return 'text-emerald-400'
    if (dias <= 30) return 'text-yellow-400'
    if (dias <= 60) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Cuentas por Cobrar</h1>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Total por Cobrar</p>
          <p className="text-2xl font-bold text-white"><PrecioDual monto={resumen.total_pendiente || 0} size="xl" /></p>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Clientes con Saldo</p>
          <p className="text-2xl font-bold text-brand-400">{resumen.total_cuentas || 0}</p>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Saldo Vencido</p>
          <p className="text-2xl font-bold text-red-400"><PrecioDual monto={resumen.saldo_vencido || 0} size="xl" /></p>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-x-auto"><table className="w-full">
          <thead>
            <tr>
              {['Cliente / Concepto', 'Factura', 'Fecha', 'Días', 'Cargo', 'Abonado', 'Saldo', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-600">Cargando...</td></tr>
            ) : cuentas.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-slate-600">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay cuentas por cobrar pendientes</p>
              </td></tr>
            ) : cuentas.map(c => {
              const dias = diasVencimiento(c.fecha_vencimiento)
              return (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium text-slate-200">{c.cliente_nombre}</p>
                    <p className="text-xs text-slate-500">{c.concepto}</p>
                  </td>
                  <td className="table-cell font-mono text-xs text-brand-400">{c.numero_factura || '—'}</td>
                  <td className="table-cell text-slate-400 text-sm">{c.fecha_emision?.split('T')[0]}</td>
                  <td className={`table-cell text-sm font-medium ${colorVenc(dias)}`}>{dias > 0 ? `+${dias}d` : 'Vigente'}</td>
                  <td className="table-cell text-slate-300"><PrecioDual monto={c.monto_total} size="sm" /></td>
                  <td className="table-cell text-emerald-400"><PrecioDual monto={c.monto_abonado || 0} size="sm" /></td>
                  <td className="table-cell font-bold text-white"><PrecioDual monto={c.saldo_pendiente} size="sm" /></td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.estado === 'PAGADA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="table-cell">
                    {c.estado !== 'PAGADA' && (
                      <button onClick={() => { setSelectedId(c.id); setShowAbono(true) }}
                        className="text-brand-400 hover:text-brand-300 text-xs px-2 py-1 rounded border border-brand-500/30">
                        Abonar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAbono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Registrar Abono</h2>
              <button onClick={() => setShowAbono(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={abonar} className="p-6 space-y-4">
              <div>
                <label className="label">Monto del Abono *</label>
                <MoneyInput valueHNL={abono.monto} onChange={val => setAbono(p => ({ ...p, monto: val }))} required />
              </div>
              <div>
                <label className="label">Método de Pago</label>
                <select value={abono.metodo_pago} onChange={e => setAbono(p => ({ ...p, metodo_pago: e.target.value }))} className="input-field">
                  {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <input value={abono.observaciones} onChange={e => setAbono(p => ({ ...p, observaciones: e.target.value }))} className="input-field" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAbono(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><DollarSign className="w-4 h-4" /> Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
