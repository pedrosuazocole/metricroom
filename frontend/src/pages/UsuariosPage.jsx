// src/pages/UsuariosPage.jsx - Gestión de usuarios del sistema
import { useState, useEffect } from 'react'
import { UserCog, Plus, X, Key, Shield, ShieldOff, Check } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const ROLES = ['ADMIN', 'GERENTE', 'RECEPCION', 'AMA_LLAVES', 'CONTABILIDAD']

const ROL_INFO = {
  ADMIN:        { label:'Administrador',   color:'bg-red-500/20 text-red-400 border-red-500/30',       desc:'Acceso total al sistema' },
  GERENTE:      { label:'Gerente',         color:'bg-violet-500/20 text-violet-400 border-violet-500/30', desc:'Reportes y configuración' },
  RECEPCION:    { label:'Recepción',       color:'bg-brand-500/20 text-brand-400 border-brand-500/30',  desc:'Reservas, check-in/out, facturas' },
  AMA_LLAVES:   { label:'Ama de Llaves',   color:'bg-orange-500/20 text-orange-400 border-orange-500/30', desc:'Gestión de habitaciones' },
  CONTABILIDAD: { label:'Contabilidad',    color:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', desc:'Reportes y finanzas' },
}

const FORM_INIT = { username:'', password:'', nombre:'', rol:'RECEPCION', email:'' }

export default function UsuariosPage() {
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState(FORM_INIT)
  const [passForm, setPassForm]     = useState({ password_actual:'', password_nuevo:'', confirmar:'' })

  const cargar = async () => {
    setLoading(true)
    try { const r = await api.get('/usuarios'); setUsuarios(r.data.data || []) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo  = () => { setForm(FORM_INIT); setSelected(null); setShowModal(true) }
  const abrirEditar = (u) => { setForm({ ...u, password:'' }); setSelected(u); setShowModal(true) }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      if (selected?.id) {
        await api.put(`/usuarios/${selected.id}`, { nombre: form.nombre, rol: form.rol, email: form.email })
        toast.success('Usuario actualizado')
      } else {
        if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
        await api.post('/usuarios', { username: form.username, password: form.password, nombre: form.nombre, rol: form.rol, email: form.email })
        toast.success('Usuario creado exitosamente')
      }
      setShowModal(false); cargar()
    } catch {}
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    if (passForm.password_nuevo !== passForm.confirmar) return toast.error('Las contraseñas nuevas no coinciden')
    if (passForm.password_nuevo.length < 6) return toast.error('Mínimo 6 caracteres')
    try {
      await api.patch(`/usuarios/${selected.id}/password`, {
        password_actual: passForm.password_actual,
        password_nuevo:  passForm.password_nuevo,
      })
      toast.success('Contraseña cambiada exitosamente')
      setShowPass(false)
      setPassForm({ password_actual:'', password_nuevo:'', confirmar:'' })
    } catch {}
  }

  const toggleActivo = async (u) => {
    // Nota: admin puede desactivarse solo si hay otro usuario ADMIN activo
    const otrosAdmins = usuarios.filter(x => x.rol === 'ADMIN' && x.activo && x.id !== u.id)
    if (u.username === 'admin' && otrosAdmins.length === 0) {
      return toast.error('Creá otro usuario ADMIN antes de desactivar el admin principal')
    }
    await api.patch(`/usuarios/${u.id}/toggle`)
    toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
    cargar()
  }

  const activos   = usuarios.filter(u => u.activo)
  const inactivos = usuarios.filter(u => !u.activo)

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Usuarios del Sistema</h1>
        <button onClick={abrirNuevo} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLES.map(r => {
          const count = usuarios.filter(u => u.rol === r).length
          const { label, color } = ROL_INFO[r]
          return (
            <div key={r} className="stat-card text-center">
              <p className="text-2xl font-bold text-slate-200">{count}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${color}`}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Tabla usuarios activos */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300">Usuarios Activos ({activos.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {['Usuario','Nombre completo','Rol','Email','Último acceso','Acciones'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-600">Cargando...</td></tr>
            ) : activos.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-600">Sin usuarios activos</td></tr>
            ) : activos.map(u => {
              const { label, color } = ROL_INFO[u.rol] || {}
              return (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-400 text-sm font-bold">{u.username[0].toUpperCase()}</span>
                      </div>
                      <span className="font-mono text-sm text-slate-300">{u.username}</span>
                    </div>
                  </td>
                  <td className="table-cell font-medium text-slate-200">{u.nombre}</td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
                  </td>
                  <td className="table-cell text-slate-500 text-sm">{u.email || '—'}</td>
                  <td className="table-cell text-slate-500 text-xs">
                    {u.last_login ? u.last_login.split('T')[0] : 'Nunca'}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1.5">
                      <button onClick={() => abrirEditar(u)}
                        className="text-xs px-2 py-1 rounded border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => { setSelected(u); setShowPass(true) }}
                        className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:bg-slate-700/50 transition-colors flex items-center gap-1">
                        <Key className="w-3 h-3" /> Clave
                      </button>
                      <button onClick={() => toggleActivo(u)}
                        className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                        <ShieldOff className="w-3 h-3" /> {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Usuarios inactivos */}
      {inactivos.length > 0 && (
        <div className="card p-0 overflow-hidden opacity-70">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-500">Usuarios Inactivos ({inactivos.length})</h2>
          </div>
          <table className="w-full">
            <tbody>
              {inactivos.map(u => {
                const { label, color } = ROL_INFO[u.rol] || {}
                return (
                  <tr key={u.id} className="table-row">
                    <td className="table-cell font-mono text-sm text-slate-500">{u.username}</td>
                    <td className="table-cell text-slate-500">{u.nombre}</td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full border opacity-50 ${color}`}>{label}</span>
                    </td>
                    <td className="table-cell" colSpan={2}></td>
                    <td className="table-cell">
                      <button onClick={() => toggleActivo(u)}
                        className="text-xs px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Activar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Guía de permisos */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Guía de Roles y Permisos</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(r => {
            const { label, color, desc } = ROL_INFO[r]
            return (
              <div key={r} className="p-3 bg-slate-700/30 rounded-xl border border-slate-600/50">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${color} mb-2 inline-block`}>{label}</span>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal Crear / Editar Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {selected?.id ? `Editar — ${selected.username}` : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              {/* Username solo en creación */}
              {!selected?.id && (
                <div>
                  <label className="label">Usuario *</label>
                  <input value={form.username} onChange={e => setForm(p=>({...p,username:e.target.value.toLowerCase().trim()}))}
                    className="input-field font-mono" placeholder="recepcion01" required minLength={3} />
                  <p className="text-xs text-slate-600 mt-1">Solo letras minúsculas, números y guión bajo</p>
                </div>
              )}

              <div>
                <label className="label">Nombre Completo *</label>
                <input value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))}
                  className="input-field" placeholder="María López" required />
              </div>

              {/* Password solo en creación */}
              {!selected?.id && (
                <div>
                  <label className="label">Contraseña *</label>
                  <input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))}
                    className="input-field" placeholder="Mínimo 6 caracteres" required minLength={6} />
                </div>
              )}

              <div>
                <label className="label">Rol *</label>
                <select value={form.rol} onChange={e => setForm(p=>({...p,rol:e.target.value}))} className="input-field">
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROL_INFO[r].label} — {ROL_INFO[r].desc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email||''} onChange={e => setForm(p=>({...p,email:e.target.value}))}
                  className="input-field" placeholder="usuario@hotel.hn" />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">
                  <UserCog className="w-4 h-4" /> {selected?.id ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPass && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Cambiar Contraseña — {selected.username}</h2>
              <button onClick={() => setShowPass(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={cambiarPassword} className="p-6 space-y-4">
              <div>
                <label className="label">Contraseña Actual *</label>
                <input type="password" value={passForm.password_actual}
                  onChange={e => setPassForm(p=>({...p,password_actual:e.target.value}))}
                  className="input-field" required />
              </div>
              <div>
                <label className="label">Nueva Contraseña *</label>
                <input type="password" value={passForm.password_nuevo}
                  onChange={e => setPassForm(p=>({...p,password_nuevo:e.target.value}))}
                  className="input-field" minLength={6} required />
              </div>
              <div>
                <label className="label">Confirmar Nueva Contraseña *</label>
                <input type="password" value={passForm.confirmar}
                  onChange={e => setPassForm(p=>({...p,confirmar:e.target.value}))}
                  className={`input-field ${passForm.confirmar && passForm.confirmar !== passForm.password_nuevo ? 'border-red-500' : ''}`}
                  required />
                {passForm.confirmar && passForm.confirmar !== passForm.password_nuevo && (
                  <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
                )}
                {passForm.confirmar && passForm.confirmar === passForm.password_nuevo && passForm.password_nuevo && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><Check className="w-3 h-3"/> Coinciden</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPass(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Key className="w-4 h-4" /> Cambiar Contraseña</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
