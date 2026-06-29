// src/components/common/ModalNuevoClienteCorp.jsx
// Ventana independiente para crear un cliente corporativo desde cualquier módulo
import { useState } from 'react'
import { X, Building2 } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const FORM_INIT = {
  razon_social: '', rtn: '', contacto_nombre: '', contacto_telefono: '',
  contacto_email: '', direccion: '', limite_credito: 0, dias_credito: 30, descuento_habitaciones: 0,
}

export default function ModalNuevoClienteCorp({ onClose, onCreated }) {
  const [form, setForm] = useState(FORM_INIT)
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.razon_social || !form.rtn) {
      return toast.error('Razón social y RTN son obligatorios')
    }
    setGuardando(true)
    try {
      const r = await api.post('/clientes', form)
      toast.success('Cliente corporativo registrado')
      onCreated({ id: r.data.data.id, ...form })
    } catch {
      // toast de error gestionado por interceptor
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-400" /> Nuevo Cliente Corporativo
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-4">
          <div>
            <label className="label">Razón Social *</label>
            <input value={form.razon_social} onChange={e => setForm(p => ({ ...p, razon_social: e.target.value }))} className="input-field" required autoFocus />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">RTN *</label>
              <input value={form.rtn} onChange={e => setForm(p => ({ ...p, rtn: e.target.value }))} className="input-field" required />
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
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Límite de Crédito (L.)</label>
              <input type="number" step="0.01" min="0" value={form.limite_credito} onChange={e => setForm(p => ({ ...p, limite_credito: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Días de Crédito</label>
              <input type="number" min="0" value={form.dias_credito} onChange={e => setForm(p => ({ ...p, dias_credito: e.target.value }))} className="input-field" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              <Building2 className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Registrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
