// src/pages/BancosPage.jsx - Gestión de bancos, cuentas bancarias y movimientos
import { useState, useEffect } from 'react'
import { Landmark, Plus, X, ArrowDown, ArrowUp, RefreshCw, CreditCard } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const TIPOS_BANCO   = ['NACIONAL', 'INTERNACIONAL', 'COOPERATIVA']
const TIPOS_CUENTA  = ['CORRIENTE', 'AHORRO', 'INVERSIONES']
const TIPOS_MOV     = ['DEPOSITO', 'RETIRO', 'TRANSFERENCIA', 'COMISION', 'INTERES', 'AJUSTE']
const MOV_ICON = {
  DEPOSITO:     { Icon: ArrowDown, color: 'text-emerald-400 bg-emerald-500/10' },
  INTERES:      { Icon: ArrowDown, color: 'text-emerald-400 bg-emerald-500/10' },
  RETIRO:       { Icon: ArrowUp,   color: 'text-red-400 bg-red-500/10' },
  COMISION:     { Icon: ArrowUp,   color: 'text-red-400 bg-red-500/10' },
  TRANSFERENCIA:{ Icon: RefreshCw, color: 'text-blue-400 bg-blue-500/10' },
  AJUSTE:       { Icon: RefreshCw, color: 'text-yellow-400 bg-yellow-500/10' },
}
const esIngreso = (tipo) => ['DEPOSITO','INTERES'].includes(tipo)

