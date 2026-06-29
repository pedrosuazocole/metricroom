// src/components/common/ModalNuevoHuesped.jsx
// Ventana independiente para crear un huésped. Se puede invocar desde Reservas,
// Check-In o el módulo de Huéspedes. Al guardar devuelve el huésped creado.
import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const FORM_INIT = {
  nombres: '', apellidos: '', tipo_doc: 'CEDULA', numero_doc: '',
  rtn: '', email: '', telefono: '', nacionalidad: 'Hondureña',
  empresa: '', exento_isv: false,
}

export default function ModalNuevoHuesped({ onClose, onCreated }) {
  const [form, setForm] = useState(FORM_INIT)
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.nombres || !form.apellidos || !form.numero_doc) {
      return toast.error('Nombres, apellidos y N° de documento son obligatorios')
    }
    setGuardando(true)
    try {
      const r = await api.post('/huespedes', form)
      toast.success('Huésped registrado')
      onCreated({ id: r.data.data.id, ...form, nombre_completo: `${form.nombres} ${form.apellidos}` })
    } catch {
      // toast de error ya gestionado por el interceptor de axios
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-400" /> Nuevo Huésped
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nombres *</label>
              <input value={form.nombres} onChange={e => setForm(p => ({ ...p, nombres: e.target.value }))} className="input-field" required autoFocus />
            </div>
            <div>
              <label className="label">Apellidos *</label>
              <input value={form.apellidos} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="label">Tipo de Documento *</label>
              <select value={form.tipo_doc} onChange={e => setForm(p => ({ ...p, tipo_doc: e.target.value }))} className="input-field">
                {['CEDULA', 'PASAPORTE', 'RTN', 'CARNET_RESIDENTE'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">N° de Documento *</label>
              <input value={form.numero_doc} onChange={e => setForm(p => ({ ...p, numero_doc: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="label">RTN (opcional)</label>
              <input value={form.rtn} onChange={e => setForm(p => ({ ...p, rtn: e.target.value }))} className="input-field" placeholder="0801-XXXX-XXXXX" />
            </div>
            <div>
              <label className="label">Nacionalidad</label>
              <input value={form.nacionalidad} onChange={e => setForm(p => ({ ...p, nacionalidad: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Teléfono (para WhatsApp)</label>
              <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} className="input-field" placeholder="+504 9999-9999" />
            </div>
            <div>
              <label className="label">Email (para confirmación)</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Empresa (opcional)</label>
              <input value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} className="input-field" />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.exento_isv}
              onChange={e => setForm(p => ({ ...p, exento_isv: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <div>
              <span className="text-sm text-slate-300">Cliente exonerado de ISV</span>
              <p className="text-xs text-slate-500">El Impuesto Turístico (4%) se sigue cobrando igual</p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              <UserPlus className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Registrar Huésped'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
