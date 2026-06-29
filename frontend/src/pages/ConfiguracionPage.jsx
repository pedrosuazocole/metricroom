// src/pages/ConfiguracionPage.jsx - Configuración general del hotel
import { useState, useEffect, useRef } from 'react'
import { Settings, Save, Plus, X, DollarSign, MessageCircle, Building2, FileText, Upload, Trash2, ImageIcon, Mail, BedDouble, Edit2, Power } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'

const TABS = [
  { id: 'hotel', label: 'Hotel', icon: Building2 },
  { id: 'sar', label: 'SAR / CAI', icon: FileText },
  { id: 'tasa', label: 'Tasa de Cambio', icon: DollarSign },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'tarifas', label: 'Tarifas', icon: Settings },
  { id: 'tipos_habitacion', label: 'Tipos de Habitación', icon: BedDouble },
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
  const [tiposHabitacion, setTiposHabitacion] = useState([])
  const [showTipoHab, setShowTipoHab] = useState(false)
  const [tipoHabForm, setTipoHabForm] = useState({ nombre: '', capacidad_sugerida: 2, precio_sugerido: '', precio_10: '', precio_15: '', precio_20: '', descripcion: '' })
  const [loading, setLoading] = useState(true)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef()

  const cargar = async () => {
    setLoading(true)
    try {
      const [conf, sar, t, hist, tiposHab] = await Promise.all([
        api.get('/configuracion'),
        api.get('/facturas/sar/config').catch(() => ({ data: { data: {} } })),
        api.get('/tasa-cambio/actual').catch(() => ({ data: { data: null } })),
        api.get('/tasa-cambio/historial').catch(() => ({ data: { data: [] } })),
        api.get('/tipos-habitacion', { params: { incluir_inactivos: true } }).catch(() => ({ data: { data: [] } })),
      ])
      setConfig(conf.data.data || {})
      if (sar.data.data) {
        const s = sar.data.data
        setSarConfig({
          cai: s.cai || '',
          rango_inicio: s.rango_inicial || s.rango_inicio || '',
          rango_fin: s.rango_final || s.rango_fin || '',
          fecha_limite: s.fecha_limite_emision || s.fecha_limite || '',
          punto_emision: s.establecimiento && s.punto_emision && s.tipo_documento
            ? `${s.establecimiento}-${s.punto_emision}-${s.tipo_documento}`
            : s.punto_emision || '001-001-01',
        })
      }
      setTasaActual(t.data.data)
      setHistorialTasa(hist.data.data || [])
      setTiposHabitacion(tiposHab.data.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const guardarConfig = async (e) => {
    e.preventDefault()
    await api.put('/configuracion', config)
    toast.success('Configuración guardada')
    cargar()
  }

  // ── Tipos de Habitación ──
  const abrirNuevoTipoHab = () => {
    setTipoHabForm({ nombre: '', capacidad_sugerida: 2, precio_sugerido: '', precio_10: '', precio_15: '', precio_20: '', descripcion: '' })
    setShowTipoHab(true)
  }
  const abrirEditarTipoHab = (t) => {
    setTipoHabForm({
      id: t.id, nombre: t.nombre, capacidad_sugerida: t.capacidad_sugerida,
      precio_sugerido: t.precio_sugerido, precio_10: t.precio_10 ?? '', precio_15: t.precio_15 ?? '', precio_20: t.precio_20 ?? '',
      descripcion: t.descripcion || '',
    })
    setShowTipoHab(true)
  }
  // Recalcula los 3 descuentos automáticamente cuando cambia el precio Normal,
  // pero solo si el campo de descuento no fue editado manualmente todavía
  const handlePrecioNormalChange = (valor) => {
    const base = parseFloat(valor) || 0
    setTipoHabForm(p => ({
      ...p,
      precio_sugerido: valor,
      precio_10: p._editado10 ? p.precio_10 : (base ? (base * 0.90).toFixed(2) : ''),
      precio_15: p._editado15 ? p.precio_15 : (base ? (base * 0.85).toFixed(2) : ''),
      precio_20: p._editado20 ? p.precio_20 : (base ? (base * 0.80).toFixed(2) : ''),
    }))
  }
  const guardarTipoHab = async (e) => {
    e.preventDefault()
    try {
      if (tipoHabForm.id) {
        await api.put(`/tipos-habitacion/${tipoHabForm.id}`, tipoHabForm)
        toast.success('Tipo de habitación actualizado')
      } else {
        await api.post('/tipos-habitacion', tipoHabForm)
        toast.success('Tipo de habitación creado')
      }
      setShowTipoHab(false)
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }
  const toggleTipoHab = async (t) => {
    try {
      await api.patch(`/tipos-habitacion/${t.id}/toggle`)
      toast.success(t.activo ? 'Tipo desactivado' : 'Tipo activado')
      cargar()
    } catch { /* toast manejado por interceptor */ }
  }

  const guardarSar = async (e) => {
    e.preventDefault()
    // Parse punto_emision "est-pto-tipo" into separate fields
    const partes = (sarConfig.punto_emision || '001-001-01').split('-')
    const payload = {
      cai: sarConfig.cai,
      rango_inicial: sarConfig.rango_inicio,
      rango_final: sarConfig.rango_fin,
      fecha_limite_emision: sarConfig.fecha_limite,
      establecimiento: partes[0] || '001',
      punto_emision: partes[1] || '001',
      tipo_documento: partes[2] || '01',
    }
    await api.post('/facturas/sar/config', payload)
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


  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500000) return toast.error('El logo no debe superar 500KB')
    setLogoUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result
        await api.post('/configuracion/logo', { logo_base64: base64 })
        toast.success('Logo subido correctamente')
        setConfig(p => ({ ...p, hotel_logo: base64 }))
        setLogoUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast.error('Error al subir el logo')
      setLogoUploading(false)
    }
  }

  const handleLogoDelete = async () => {
    if (!confirm('¿Eliminar el logo del hotel?')) return
    await api.delete('/configuracion/logo')
    setConfig(p => ({ ...p, hotel_logo: '' }))
    toast.success('Logo eliminado')
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

          {/* Impuestos */}
          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Impuestos Fiscales (Honduras)</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">ISV — Impuesto Sobre Ventas (%)</label>
                <input type="number" step="0.01" value={c('isv_porcentaje') || '15'} onChange={e => setC('isv_porcentaje', e.target.value)} className="input-field" />
                <p className="text-xs text-slate-600 mt-1">Aplica a hospedaje y otros servicios (restaurante, lavandería, etc.)</p>
              </div>
              <div>
                <label className="label">IHT — Impuesto Turístico (%)</label>
                <input type="number" step="0.01" value={c('iht_porcentaje') || '4'} onChange={e => setC('iht_porcentaje', e.target.value)} className="input-field" />
                <p className="text-xs text-slate-600 mt-1">Aplica solo a hospedaje. Se cobra incluso si el cliente está exonerado de ISV.</p>
              </div>
            </div>
          </div>

          {/* Horarios */}
          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Horarios y Recargos</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Hora de Check-In</label>
                <input type="time" value={c('hora_checkin') || '15:00'} onChange={e => setC('hora_checkin', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Hora de Check-Out</label>
                <input type="time" value={c('hora_checkout') || '12:00'} onChange={e => setC('hora_checkout', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Recargo por Hora Extra (%)</label>
                <input type="number" step="0.01" value={c('recargo_hora_porcentaje') || '10'} onChange={e => setC('recargo_hora_porcentaje', e.target.value)} className="input-field" />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2">Este recargo se muestra en la hoja de recepción impresa para informar al huésped.</p>
          </div>
            <div className="sm:col-span-2">
              <label className="label">Logo del Hotel (aparece en facturas)</label>
              <div className="flex items-start gap-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                {c('hotel_logo') ? (
                  <div className="flex-shrink-0">
                    <img src={c('hotel_logo')} alt="Logo" className="max-h-20 max-w-40 object-contain rounded border border-slate-600 bg-white p-1" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded border-2 border-dashed border-slate-600 flex items-center justify-center flex-shrink-0 bg-slate-800">
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-slate-400">PNG, JPG o SVG · Máximo 500KB · Recomendado 300×100px</p>
                  <div className="flex gap-2">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <button type="button" onClick={() => logoInputRef.current.click()}
                      className="btn-secondary text-xs flex items-center gap-1.5" disabled={logoUploading}>
                      <Upload className="w-3.5 h-3.5" /> {logoUploading ? 'Subiendo...' : c('hotel_logo') ? 'Cambiar Logo' : 'Subir Logo'}
                    </button>
                    {c('hotel_logo') && (
                      <button type="button" onClick={handleLogoDelete} className="text-red-500 hover:text-red-400 text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
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

      {/* Panel: Email */}
      {tab === 'email' && (
        <form onSubmit={guardarConfig} className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Notificaciones por Correo Electrónico</h2>
            <p className="text-slate-500 text-sm mt-1">Configurá un servidor SMTP para enviar confirmaciones de reserva, check-in y facturas por email.</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm space-y-2">
            <p className="text-blue-300 font-medium">📧 Ejemplo con Gmail:</p>
            <ul className="text-blue-400/80 space-y-1 list-disc list-inside text-xs">
              <li>Host: <span className="font-mono bg-blue-500/10 px-1 rounded">smtp.gmail.com</span> · Puerto: <span className="font-mono bg-blue-500/10 px-1 rounded">587</span></li>
              <li>Usuario: tu correo completo (ej: hotel@gmail.com)</li>
              <li>Contraseña: necesitás una <strong>contraseña de aplicación</strong> (no la contraseña normal de Gmail)</li>
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Servidor SMTP (Host)</label>
              <input value={c('smtp_host')} onChange={e => setC('smtp_host', e.target.value)} className="input-field" placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="label">Puerto</label>
              <input value={c('smtp_port') || '587'} onChange={e => setC('smtp_port', e.target.value)} className="input-field" placeholder="587" />
            </div>
            <div>
              <label className="label">Usuario / Correo</label>
              <input value={c('smtp_user')} onChange={e => setC('smtp_user', e.target.value)} className="input-field" placeholder="hotel@gmail.com" />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input type="password" value={c('smtp_pass')} onChange={e => setC('smtp_pass', e.target.value)} className="input-field" placeholder="••••••••" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Correo Remitente (From)</label>
              <input value={c('smtp_from')} onChange={e => setC('smtp_from', e.target.value)} className="input-field" placeholder="reservas@tuhotel.com" />
            </div>
          </div>
          <div>
            <label className="label mb-2 block">Activar notificaciones por email para:</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: 'notif_email_reservas', label: '📅 Nueva Reserva' },
                { key: 'notif_email_checkin', label: '✅ Check-In' },
                { key: 'notif_email_factura', label: '🧾 Factura Emitida' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 bg-slate-700/40 rounded-lg cursor-pointer hover:bg-slate-700/60 transition-colors">
                  <input type="checkbox" checked={c(key) === '1' || c(key) === true}
                    onChange={e => setC(key, e.target.checked ? '1' : '0')}
                    className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar Email</button>
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
            <h2 className="text-lg font-semibold text-slate-200 mb-1">Tarifas y Temporadas</h2>
            <p className="text-slate-500 text-sm mb-2">Etiquetas generales de referencia (temporada alta/baja, fin de semana, etc.) — no están ligadas a un tipo de habitación específico.</p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4 text-xs text-blue-300">
              💡 ¿Buscás poner el precio de "Sencilla Standard" o crear una tarifa especial para un cliente como Visión Mundial?
              Eso se hace en <strong>Tipos de Habitación</strong> (pestaña arriba) y en <strong>Clientes Corporativos → botón Tarifas</strong>.
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                let tarifasArr = []
                try {
                  const parsed = JSON.parse(config.tarifas || '[]')
                  tarifasArr = Array.isArray(parsed) ? parsed : []
                } catch { tarifasArr = [] }
                return tarifasArr.map((t, i) => (
                  <div key={i} className="bg-slate-700/40 border border-slate-600 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500 text-slate-400">{t.tipo}</span>
                    </div>
                    <p className="font-medium text-slate-200">{t.nombre}</p>
                    <p className="text-2xl font-bold text-brand-400 mt-1">L. {(parseFloat(t.precio) || 0).toFixed(2)}</p>
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

      {/* Panel: Tipos de Habitación */}
      {tab === 'tipos_habitacion' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={abrirNuevoTipoHab} className="btn-primary">
              <Plus className="w-4 h-4" /> Nuevo Tipo
            </button>
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-200 mb-1">Catálogo de Tipos de Habitación</h2>
            <p className="text-slate-500 text-sm mb-4">
              Estos tipos aparecen en el selector al crear o editar una habitación. Las tarifas de descuento (10/15/20%) se sugieren al elegir el tipo en una reserva — el recepcionista igual puede escribir cualquier otro valor.
            </p>
            {tiposHabitacion.length === 0 ? (
              <div className="text-center py-10 text-slate-600">
                <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No hay tipos de habitación configurados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 px-3">Pax</th>
                      <th className="py-2 px-3 text-right">Normal</th>
                      <th className="py-2 px-3 text-right">10%</th>
                      <th className="py-2 px-3 text-right">15%</th>
                      <th className="py-2 px-3 text-right">20%</th>
                      <th className="py-2 px-3 text-center">Estado</th>
                      <th className="py-2 pl-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiposHabitacion.map(t => (
                      <tr key={t.id} className={`border-b border-slate-800 ${!t.activo ? 'opacity-50' : ''}`}>
                        <td className="py-2.5 pr-3 font-medium text-slate-200">{t.nombre}</td>
                        <td className="py-2.5 px-3 text-slate-500">{t.capacidad_sugerida}</td>
                        <td className="py-2.5 px-3 text-right text-brand-400 font-semibold"><PrecioDual monto={t.precio_sugerido} size="sm" /></td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{t.precio_10 != null ? <PrecioDual monto={t.precio_10} size="xs" /> : '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{t.precio_15 != null ? <PrecioDual monto={t.precio_15} size="xs" /> : '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{t.precio_20 != null ? <PrecioDual monto={t.precio_20} size="xs" /> : '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${t.activo ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-600 text-slate-500'}`}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => abrirEditarTipoHab(t)} className="text-slate-400 hover:text-brand-400 p-1" title="Editar">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => toggleTipoHab(t)} className="text-slate-400 hover:text-red-400 p-1" title={t.activo ? 'Desactivar' : 'Activar'}>
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showTipoHab && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-white">{tipoHabForm.id ? 'Editar Tipo' : 'Nuevo Tipo de Habitación'}</h2>
                  <button onClick={() => setShowTipoHab(false)}><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <form onSubmit={guardarTipoHab} className="p-6 space-y-4">
                  <div>
                    <label className="label">Nombre *</label>
                    <input value={tipoHabForm.nombre} onChange={e => setTipoHabForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" placeholder="Sencilla Standard, Suite Junior, etc." required autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Capacidad Sugerida</label>
                      <input type="number" min="1" value={tipoHabForm.capacidad_sugerida} onChange={e => setTipoHabForm(p => ({ ...p, capacidad_sugerida: e.target.value }))} className="input-field" />
                    </div>
                    <div>
                      <label className="label">Precio Normal *</label>
                      <MoneyInput valueHNL={tipoHabForm.precio_sugerido} onChange={val => handlePrecioNormalChange(val)} required />
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tarifas con Descuento</p>
                    <p className="text-xs text-slate-600 mb-3">Se calculan automáticamente del precio Normal, pero podés ajustarlas si el descuento real negociado no es exacto.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">10% off</label>
                        <MoneyInput valueHNL={tipoHabForm.precio_10}
                          onChange={val => setTipoHabForm(p => ({ ...p, precio_10: val, _editado10: true }))} />
                      </div>
                      <div>
                        <label className="label text-xs">15% off</label>
                        <MoneyInput valueHNL={tipoHabForm.precio_15}
                          onChange={val => setTipoHabForm(p => ({ ...p, precio_15: val, _editado15: true }))} />
                      </div>
                      <div>
                        <label className="label text-xs">20% off</label>
                        <MoneyInput valueHNL={tipoHabForm.precio_20}
                          onChange={val => setTipoHabForm(p => ({ ...p, precio_20: val, _editado20: true }))} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Descripción</label>
                    <input value={tipoHabForm.descripcion} onChange={e => setTipoHabForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" placeholder="Opcional" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowTipoHab(false)} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary"><BedDouble className="w-4 h-4" /> Guardar</button>
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
