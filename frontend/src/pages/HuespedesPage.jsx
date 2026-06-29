import { useState, useEffect } from 'react'
import { Plus, Search, X, Users, Star } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function HuespedesPage() {
  const [huespedes, setHuespedes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nombres:'', apellidos:'', tipo_doc:'CEDULA', numero_doc:'', rtn:'', email:'', telefono:'', telefono2:'', nacionalidad:'Hondureña', empresa:'', cargo:'', direccion:'', ciudad:'', pais:'Honduras', observaciones:'', exento_isv:false })
  const cargar = async () => {
    const r = await api.get('/huespedes', { params: { q: busqueda, limit: 100 } })
    setHuespedes(r.data.data || [])
  }
  useEffect(() => { cargar() }, [busqueda])
  const guardar = async (e) => {
    e.preventDefault()
    await api.post('/huespedes', form)
    toast.success('Huésped registrado')
    setShowModal(false)
    cargar()
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Libro de Huéspedes</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo Huésped</button>
      </div>
      <div className="card flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, documento o email..." className="input-field pl-9" />
        </div>
      </div>
      <div className="card p-0 overflow-x-auto"><table className="w-full">
          <thead><tr>{['Nombre','Doc. Identidad','Teléfono','Email','Empresa','Nac.','VIP'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
          <tbody>
            {huespedes.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-600">No hay huéspedes registrados</td></tr>
            : huespedes.map(h => (
              <tr key={h.id} className="table-row">
                <td className="table-cell"><p className="font-medium text-slate-200">{h.nombres} {h.apellidos}</p></td>
                <td className="table-cell text-xs text-slate-400">{h.tipo_doc}: {h.numero_doc}</td>
                <td className="table-cell text-slate-400">{h.telefono}</td>
                <td className="table-cell text-slate-400 text-xs">{h.email}</td>
                <td className="table-cell text-slate-500 text-xs">{h.empresa}</td>
                <td className="table-cell text-slate-500 text-xs">{h.nacionalidad}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    {h.vip ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : null}
                    {h.exento_isv ? <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Exonerado ISV</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Registrar Nuevo Huésped</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {[['nombres','Nombres *',true],['apellidos','Apellidos *',true],['numero_doc','Número de Doc. *',true],['rtn','RTN',false],['email','Email',false],['telefono','Teléfono',false],['telefono2','Teléfono 2',false],['empresa','Empresa',false],['cargo','Cargo',false],['ciudad','Ciudad',false],['direccion','Dirección',false]].map(([key,label,req]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))} className="input-field" required={req} />
                  </div>
                ))}
                <div><label className="label">Tipo Doc. *</label>
                  <select value={form.tipo_doc} onChange={e => setForm(p=>({...p,tipo_doc:e.target.value}))} className="input-field">
                    {['CEDULA','PASAPORTE','RTN','CARNET_RESIDENTE'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Nacionalidad</label>
                  <input value={form.nacionalidad} onChange={e => setForm(p=>({...p,nacionalidad:e.target.value}))} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => setForm(p=>({...p,observaciones:e.target.value}))} rows={2} className="input-field" />
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
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Users className="w-4 h-4" /> Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
