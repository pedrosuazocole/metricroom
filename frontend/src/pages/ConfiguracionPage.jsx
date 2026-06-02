// src/pages/ConfiguracionPage.jsx - Configuración general del hotel
import { useState, useEffect } from 'react'
import { Settings, Save, Plus, X, DollarSign, MessageCircle, Building2, FileText } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'hotel', label: 'Hotel', icon: Building2 },
  { id: 'sar', label: 'SAR / CAI', icon: FileText },
  { id: 'tasa', label: 'Tasa de Cambio', icon: DollarSign },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'tarifas', label: 'Tarifas', icon: Settings },
]

export default function ConfiguracionPage() {
  const [tab, setTab] = useState('hotel')
  const [config, setConfig] = useState({})
  const [sarConfig, setSarConfig] = useState({ cai: '', rango_inicio: '', rango_fin: '', fecha_limite: '', punto_emision: '001-001-01' })
  const [tasa, setTasa] = useState({ tasa_compra: '', tasa_venta: '', observaciones: '' })
  const [tasaActual, setTasaActual] = useState(null)
  const [historialTasa, setHistorialTasa] = useState([])
  const [tarifas, setTarifas] = useState([])
  const [showTarifa, setShowTarifa] = useState(false)
  const [tarifaForm, setTarifaForm] = useState({ nombre: '', tipo: 'ESTANDAR', precio: '', descripcion: '' })
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const [conf, sar, t, hist] = await Promise.all([
        api.get('/configuracion'),
        api.get('/facturas/sar/config').catch(() => ({ data: { data: {} } })),
        api.get('/tasa-cambio/actual').catch(() => ({ data: { data: null } })),
        api.get('/tasa-cambio/historial').catch(() => ({ data: { data: [] } })),
      ])
      setConfig(conf.data.data || {})
      if (sar.data.data) setSarConfig(sar.data.data)
      setTasaActual(t.data.data)
      setHistorialTasa(hist.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const guardarConfig = async (e) => {
    e.preventDefault()
    await api.put('/configuracion', config)
    toast.success('Configuración guardada')
    cargar()
  }

  const guardarSar = async (e) => {
    e.preventDefault()
    await api.post('/facturas/sar/config', sarConfig)
    toast.success('Configuración SAR guardada')
  }

  const guardarTasa = async (e) => {
    e.preventDefault()
    await api.post('/tasa-cambio', tasa)
    toast.success('Tasa de cambio registrada')
    setTasa({ tasa_compra: '', tasa_venta: '', observaciones: '' })
    cargar()
  }

  const guardarTarifa = async (e) => {
    e.preventDefault()
    // tarifas se guardan en configuracion como JSON
    const nuevasTarifas = [...tarifas, { ...tarifaForm, id: Date.now() }]
    await api.put('/configuracion', { ...config, tarifas: JSON.stringify(nuevasTarifas) })
    toast.success('Tarifa agregada')
    setShowTarifa(false)
    setTarifaForm({ nombre: '', tipo: 'ESTANDAR', precio: '', descripcion: '' })
    cargar()
  }

  const c = (key) => config[key] || ''
  const setC = (key, val) => setConfig(p => ({ ...p, [key]: val }))

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Configuración</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Panel: Hotel */}
      {tab === 'hotel' && (
        <form onSubmit={guardarConfig} className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Datos del Establecimiento</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nombre del Hotel *</label>
              <input value={c('hotel_nombre')} onChange={e => setC('hotel_nombre', e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label">RTN del Hotel</label>
              <input value={c('hotel_rtn')} onChange={e => setC('hotel_rtn', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input value={c('hotel_telefono')} onChange={e => setC('hotel_telefono', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={c('hotel_email')} onChange={e => setC('hotel_email', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Sitio Web</label>
              <input value={c('hotel_web')} onChange={e => setC('hotel_web', e.target.value)} className="input-field" placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección Completa</label>
              <textarea value={c('hotel_direccion')} onChange={e => setC('hotel_direccion', e.target.value)} className="input-field" rows={2} />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input value={c('hotel_ciudad')} onChange={e => setC('hotel_ciudad', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">País</label>
              <input value={c('hotel_pais') || 'Honduras'} onChange={e => setC('hotel_pais', e.target.value)} className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Texto de Pie de Factura</label>
              <textarea value={c('factura_pie')} onChange={e => setC('factura_pie', e.target.value)} className="input-field" rows={2} placeholder="Texto que aparece al final de cada factura..." />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar Cambios</button>
          </div>
        </form>
      )}

      {/* Panel: SAR / CAI */}
      {tab === 'sar' && (
        <form onSubmit={guardarSar} className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Configuración SAR Honduras</h2>
            <p className="text-slate-500 text-sm mt-1">Ingresa los datos que aparecen en tu resolución de autorización de impresión.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">CAI (Clave de Autorización de Impresión) *</label>
              <input value={sarConfig.cai} onChange={e => setSarConfig(p => ({ ...p, cai: e.target.value }))} className="input-field font-mono" placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX" required />
            </div>
            <div>
              <label className="label">Punto de Emisión</label>
              <input value={sarConfig.punto_emision} onChange={e => setSarConfig(p => ({ ...p, punto_emision: e.target.value }))} className="input-field font-mono" placeholder="001-001-01" />
            </div>
            <div>
              <label className="label">Fecha Límite de Emisión *</label>
              <input type="date" value={sarConfig.fecha_limite} onChange={e => setSarConfig(p => ({ ...p, fecha_limite: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="label">Rango Inicio *</label>
              <input value={sarConfig.rango_inicio} onChange={e => setSarConfig(p => ({ ...p, rango_inicio: e.target.value }))} className="input-field font-mono" placeholder="001-001-01-00000001" required />
            </div>
            <div>
              <label className="label">Rango Fin *</label>
              <input value={sarConfig.rango_fin} onChange={e => setSarConfig(p => ({ ...p, rango_fin: e.target.value }))} className="input-field font-mono" placeholder="001-001-01-99999999" required />
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
            💡 El correlativo de factura se genera automáticamente en el formato <code className="font-mono bg-blue-500/10 px-1 rounded">001-001-01-00000001</code>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar SAR</button>
          </div>
        </form>
      )}

      {/* Panel: Tasa de Cambio */}
      {tab === 'tasa' && (
        <div className="space-y-4">
          {tasaActual && (
            <div className="card bg-brand-600/5 border-brand-500/20">
              <p className="text-slate-400 text-sm mb-3">Tasa Vigente</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">Compra (USD → HNL)</p>
                  <p className="text-2xl font-bold text-brand-400">L. {parseFloat(tasaActual.tasa_compra).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Venta (HNL → USD)</p>
                  <p className="text-2xl font-bold text-emerald-400">L. {parseFloat(tasaActual.tasa_venta).toFixed(4)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">Actualizada: {tasaActual.created_at?.split('T')[0]}</p>
            </div>
          )}

          <form onSubmit={guardarTasa} className="card space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Registrar Nueva Tasa</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Tasa Compra (L./USD)</label>
                <input type="number" step="0.0001" value={tasa.tasa_compra} onChange={e => setTasa(p => ({ ...p, tasa_compra: e.target.value }))} className="input-field" placeholder="Ej: 24.8500" required />
              </div>
              <div>
                <label className="label">Tasa Venta (L./USD)</label>
                <input type="number" step="0.0001" value={tasa.tasa_venta} onChange={e => setTasa(p => ({ ...p, tasa_venta: e.target.value }))} className="input-field" placeholder="Ej: 24.9000" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Observaciones</label>
                <input value={tasa.observaciones} onChange={e => setTasa(p => ({ ...p, observaciones: e.target.value }))} className="input-field" placeholder="Banco Central, BCH, etc." />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary"><DollarSign className="w-4 h-4" /> Registrar Tasa</button>
            </div>
          </form>

          {historialTasa.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Historial</h3>
              <table className="w-full text-sm">
                <thead><tr>
                  {['Fecha', 'Compra', 'Venta', 'Observaciones'].map(h => <th key={h} className="table-header text-left">{h}</th>)}
                </tr></thead>
                <tbody>
                  {historialTasa.slice(0, 10).map((t, i) => (
                    <tr key={i} className="table-row">
                      <td className="table-cell text-slate-400">{t.created_at?.split('T')[0]}</td>
                      <td className="table-cell text-brand-400">L. {parseFloat(t.tasa_compra).toFixed(4)}</td>
                      <td className="table-cell text-emerald-400">L. {parseFloat(t.tasa_venta).toFixed(4)}</td>
                      <td className="table-cell text-slate-500 text-xs">{t.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Panel: WhatsApp */}
      {tab === 'whatsapp' && (
        <form onSubmit={guardarConfig} className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Notificaciones por WhatsApp</h2>
            <p className="text-slate-500 text-sm mt-1">Integración mediante CallMeBot — gratuito para notificaciones automáticas.</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm space-y-2">
            <p className="text-emerald-300 font-medium">📱 Cómo configurar CallMeBot:</p>
            <ol className="text-emerald-400/80 space-y-1 list-decimal list-inside text-xs">
              <li>Agrega el número <span className="font-mono bg-emerald-500/10 px-1 rounded">+34 644 65 21 68</span> a tus contactos de WhatsApp</li>
              <li>Envía el mensaje: <span className="font-mono bg-emerald-500/10 px-1 rounded">I allow callmebot to send me messages</span></li>
              <li>Recibirás tu API KEY por WhatsApp en minutos</li>
            </ol>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Número WhatsApp del Receptor</label>
              <input value={c('whatsapp_phone')} onChange={e => setC('whatsapp_phone', e.target.value)} className="input-field" placeholder="+50498765432 (con código de país)" />
            </div>
            <div>
              <label className="label">API Key de CallMeBot</label>
              <input value={c('whatsapp_apikey')} onChange={e => setC('whatsapp_apikey', e.target.value)} className="input-field" placeholder="Tu API key de CallMeBot" />
            </div>
          </div>
          <div>
            <label className="label mb-2 block">Activar notificaciones para:</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: 'notif_reserva', label: '📅 Nueva Reserva' },
                { key: 'notif_checkin', label: '✅ Check-In' },
                { key: 'notif_checkout', label: '🔑 Check-Out' },
                { key: 'notif_factura', label: '🧾 Factura Emitida' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 bg-slate-700/40 rounded-lg cursor-pointer hover:bg-slate-700/60 transition-colors">
                  <input type="checkbox" checked={c(key) === 'true' || c(key) === true}
                    onChange={e => setC(key, e.target.checked ? 'true' : 'false')}
                    className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar WhatsApp</button>
          </div>
        </form>
      )}

      {/* Panel: Tarifas */}
      {tab === 'tarifas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowTarifa(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Nueva Tarifa
            </button>
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Tarifas y Temporadas</h2>
            <p className="text-slate-500 text-sm mb-4">Las tarifas registradas aquí se usan al crear reservas como referencia de precio sugerido.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                let tarifasArr = []
                try { tarifasArr = JSON.parse(config.tarifas || '[]') } catch {}
                return tarifasArr.map((t, i) => (
                  <div key={i} className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500 text-slate-400">{t.tipo}</span>
                    </div>
                    <p className="font-medium text-slate-200">{t.nombre}</p>
                    <p className="text-2xl font-bold text-brand-400 mt-1">L. {parseFloat(t.precio).toFixed(2)}</p>
                    {t.descripcion && <p className="text-xs text-slate-500 mt-1">{t.descripcion}</p>}
                  </div>
                ))
              })()}
              {!config.tarifas && (
                <div className="col-span-3 text-center py-10 text-slate-600">
                  <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay tarifas configuradas</p>
                </div>
              )}
            </div>
          </div>

          {showTarifa && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-white">Nueva Tarifa</h2>
                  <button onClick={() => setShowTarifa(false)}><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <form onSubmit={guardarTarifa} className="p-6 space-y-4">
                  <div>
                    <label className="label">Nombre *</label>
                    <input value={tarifaForm.nombre} onChange={e => setTarifaForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" placeholder="Tarifa Rack, Corporativa, etc." required />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select value={tarifaForm.tipo} onChange={e => setTarifaForm(p => ({ ...p, tipo: e.target.value }))} className="input-field">
                      {['ESTANDAR', 'CORPORATIVA', 'TEMPORADA_ALTA', 'TEMPORADA_BAJA', 'FIN_DE_SEMANA', 'ESPECIAL'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Precio por Noche (L.) *</label>
                    <input type="number" step="0.01" value={tarifaForm.precio} onChange={e => setTarifaForm(p => ({ ...p, precio: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <input value={tarifaForm.descripcion} onChange={e => setTarifaForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowTarifa(false)} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
