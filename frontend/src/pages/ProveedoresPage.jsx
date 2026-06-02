// src/pages/ProveedoresPage.jsx - Gestión de proveedores
import { useState, useEffect } from 'react'
import { Truck, Plus, X, Phone, Mail } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    nombre: '', rtn: '', categoria: 'GENERAL', contacto_nombre: '', contacto_telefono: '',
    contacto_email: '', direccion: '', condiciones_pago: 'CONTADO', dias_credito: 0,
    banco: '', cuenta_bancaria: '', observaciones: ''
  })

  const CATEGORIAS = ['ALIMENTOS', 'BEBIDAS', 'LIMPIEZA', 'MANTENIMIENTO', 'ROPA_CAMA', 'TECNOLOGIA', 'GENERAL']

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await api.get('/proveedores')
      setProveedores(r.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const guardar = async (e) => {
    e.preventDefault()
    try {
      if (form.id) {
        await api.put(`/proveedores/${form.id}`, form)
        toast.success('Proveedor actualizado')
      } else {
        await api.post('/proveedores', form)
        toast.success('Proveedor registrado')
      }
      setShowModal(false)
      resetForm()
      cargar()
    } catch {}
  }

  const resetForm = () => setForm({
    nombre: '', rtn: '', categoria: 'GENERAL', contacto_nombre: '', contacto_telefono: '',
    contacto_email: '', direccion: '', condiciones_pago: 'CONTADO', dias_credito: 0,
    banco: '', cuenta_bancaria: '', observaciones: ''
  })

  const editar = (p) => { setForm({ ...p }); setShowModal(true) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Proveedores</h1>
        <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      <div className="card p-0 overflow-x-auto"><table className="w-full">
          <thead>
            <tr>
              {['Proveedor', 'RTN', 'Categoría', 'Contacto', 'Condición', 'Banco', 'Acciones'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-600">Cargando...</td></tr>
            ) : proveedores.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-600">
                <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay proveedores registrados</p>
              </td></tr>
            ) : proveedores.map(p => (
              <tr key={p.id} className="table-row">
                <td className="table-cell">
                  <p className="font-medium text-slate-200">{p.nombre}</p>
                  {p.direccion && <p className="text-xs text-slate-500">{p.direccion}</p>}
                </td>
                <td className="table-cell text-slate-500 text-sm font-mono">{p.rtn || '—'}</td>
                <td className="table-cell">
                  <span className="text-xs px-2 py-0.5 rounded-full border border-slate-600 text-slate-400">{p.categoria}</span>
                </td>
                <td className="table-cell">
                  <p className="text-slate-300 text-sm">{p.contacto_nombre || '—'}</p>
                  <div className="flex gap-3 mt-0.5">
                    {p.contacto_telefono && <span className="flex items-center gap-1 text-xs text-slate-500"><Phone className="w-3 h-3" />{p.contacto_telefono}</span>}
                    {p.contacto_email && <span className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3 h-3" />{p.contacto_email}</span>}
                  </div>
                </td>
                <td className="table-cell text-slate-400 text-sm">
                  {p.condiciones_pago}
                  {p.dias_credito > 0 && <span className="text-xs text-slate-600 block">{p.dias_credito} días</span>}
                </td>
                <td className="table-cell text-slate-500 text-xs">{p.banco || '—'}</td>
                <td className="table-cell">
                  <button onClick={() => editar(p)} className="text-brand-400 hover:text-brand-300 text-xs px-2 py-1 rounded border border-brand-500/30">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{form.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Nombre / Razón Social *</label>
                  <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" required />
                </div>
                <div>
                  <label className="label">RTN</label>
                  <input value={form.rtn} onChange={e => setForm(p => ({ ...p, rtn: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-field">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Contacto</label>
                  <input value={form.contacto_nombre} onChange={e => setForm(p => ({ ...p, contacto_nombre: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input value={form.contacto_telefono} onChange={e => setForm(p => ({ ...p, contacto_telefono: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={form.contacto_email} onChange={e => setForm(p => ({ ...p, contacto_email: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Condición de Pago</label>
                  <select value={form.condiciones_pago} onChange={e => setForm(p => ({ ...p, condiciones_pago: e.target.value }))} className="input-field">
                    {['CONTADO', 'CREDITO'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Días de Crédito</label>
                  <input type="number" min="0" value={form.dias_credito} onChange={e => setForm(p => ({ ...p, dias_credito: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Banco</label>
                  <input value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Cuenta Bancaria</label>
                  <input value={form.cuenta_bancaria} onChange={e => setForm(p => ({ ...p, cuenta_bancaria: e.target.value }))} className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Dirección</label>
                  <input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observaciones</label>
                  <textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} className="input-field" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Truck className="w-4 h-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
