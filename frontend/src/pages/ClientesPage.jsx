// src/pages/ClientesPage.jsx - Clientes corporativos y líneas de crédito
import { useState, useEffect } from 'react'
import { Building2, Plus, X, Phone, Mail, CreditCard } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function ClientesPage() {
  const [clientes, setClientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({
    razon_social: '', rtn: '', contacto_nombre: '', contacto_telefono: '',
    contacto_email: '', direccion: '', credito_limite: 0, condiciones_pago: 'CONTADO', observaciones: ''
  })

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await api.get('/clientes', { params: { busqueda } })
      setClientes(r.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [busqueda])

  const guardar = async (e) => {
    e.preventDefault()
    try {
      if (form.id) {
        await api.put(`/clientes/${form.id}`, form)
        toast.success('Cliente actualizado')
      } else {
        await api.post('/clientes', form)
        toast.success('Cliente registrado')
      }
      setShowModal(false)
      resetForm()
      cargar()
    } catch {}
  }

  const resetForm = () => setForm({
    razon_social: '', rtn: '', contacto_nombre: '', contacto_telefono: '',
    contacto_email: '', direccion: '', credito_limite: 0, condiciones_pago: 'CONTADO', observaciones: ''
  })

  const editar = (c) => { setForm({ ...c }); setShowModal(true) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Clientes Corporativos</h1>
        <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, RTN o contacto..."
          className="input-field flex-1"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-600">Cargando...</div>
        ) : clientes.length === 0 ? (
          <div className="col-span-3 card text-center py-16 text-slate-600">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No se encontraron clientes</p>
          </div>
        ) : clientes.map(c => (
          <div key={c.id} className="card hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-brand-400" />
              </div>
              <button onClick={() => editar(c)} className="text-brand-400 hover:text-brand-300 text-xs px-2 py-1 rounded border border-brand-500/30">Editar</button>
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">{c.razon_social}</h3>
            <p className="text-xs text-slate-500 mb-3">RTN: {c.rtn || '—'}</p>
            <div className="space-y-1.5 text-sm">
              {c.contacto_nombre && (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-600 flex-shrink-0" />
                  {c.contacto_nombre}
                </div>
              )}
              {c.contacto_telefono && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {c.contacto_telefono}
                </div>
              )}
              {c.contacto_email && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {c.contacto_email}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">{c.condiciones_pago}</span>
              <div className="flex items-center gap-1 text-sm">
                <CreditCard className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-brand-400 font-medium">L. {parseFloat(c.credito_limite || 0).toLocaleString('es-HN')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{form.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Razón Social *</label>
                  <input value={form.razon_social} onChange={e => setForm(p => ({ ...p, razon_social: e.target.value }))} className="input-field" required />
                </div>
                <div>
                  <label className="label">RTN</label>
                  <input value={form.rtn} onChange={e => setForm(p => ({ ...p, rtn: e.target.value }))} className="input-field" placeholder="0000-0000-000000" />
                </div>
                <div>
                  <label className="label">Condiciones de Pago</label>
                  <select value={form.condiciones_pago} onChange={e => setForm(p => ({ ...p, condiciones_pago: e.target.value }))} className="input-field">
                    {['CONTADO', 'CREDITO_15', 'CREDITO_30', 'CREDITO_60'].map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Nombre de Contacto</label>
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
                  <label className="label">Límite de Crédito (L.)</label>
                  <input type="number" min="0" step="100" value={form.credito_limite} onChange={e => setForm(p => ({ ...p, credito_limite: e.target.value }))} className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Dirección</label>
                  <input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observaciones</label>
                  <textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} className="input-field" rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Building2 className="w-4 h-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