export default function BancosPage() {
  const [bancos, setBancos]             = useState([])
  const [cuentas, setCuentas]           = useState([])
  const [movimientos, setMovimientos]   = useState([])
  const [resumen, setResumen]           = useState({})
  const [cuentaActiva, setCuentaActiva] = useState(null)
  const [showBanco, setShowBanco]       = useState(false)
  const [showCuenta, setShowCuenta]     = useState(false)
  const [showMov, setShowMov]           = useState(false)
  const [bancoForm, setBancoForm]       = useState({ nombre:'', codigo:'', tipo:'NACIONAL', pais:'Honduras' })
  const [cuentaForm, setCuentaForm]     = useState({ banco_id:'', numero_cuenta:'', tipo_cuenta:'CORRIENTE', moneda:'HNL', nombre_titular:'', rtn_titular:'', saldo_inicial:0, descripcion:'' })
  const [movForm, setMovForm]           = useState({ tipo:'DEPOSITO', monto:'', descripcion:'', referencia:'', fecha:new Date().toISOString().split('T')[0] })
  const [loading, setLoading]           = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const [b, c] = await Promise.all([api.get('/bancos'), api.get('/bancos/cuentas')])
      setBancos(b.data.data || [])
      setCuentas(c.data.data || [])
      setResumen(c.data.resumen || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const seleccionarCuenta = async (cuenta) => {
    setCuentaActiva(cuenta)
    const r = await api.get(`/bancos/cuentas/${cuenta.id}/movimientos`)
    setMovimientos(r.data.data || [])
  }

  const guardarBanco = async (e) => {
    e.preventDefault()
    try {
      if (bancoForm.id) { await api.put(`/bancos/${bancoForm.id}`, bancoForm); toast.success('Banco actualizado') }
      else              { await api.post('/bancos', bancoForm);                toast.success('Banco registrado') }
      setShowBanco(false); setBancoForm({ nombre:'', codigo:'', tipo:'NACIONAL', pais:'Honduras' }); cargar()
    } catch {}
  }

  const guardarCuenta = async (e) => {
    e.preventDefault()
    try {
      if (cuentaForm.id) { await api.put(`/bancos/cuentas/${cuentaForm.id}`, cuentaForm); toast.success('Cuenta actualizada') }
      else               { await api.post('/bancos/cuentas', { ...cuentaForm, saldo_inicial: parseFloat(cuentaForm.saldo_inicial)||0 }); toast.success('Cuenta creada') }
      setShowCuenta(false); cargar()
    } catch {}
  }

  const registrarMovimiento = async (e) => {
    e.preventDefault()
    await api.post(`/bancos/cuentas/${cuentaActiva.id}/movimientos`, { ...movForm, monto: parseFloat(movForm.monto) })
    toast.success('Movimiento registrado')
    setShowMov(false)
    setMovForm({ tipo:'DEPOSITO', monto:'', descripcion:'', referencia:'', fecha:new Date().toISOString().split('T')[0] })
    const r = await api.get(`/bancos/cuentas/${cuentaActiva.id}/movimientos`)
    setMovimientos(r.data.data || [])
    cargar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Bancos y Cuentas</h1>
        <div className="flex gap-3">
          <button onClick={() => { setBancoForm({ nombre:'', codigo:'', tipo:'NACIONAL', pais:'Honduras' }); setShowBanco(true) }} className="btn-secondary">
            <Landmark className="w-4 h-4" /> Nuevo Banco
          </button>
          <button onClick={() => { setCuentaForm({ banco_id:'', numero_cuenta:'', tipo_cuenta:'CORRIENTE', moneda:'HNL', nombre_titular:'', rtn_titular:'', saldo_inicial:0, descripcion:'' }); setShowCuenta(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Saldo Total HNL</p>
          <p className="text-2xl font-bold text-emerald-400">L. {parseFloat(resumen.totalHNL||0).toLocaleString('es-HN',{minimumFractionDigits:2})}</p>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Saldo Total USD</p>
          <p className="text-2xl font-bold text-brand-400">$ {parseFloat(resumen.totalUSD||0).toLocaleString('en-US',{minimumFractionDigits:2})}</p>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm mb-1">Cuentas Activas</p>
          <p className="text-2xl font-bold text-slate-200">{resumen.total_cuentas||0}</p>
        </div>
      </div>

      <div className="flex gap-5 min-h-0">
        {/* Cuentas */}
        <div className="flex-1 space-y-3">
          {loading ? (
            <div className="card text-center py-12 text-slate-600">Cargando...</div>
          ) : cuentas.length === 0 ? (
            <div className="card text-center py-16 text-slate-600">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay cuentas bancarias</p>
              <p className="text-xs mt-1">Registrá un banco primero, luego agregá cuentas</p>
            </div>
          ) : cuentas.map(c => (
            <div key={c.id} onClick={() => seleccionarCuenta(c)}
              className={`card cursor-pointer transition-all hover:border-slate-600 ${cuentaActiva?.id===c.id?'border-brand-500/50 bg-slate-700/30':''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-6 h-6 text-brand-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{c.nombre_titular}</p>
                    <p className="text-xs text-slate-500">{c.banco_nombre} · {c.tipo_cuenta} · {c.numero_cuenta}</p>
                    {c.descripcion && <p className="text-xs text-slate-600">{c.descripcion}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${c.moneda==='HNL'?'text-emerald-400':'text-brand-400'}`}>
                    {c.moneda==='HNL'?'L.':'$'} {parseFloat(c.saldo_actual||0).toLocaleString(c.moneda==='HNL'?'es-HN':'en-US',{minimumFractionDigits:2})}
                  </p>
                  <div className="flex items-center gap-2 justify-end mt-1">
                    <span className="text-xs text-slate-500">{c.moneda}</span>
                    <button onClick={ev=>{ev.stopPropagation(); setCuentaForm({...c}); setShowCuenta(true)}}
                      className="text-xs text-brand-400 px-2 py-0.5 rounded border border-brand-500/30 hover:bg-brand-500/10">
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Panel movimientos */}
        {cuentaActiva && (
          <div className="w-96 flex-shrink-0 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200 truncate">{cuentaActiva.nombre_titular}</h3>
                  <p className="text-xs text-slate-500">{cuentaActiva.banco_nombre} · {cuentaActiva.numero_cuenta}</p>
                </div>
                <button onClick={()=>setCuentaActiva(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4"/></button>
              </div>
              <div className="bg-brand-600/10 border border-brand-500/20 rounded-xl p-4 mb-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Saldo Actual</p>
                <p className={`text-3xl font-black ${cuentaActiva.moneda==='HNL'?'text-emerald-400':'text-brand-400'}`}>
                  {cuentaActiva.moneda==='HNL'?'L.':'$'} {parseFloat(cuentaActiva.saldo_actual||0).toLocaleString(cuentaActiva.moneda==='HNL'?'es-HN':'en-US',{minimumFractionDigits:2})}
                </p>
              </div>
              <button onClick={()=>setShowMov(true)} className="btn-primary w-full justify-center">
                <Plus className="w-4 h-4"/> Registrar Movimiento
              </button>
            </div>
            <div className="card">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Movimientos</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {movimientos.length===0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Sin movimientos</p>
                ) : movimientos.map(m => {
                  const { Icon, color } = MOV_ICON[m.tipo]||MOV_ICON.AJUSTE
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-700/30">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{m.descripcion}</p>
                        <p className="text-xs text-slate-500">{m.tipo} · {m.fecha}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${esIngreso(m.tipo)?'text-emerald-400':'text-red-400'}`}>
                          {esIngreso(m.tipo)?'+':'-'}{parseFloat(m.monto).toFixed(2)}
                        </p>
                        {m.saldo_despues!=null && <p className="text-xs text-slate-600">={parseFloat(m.saldo_despues).toFixed(2)}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bancos registrados */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bancos Registrados</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bancos.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl border border-slate-600/50">
              <div className="flex items-center gap-3">
                <Landmark className="w-5 h-5 text-brand-400 flex-shrink-0"/>
                <div>
                  <p className="text-sm font-medium text-slate-200">{b.nombre}</p>
                  <p className="text-xs text-slate-500">{b.codigo||'—'} · {b.tipo}</p>
                </div>
              </div>
              <button onClick={()=>{setBancoForm({...b});setShowBanco(true)}}
                className="text-xs text-brand-400 px-2 py-1 rounded border border-brand-500/30 hover:bg-brand-500/10">Editar</button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Banco */}
      {showBanco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{bancoForm.id?'Editar Banco':'Registrar Banco'}</h2>
              <button onClick={()=>setShowBanco(false)}><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            <form onSubmit={guardarBanco} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input value={bancoForm.nombre} onChange={e=>setBancoForm(p=>({...p,nombre:e.target.value}))} className="input-field" required/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Código</label>
                  <input value={bancoForm.codigo||''} onChange={e=>setBancoForm(p=>({...p,codigo:e.target.value}))} className="input-field" placeholder="BATL"/>
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select value={bancoForm.tipo} onChange={e=>setBancoForm(p=>({...p,tipo:e.target.value}))} className="input-field">
                    {TIPOS_BANCO.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">País</label>
                <input value={bancoForm.pais||'Honduras'} onChange={e=>setBancoForm(p=>({...p,pais:e.target.value}))} className="input-field"/>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowBanco(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><Landmark className="w-4 h-4"/> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cuenta */}
      {showCuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{cuentaForm.id?'Editar Cuenta':'Nueva Cuenta Bancaria'}</h2>
              <button onClick={()=>setShowCuenta(false)}><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            <form onSubmit={guardarCuenta} className="p-6 space-y-4">
              <div>
                <label className="label">Banco *</label>
                <select value={cuentaForm.banco_id} onChange={e=>setCuentaForm(p=>({...p,banco_id:e.target.value}))} className="input-field" required>
                  <option value="">Seleccionar banco...</option>
                  {bancos.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">N° Cuenta *</label>
                  <input value={cuentaForm.numero_cuenta} onChange={e=>setCuentaForm(p=>({...p,numero_cuenta:e.target.value}))} className="input-field" required/>
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select value={cuentaForm.tipo_cuenta} onChange={e=>setCuentaForm(p=>({...p,tipo_cuenta:e.target.value}))} className="input-field">
                    {TIPOS_CUENTA.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select value={cuentaForm.moneda} onChange={e=>setCuentaForm(p=>({...p,moneda:e.target.value}))} className="input-field">
                    <option value="HNL">HNL — Lempiras</option>
                    <option value="USD">USD — Dólares</option>
                  </select>
                </div>
                <div>
                  <label className="label">Saldo Inicial</label>
                  <input type="number" step="0.01" min="0" value={cuentaForm.saldo_inicial}
                    onChange={e=>setCuentaForm(p=>({...p,saldo_inicial:e.target.value}))} className="input-field" disabled={!!cuentaForm.id}/>
                </div>
              </div>
              <div>
                <label className="label">Titular *</label>
                <input value={cuentaForm.nombre_titular} onChange={e=>setCuentaForm(p=>({...p,nombre_titular:e.target.value}))} className="input-field" required/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">RTN Titular</label>
                  <input value={cuentaForm.rtn_titular||''} onChange={e=>setCuentaForm(p=>({...p,rtn_titular:e.target.value}))} className="input-field"/>
                </div>
                <div>
                  <label className="label">Descripción</label>
                  <input value={cuentaForm.descripcion||''} onChange={e=>setCuentaForm(p=>({...p,descripcion:e.target.value}))} className="input-field"/>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowCuenta(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary"><CreditCard className="w-4 h-4"/> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento */}
      {showMov && cuentaActiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Registrar Movimiento</h2>
              <button onClick={()=>setShowMov(false)}><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            <form onSubmit={registrarMovimiento} className="p-6 space-y-4">
              <p className="text-slate-400 text-sm">Cuenta: <span className="text-slate-200 font-medium">{cuentaActiva.nombre_titular}</span></p>
              <div>
                <label className="label">Tipo *</label>
                <select value={movForm.tipo} onChange={e=>setMovForm(p=>({...p,tipo:e.target.value}))} className="input-field">
                  {TIPOS_MOV.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Monto *</label>
                  <input type="number" step="0.01" min="0.01" value={movForm.monto}
                    onChange={e=>setMovForm(p=>({...p,monto:e.target.value}))} className="input-field" required/>
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" value={movForm.fecha} onChange={e=>setMovForm(p=>({...p,fecha:e.target.value}))} className="input-field"/>
                </div>
              </div>
              <div>
                <label className="label">Descripción *</label>
                <input value={movForm.descripcion} onChange={e=>setMovForm(p=>({...p,descripcion:e.target.value}))} className="input-field" required/>
              </div>
              <div>
                <label className="label">Referencia</label>
                <input value={movForm.referencia} onChange={e=>setMovForm(p=>({...p,referencia:e.target.value}))} className="input-field" placeholder="CHQ-001, TRF-2024..."/>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowMov(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
