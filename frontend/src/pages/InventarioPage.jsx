// src/pages/InventarioPage.jsx - Inventario de amenidades, suministros y minibares
import { useState, useEffect } from 'react'
import { Package, Plus, ArrowDown, ArrowUp, AlertTriangle, X, RefreshCw } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

const CATEGORIAS = ['AMENIDADES', 'ROPA_CAMA', 'ALIMENTOS', 'BEBIDAS', 'LIMPIEZA', 'MANTENIMIENTO', 'OTROS']
const TIPOS_MOV = ['ENTRADA', 'SALIDA', 'AJUSTE']

export default function InventarioPage() {
  const [items, setItems] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [selected, setSelected] = useState(null)
  const [showItem, setShowItem] = useState(false)
  const [showMov, setShowMov] = useState(false)
  const [filtroAlerta, setFiltroAlerta] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', descripcion: '', categoria: 'AMENIDADES', unidad_medida: 'UNIDAD', stock_actual: 0, stock_minimo: 5, precio_unitario: 0 })
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', cantidad: 1, precio_unitario: '', observaciones: '' })

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await api.get('/inventario', { params: filtroAlerta ? { alerta: true } : {} })
      setItems(r.data.data || [])
    } finally { setLoading(false) }
  }

  const cargarMovimientos = async (id) => {
    const r = await api.get(`/inventario/${id}/movimientos`)
    setMovimientos(r.data.data || [])
  }

  useEffect(() => { cargar() }, [filtroAlerta])

  const selectItem = async (item) => {
    setSelected(item)
    await cargarMovimientos(item.id)
  }

  const guardarItem = async (e) => {
    e.preventDefault()
    if (selected && !showItem) return
    try {
      if (form.id) {
        await api.put(`/inventario/${form.id}`, form)
        toast.success('Producto actualizado')
      } else {
        await api.post('/inventario', form)
        toast.success('Producto creado')
      }
      setShowItem(false)
      setForm({ nombre: '', descripcion: '', categoria: 'AMENIDADES', unidad_medida: 'UNIDAD', stock_actual: 0, stock_minimo: 5, precio_unitario: 0 })
      cargar()
    } catch {}
  }

  const editarItem = (item) => {
    setForm({ ...item })
    setShowItem(true)
  }

  const registrarMovimiento = async (e) => {
    e.preventDefault()
    await api.post(`/inventario/${selected.id}/movimiento`, movForm)
    toast.success('Movimiento registrado')
    setShowMov(false)
    setMovForm({ tipo: 'ENTRADA', cantidad: 1, precio_unitario: '', observaciones: '' })
    cargar()
    await cargarMovimientos(selected.id)
    const r = await api.get('/inventario')
    const updated = (r.data.data || []).find(x => x.id === selected.id)
    if (updated) setSelected(updated)
  }

  const alertas = items.filter(i => i.stock_actual <= i.stock_minimo)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Inventario</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setFiltroAlerta(!filtroAlerta)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${filtroAlerta ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}
          >
            <AlertTriangle className="w-4 h-4" /> {filtroAlerta ? 'Ver todos' : `Alertas (${alertas.length})`}
          </button>
          <button onClick={() => { setForm({ nombre: '', descripcion: '', categoria: 'AMENIDADES', unidad_medida: 'UNIDAD', stock_actual: 0, stock_minimo: 5, precio_unitario: 0 }); setShowItem(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex gap-5 min-h-0">
        {/* Lista de inventario */}
        <div className="flex-1 card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {['Producto', 'Categoría', 'Stock', 'Mínimo', 'Precio Unit.', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-slate-600">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay productos en inventario</p>
                </td></tr>
              ) : items.map(item => {
                const alerta = item.stock_actual <= item.stock_minimo
                const activo = selected?.id === item.id
                return (
                  <tr key={item.id} onClick={() => selectItem(item)}
                    className={`table-row cursor-pointer ${activo ? 'bg-brand-600/10' : ''}`}>
                    <td className="table-cell">
                      <p className="font-medium text-slate-200">{item.nombre}</p>
                      <p className="text-xs text-slate-500">{item.descripcion}</p>
                    </td>
                    <td className="table-cell text-slate-400 text-sm">{item.categoria}</td>
                    <td className="table-cell">
                      <span className={`font-bold text-lg ${alerta ? 'text-red-400' : 'text-slate-200'}`}>
                        {item.stock_actual}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">{item.unidad_medida}</span>
                    </td>
                    <td className="table-cell text-slate-500 text-sm">{item.stock_minimo}</td>
                    <td className="table-cell text-slate-300 text-sm"><PrecioDual monto={item.precio_unitario || 0} size="xs" /></td>
                    <td className="table-cell">
                      {alerta ? (
                        <span className="badge-danger flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Stock Bajo
                        </span>
                      ) : (
                        <span className="badge-success w-fit">Normal</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <button onClick={(e) => { e.stopPropagation(); editarItem(item) }}
                        className="text-brand-400 hover:text-brand-300 text-xs px-2 py-1 rounded border border-brand-500/30 hover:border-brand-400/50 transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Panel de movimientos */}
        {selected && (
          <div className="w-80 flex-shrink-0 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200 truncate">{selected.nombre}</h3>
                <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-700/40 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{selected.stock_actual}</p>
                  <p className="text-xs text-slate-500 mt-1">Stock Actual</p>
                </div>
                <div className="bg-slate-700/40 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{selected.stock_minimo}</p>
                  <p className="text-xs text-slate-500 mt-1">Stock Mínimo</p>
                </div>
              </div>
              <button onClick={() => setShowMov(true)} className="btn-primary w-full justify-center">
                <RefreshCw className="w-4 h-4" /> Registrar Movimiento
              </button>
            </div>

            <div className="card">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Últimos Movimientos</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {movimientos.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-4">Sin movimientos</p>
                ) : movimientos.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/30">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.tipo === 'ENTRADA' ? 'bg-emerald-500/20' : m.tipo === 'SALIDA' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                      {m.tipo === 'ENTRADA' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> :
                       m.tipo === 'SALIDA' ? <ArrowUp className="w-3.5 h-3.5 text-red-400" /> :
                       <RefreshCw className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300">{m.tipo} — {m.cantidad} {selected.unidad_medida}</p>
                      <p className="text-xs text-slate-600 truncate">{m.observaciones || '—'}</p>
                    </div>
                    <p className="text-xs text-slate-500 flex-shrink-0">{m.created_at?.split('T')[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Producto */}
      {showItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{form.id ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowItem(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardarItem} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" required />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-field">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unidad de Medida</label>
                  <select value={form.unidad_medida} onChange={e => setForm(p => ({ ...p, unidad_medida: e.target.value }))} className="input-field">
                    {['UNIDAD', 'KG', 'LITRO', 'METRO', 'PAR', 'CAJA', 'DOCENA'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Stock Actual</label>
                  <input type="number" min="0" value={form.stock_actual} onChange={e => setForm(p => ({ ...p, stock_actual: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Stock Mínimo (Alerta)</label>
                  <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm(p => ({ ...p, stock_minimo: e.target.value }))} className="input-field" />
                </div>
                <div className="col-span-2">
                  <label className="label">Precio Unitario</label>
                  <MoneyInput valueHNL={form.precio_unitario} onChange={val => setForm(p => ({ ...p, precio_unitario: val }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowItem(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Package className="w-4 h-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento */}
      {showMov && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Registrar Movimiento</h2>
              <button onClick={() => setShowMov(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={registrarMovimiento} className="p-6 space-y-4">
              <p className="text-slate-400 text-sm">Producto: <span className="text-slate-200 font-medium">{selected.nombre}</span></p>
              <div>
                <label className="label">Tipo de Movimiento *</label>
                <select value={movForm.tipo} onChange={e => setMovForm(p => ({ ...p, tipo: e.target.value }))} className="input-field">
                  {TIPOS_MOV.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cantidad *</label>
                  <input type="number" min="1" value={movForm.cantidad} onChange={e => setMovForm(p => ({ ...p, cantidad: e.target.value }))} className="input-field" required />
                </div>
                <div>
                  <label className="label">Precio Unit.</label>
                  <MoneyInput valueHNL={movForm.precio_unitario} onChange={val => setMovForm(p => ({ ...p, precio_unitario: val }))} />
                </div>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <input value={movForm.observaciones} onChange={e => setMovForm(p => ({ ...p, observaciones: e.target.value }))} className="input-field" placeholder="Proveedor, motivo, etc." />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowMov(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><RefreshCw className="w-4 h-4" /> Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
