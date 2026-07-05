// src/pages/FacturasPage.jsx - Facturación SAR Honduras con impresión profesional
// Modelo de impuestos: cada ítem aplica ISV (15%) e IHT (4%) de forma INDEPENDIENTE.
//  - Hospedaje: ISV + IHT simultáneos
//  - Otros servicios: solo ISV
//  - Cliente exonerado de ISV: se sigue cobrando el IHT igual
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, FileText, Printer, X, Eye, AlertTriangle, LogOut } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'
import MoneyInput from '../components/common/MoneyInput'
import { useTasaCambio } from '../context/TasaCambioContext'

const PRESETS = {
  HOSPEDAJE: { label: 'Hospedaje (ISV+IHT)', aplica_isv: true,  aplica_iht: true  },
  SERVICIO:  { label: 'Otro servicio (ISV)',  aplica_isv: true,  aplica_iht: false },
  EXENTO:    { label: 'Exento (sin impuesto)', aplica_isv: false, aplica_iht: false },
}

const ITEM_INIT = { descripcion: 'Hospedaje', cantidad: 1, precio_unitario: '', aplica_isv: true, aplica_iht: true }

export default function FacturasPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tasaVenta, tieneTasa } = useTasaCambio() || {}
  const [facturas, setFacturas] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [sarConfig, setSarConfig] = useState(null)
  const [showEmitir, setShowEmitir] = useState(false)
  const [showVista, setShowVista] = useState(false)
  const [facturaDetalle, setFacturaDetalle] = useState(null)
  const [huespedExento, setHuespedExento] = useState(false)
  // Cuando la factura se origina desde un checkout en Planning, guardamos el
  // checkin_id para poder ofrecer "volver y completar el Check-Out" al emitir.
  const [checkinOrigenId, setCheckinOrigenId] = useState(null)
  const [form, setForm] = useState({
    huesped_id:'', cliente_nombre:'', cliente_rtn:'', cliente_direccion:'',
    metodo_pago:'EFECTIVO', moneda:'HNL', tasa_cambio:1, descuento:0, observaciones:'',
    items: [{ ...ITEM_INIT }],
  })

  const cargar = async () => {
    const [f, h, sar] = await Promise.all([
      api.get('/facturas'),
      api.get('/huespedes', { params: { limit: 200 } }),
      api.get('/facturas/sar/config').catch(() => ({ data: { data: null } })),
    ])
    setFacturas(f.data.data || [])
    setHuespedes(h.data.data || [])
    setSarConfig(sar.data.data)
  }

  useEffect(() => { cargar() }, [])

  // Si llegamos desde Planning (botón Check-Out), precargar la factura con
  // el huésped, habitación y servicios extra reales del folio de ese check-in.
  useEffect(() => {
    const precarga = location.state?.precargarDesdeCheckin
    if (!precarga?.checkin_id) return

    const cargarDesdeCheckin = async () => {
      try {
        const r = await api.get(`/checkins/${precarga.checkin_id}`)
        const ci = r.data.data
        if (!ci) return

        const huesped = huespedes.find(h => h.id === ci.huesped_id)
          || { id: ci.huesped_id, nombres: ci.nombres, apellidos: ci.apellidos, rtn: ci.rtn, exento_isv: ci.exento_isv }

        const noches = Math.max(1, Math.round(
          (new Date() - new Date(ci.fecha_checkin)) / 86400000
        ))

        const itemsPrecargados = [{
          descripcion: `Hospedaje ${noches} noche(s) — Hab. ${ci.numero}`,
          cantidad: noches,
          precio_unitario: ci.tarifa_aplicada,
          aplica_isv: true,
          aplica_iht: true,
        }]
        ;(ci.extras || []).forEach(ex => {
          itemsPrecargados.push({
            descripcion: ex.descripcion,
            cantidad: ex.cantidad,
            precio_unitario: ex.precio_unitario,
            aplica_isv: true,
            aplica_iht: false,
          })
        })

        setForm(p => ({
          ...p,
          huesped_id: ci.huesped_id,
          cliente_nombre: `${ci.nombres} ${ci.apellidos}`,
          cliente_rtn: ci.rtn || '',
          items: itemsPrecargados,
        }))
        setHuespedExento(!!ci.exento_isv)
        setCheckinOrigenId(precarga.checkin_id)
        setShowEmitir(true)
      } catch {
        toast.error('No se pudo cargar el folio del check-in')
      } finally {
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
    cargarDesdeCheckin()
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const autocompletar = (hId) => {
    const h = huespedes.find(x => x.id == hId)
    if (h) {
      setForm(p => ({ ...p, huesped_id: hId, cliente_nombre: `${h.nombres} ${h.apellidos}`, cliente_rtn: h.rtn || '' }))
      setHuespedExento(!!h.exento_isv)
    }
  }

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { descripcion:'', cantidad:1, precio_unitario:'', aplica_isv:true, aplica_iht:false }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, k, v) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? {...it, [k]: v} : it) }))
  const aplicarPreset = (i, presetKey) => {
    const preset = PRESETS[presetKey]
    updateItem(i, 'aplica_isv', preset.aplica_isv)
    setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, aplica_isv: preset.aplica_isv, aplica_iht: preset.aplica_iht } : it) }))
  }

  const calcTotales = () => {
    let exento = 0, baseIsv = 0, baseIht = 0, subtotalGeneral = 0
    form.items.forEach(it => {
      const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)
      const aplicaIsv = it.aplica_isv && !huespedExento
      const aplicaIht = it.aplica_iht
      subtotalGeneral += sub
      if (aplicaIsv) baseIsv += sub
      if (aplicaIht) baseIht += sub
      if (!aplicaIsv && !aplicaIht) exento += sub
    })
    const isv = baseIsv * 0.15
    const iht = baseIht * 0.04
    const desc = parseFloat(form.descuento) || 0
    // OJO: baseIsv y baseIht son bases gravables para el desglose (se solapan
    // a propósito en hospedaje, que paga ambos impuestos sobre el mismo monto).
    // El total es subtotalGeneral (cada línea UNA vez) + impuestos - descuento.
    return { exento, baseIsv, baseIht, isv, iht, desc, total: subtotalGeneral + isv + iht - desc }
  }

  const emitir = async (e) => {
    e.preventDefault()
    const { total } = calcTotales()
    if (total <= 0) return toast.error('El total debe ser mayor a cero')
    await api.post('/facturas', {
      ...form,
      checkin_id: checkinOrigenId || null, // vincula la factura al check-in de origen (evita duplicados al completar el Check-Out)
      forzar_exento_isv: huespedExento,
      items: form.items.map(it => ({
        ...it,
        cantidad: parseFloat(it.cantidad),
        precio_unitario: parseFloat(it.precio_unitario),
      })),
    })

    const origenCheckin = checkinOrigenId
    setShowEmitir(false)
    setForm({ huesped_id:'', cliente_nombre:'', cliente_rtn:'', cliente_direccion:'', metodo_pago:'EFECTIVO', moneda:'HNL', tasa_cambio:1, descuento:0, observaciones:'', items: [{ ...ITEM_INIT }] })
    setHuespedExento(false)
    setCheckinOrigenId(null)
    cargar()

    if (origenCheckin) {
      // La factura ya quedó vinculada a este checkin (paso anterior). Ahora
      // completamos el Check-Out real en el mismo paso — habitación a limpieza,
      // checkin y reserva cerrados — en vez de dejarlo como tarea pendiente
      // manual. El backend detecta que la factura ya existe (por checkin_id)
      // y NO genera una segunda, solo cierra los estados y notifica.
      try {
        await api.post(`/checkins/${origenCheckin}/checkout`, { generar_factura: true })
        toast.success('Factura emitida y Check-Out completado ✅')
      } catch (e) {
        toast.error(e.response?.data?.error || 'Factura emitida, pero no se pudo completar el Check-Out')
        toast(
          (t) => (
            <span className="flex items-center gap-3">
              Completá el Check-Out manualmente.
              <button
                onClick={() => { toast.dismiss(t.id); navigate('/checkins') }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" /> Ir a Check-Out
              </button>
            </span>
          ),
          { duration: 10000 }
        )
      }
    } else {
      toast.success('Factura emitida exitosamente')
    }
  }

  const verDetalle = async (id) => {
    const r = await api.get(`/facturas/${id}`)
    setFacturaDetalle(r.data.data)
    setShowVista(true)
  }

  const anular = async (id) => {
    const motivo = prompt('Motivo de anulación:')
    if (!motivo) return
    await api.patch(`/facturas/${id}/anular`, { motivo })
    toast.success('Factura anulada')
    cargar()
  }

  const tots = calcTotales()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Facturación SAR Honduras</h1>
        <button onClick={() => setShowEmitir(true)} className="btn-primary"><Plus className="w-4 h-4" /> Emitir Factura</button>
      </div>

      {!sarConfig && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 text-sm">No hay configuración SAR activa. Configurá el CAI antes de emitir facturas.</p>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['N° Factura','Cliente','RTN','Total','ISV/IHT','Método','Estado','Acciones'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
          <tbody>
            {facturas.length === 0
              ? <tr><td colSpan={8} className="text-center py-12 text-slate-600">No hay facturas emitidas</td></tr>
              : facturas.map(f => (
                <tr key={f.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-brand-400">{f.numero_factura}</td>
                  <td className="table-cell text-slate-300 text-sm">{f.cliente_nombre}</td>
                  <td className="table-cell text-slate-500 text-xs">{f.cliente_rtn || '—'}</td>
                  <td className="table-cell font-semibold text-slate-200"><PrecioDual monto={f.total} size="sm" /></td>
                  <td className="table-cell text-xs text-slate-400">L. {f.isv_15?.toFixed(2)} / L. {f.iht_4?.toFixed(2)}</td>
                  <td className="table-cell text-slate-400 text-xs">{f.metodo_pago}</td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${f.estado === 'EMITIDA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{f.estado}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => verDetalle(f.id)} className="text-brand-400 hover:text-brand-300 p-1" title="Ver e imprimir"><Eye className="w-4 h-4" /></button>
                      {f.estado === 'EMITIDA' && <button onClick={() => anular(f.id)} className="text-red-500 hover:text-red-400 p-1" title="Anular"><X className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal Emitir Factura */}
      {showEmitir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Emitir Factura Fiscal</h2>
              <button onClick={() => setShowEmitir(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={emitir} className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos del Adquiriente</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Huésped / Facturar a</label>
                    <select onChange={e => autocompletar(e.target.value)} className="input-field">
                      <option value="">Seleccionar huésped...</option>
                      {huespedes.map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos}{h.exento_isv ? ' (Exonerado ISV)' : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Nombre en Factura *</label>
                    <input value={form.cliente_nombre} onChange={e=>setForm(p=>({...p,cliente_nombre:e.target.value}))} className="input-field" required />
                  </div>
                  <div>
                    <label className="label">RTN / Cédula</label>
                    <input value={form.cliente_rtn} onChange={e=>setForm(p=>({...p,cliente_rtn:e.target.value}))} className="input-field" placeholder="Consumidor Final si está en blanco" />
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input value={form.cliente_direccion} onChange={e=>setForm(p=>({...p,cliente_direccion:e.target.value}))} className="input-field" />
                  </div>
                </div>

                <label className="flex items-center gap-3 mt-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={huespedExento}
                    onChange={e => setHuespedExento(e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <div>
                    <span className="text-sm text-slate-300">Cliente exonerado de ISV en esta factura</span>
                    <p className="text-xs text-slate-500">El Impuesto Turístico (4%) se cobra igual aunque esté exonerado</p>
                  </div>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Descripción de Servicios</h3>
                  <button type="button" onClick={addItem} className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar línea</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="bg-slate-900/30 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input value={item.descripcion} onChange={e=>updateItem(i,'descripcion',e.target.value)} placeholder="Descripción" className="input-field col-span-5" required />
                        <input type="number" min="1" value={item.cantidad} onChange={e=>updateItem(i,'cantidad',e.target.value)} placeholder="Cant." className="input-field col-span-2" />
                        <div className="col-span-4">
                          <MoneyInput valueHNL={item.precio_unitario} onChange={val=>updateItem(i,'precio_unitario',val)} placeholder="Precio" required />
                        </div>
                        <button type="button" onClick={()=>removeItem(i)} disabled={form.items.length === 1} className="col-span-1 text-red-500 hover:text-red-400 disabled:opacity-30 flex justify-center">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-slate-500">Atajos:</span>
                        {Object.entries(PRESETS).map(([key, p]) => (
                          <button key={key} type="button" onClick={() => aplicarPreset(i, key)}
                            className="text-xs px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 hover:bg-slate-700">
                            {p.label}
                          </button>
                        ))}
                        <span className="text-slate-600">|</span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={item.aplica_isv} onChange={e => updateItem(i, 'aplica_isv', e.target.checked)} className="w-3.5 h-3.5 rounded" />
                          ISV 15%
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={item.aplica_iht} onChange={e => updateItem(i, 'aplica_iht', e.target.checked)} className="w-3.5 h-3.5 rounded" />
                          IHT 4%
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400"><span>Exento</span><span>L. {tots.exento.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Base ISV 15%{huespedExento && ' (exonerado)'}</span><span>L. {tots.baseIsv.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>ISV (15%)</span><span>L. {tots.isv.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Base IHT 4%</span><span>L. {tots.baseIht.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>IHT (4%)</span><span>L. {tots.iht.toFixed(2)}</span></div>
                {tots.desc > 0 && <div className="flex justify-between text-red-400"><span>Descuento</span><span>-L. {tots.desc.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-white text-base border-t border-slate-700 pt-2 mt-2">
                  <span>TOTAL A PAGAR</span><span className="text-brand-400"><PrecioDual monto={tots.total} size="base" /></span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Método de Pago *</label>
                  <select value={form.metodo_pago} onChange={e=>setForm(p=>({...p,metodo_pago:e.target.value}))} className="input-field">
                    {['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO','MIXTO'].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Descuento</label>
                  <MoneyInput valueHNL={form.descuento} onChange={val => setForm(p=>({...p,descuento:val}))} placeholder="0.00" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowEmitir(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={!sarConfig}><FileText className="w-4 h-4" /> Emitir Factura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vista Previa de Impresión */}
      {showVista && facturaDetalle && (
        <FacturaPrintModal
          factura={facturaDetalle}
          onClose={() => setShowVista(false)}
        />
      )}
    </div>
  )
}

// ─── Modal de impresión — formato basado en factura real Hotel Las Cascadas ──
function FacturaPrintModal({ factura, onClose }) {
  const printRef = useRef()

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=800,height=900')
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>Factura ${factura.numero_factura}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
          .factura-wrap { max-width: 720px; margin: 0 auto; padding: 28px 32px; }
          table { width:100%; border-collapse:collapse; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print() }, 350)
  }

  const det = factura.detalle || []
  const h = factura.hotel || {}

  // Formas de pago al estilo checkbox como la factura física de referencia
  const formasPago = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO']

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b rounded-t-xl flex-shrink-0">
          <span className="font-semibold text-gray-700 text-sm">Vista Previa — Factura {factura.numero_factura}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button onClick={onClose}
              className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300">
              <X className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 bg-gray-100 p-4">
          <div ref={printRef}>
            <div className="factura-wrap bg-white rounded shadow-sm" style={{maxWidth:'720px',margin:'0 auto',padding:'28px 32px',fontFamily:'Arial,Helvetica,sans-serif',fontSize:'11px',color:'#111'}}>

              {factura.estado === 'ANULADA' && (
                <div style={{position:'relative'}}>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-30deg)',fontSize:'72px',fontWeight:900,color:'rgba(220,38,38,0.10)',textTransform:'uppercase',pointerEvents:'none',letterSpacing:'8px',zIndex:1}}>ANULADA</div>
                </div>
              )}

              {/* ENCABEZADO */}
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',borderBottom:'2px solid #1B3A6B',paddingBottom:'16px',marginBottom:'16px'}}>
                <div>
                  {h.hotel_logo && (
                    <img src={h.hotel_logo} alt="Logo" style={{maxHeight:'70px',maxWidth:'160px',objectFit:'contain',marginBottom:'6px'}} />
                  )}
                  <div style={{fontSize:'18px',fontWeight:900,color:'#1B3A6B',marginBottom:'3px'}}>{h.hotel_nombre || 'HOTEL'}</div>
                  <div style={{fontSize:'10px',color:'#555',lineHeight:'1.6'}}>
                    <div>{h.hotel_direccion}</div>
                    {h.hotel_ciudad && <div>{h.hotel_ciudad}, {h.hotel_pais || 'Honduras'}</div>}
                    <div>Tel: {h.hotel_telefono} {h.hotel_email ? `| ${h.hotel_email}` : ''}</div>
                    {h.hotel_web && <div>{h.hotel_web}</div>}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'1px'}}>Factura</div>
                  <div style={{fontSize:'15px',fontWeight:900,color:'#1B3A6B',margin:'3px 0',fontFamily:'monospace'}}>{factura.numero_factura}</div>
                  <div style={{fontSize:'10px',color:'#555'}}>{new Date(factura.created_at).toLocaleDateString('es-HN',{day:'2-digit',month:'long',year:'numeric'})}</div>
                  <div style={{fontSize:'10px',color:'#888',marginTop:'4px'}}>RTN: <strong style={{color:'#1B3A6B'}}>{h.hotel_rtn}</strong></div>
                </div>
              </div>

              {/* CAI */}
              <div style={{background:'#f0f4ff',border:'1px solid #c7d7fe',borderRadius:'6px',padding:'10px 14px',marginBottom:'14px',fontSize:'9.5px',color:'#333'}}>
                <div style={{marginBottom:'2px'}}><strong style={{color:'#1B3A6B'}}>C.A.I.:</strong> {factura.cai}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px'}}>
                  <div><strong>Fecha Límite Emisión:</strong> {factura.fecha_limite_emision || '—'}</div>
                  <div><strong>Rango Autorizado:</strong> {factura.rango_inicial || '—'} al {factura.rango_final || '—'}</div>
                </div>
              </div>

              {/* ADQUIRIENTE */}
              <div style={{marginBottom:'14px'}}>
                <div style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#888',marginBottom:'6px',borderBottom:'1px solid #e5e7eb',paddingBottom:'3px'}}>Datos del Adquiriente</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 20px',fontSize:'10.5px'}}>
                  <div><span style={{color:'#888',marginRight:'6px'}}>Cliente:</span><strong>{factura.cliente_nombre}</strong></div>
                  <div><span style={{color:'#888',marginRight:'6px'}}>RTN/Cédula:</span><strong>{factura.cliente_rtn || 'CONSUMIDOR FINAL'}</strong></div>
                  {factura.cliente_direccion && <div style={{gridColumn:'1/-1'}}><span style={{color:'#888',marginRight:'6px'}}>Dirección:</span>{factura.cliente_direccion}</div>}
                </div>
              </div>

              {/* DETALLE — columnas Cant. / Hab. / P.Unitario / Total, estilo factura física */}
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'10.5px'}}>
                <thead>
                  <tr style={{background:'#1B3A6B',color:'#fff'}}>
                    <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,fontSize:'10px'}}>Descripción</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>Cant.</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>P. Unitario</th>
                    <th style={{padding:'7px 8px',textAlign:'center',fontWeight:600,fontSize:'10px'}}>ISV</th>
                    <th style={{padding:'7px 8px',textAlign:'center',fontWeight:600,fontSize:'10px'}}>IHT</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {det.map((d, i) => (
                    <tr key={i} style={{borderBottom:'1px solid #f0f0f0',background: i%2===1 ? '#f9faff' : '#fff'}}>
                      <td style={{padding:'6px 8px'}}>{d.descripcion}</td>
                      <td style={{padding:'6px 8px',textAlign:'right'}}>{d.cantidad}</td>
                      <td style={{padding:'6px 8px',textAlign:'right'}}>L. {Number(d.precio_unitario).toFixed(2)}</td>
                      <td style={{padding:'6px 8px',textAlign:'center',fontSize:'9px'}}>{d.aplica_isv ? '✓' : '—'}</td>
                      <td style={{padding:'6px 8px',textAlign:'center',fontSize:'9px'}}>{d.aplica_iht ? '✓' : '—'}</td>
                      <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600}}>L. {Number(d.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALES + FORMA DE PAGO (checkboxes, estilo factura real) */}
              <div style={{display:'flex',justifyContent:'space-between',gap:'20px',marginBottom:'16px',flexWrap:'wrap'}}>
                {/* Forma de pago */}
                <div style={{fontSize:'10px',minWidth:'180px'}}>
                  <div style={{fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'1px',fontSize:'9px',marginBottom:'6px'}}>Forma de Pago</div>
                  {formasPago.map(fp => (
                    <div key={fp} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'}}>
                      <span style={{
                        width:'12px',height:'12px',border:'1.5px solid #555',display:'inline-block',
                        textAlign:'center',lineHeight:'10px',fontSize:'9px',fontWeight:900,
                        background: factura.metodo_pago === fp ? '#1B3A6B' : '#fff',
                        color: factura.metodo_pago === fp ? '#fff' : '#fff',
                      }}>{factura.metodo_pago === fp ? '✓' : ''}</span>
                      <span style={{color: factura.metodo_pago === fp ? '#1B3A6B' : '#888', fontWeight: factura.metodo_pago === fp ? 700 : 400}}>{fp}</span>
                    </div>
                  ))}
                </div>

                {/* Totales */}
                <div style={{width:'280px',fontSize:'10.5px'}}>
                  {factura.subtotal_exento > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Importe Exento</span><span>L. {Number(factura.subtotal_exento).toFixed(2)}</span></div>}
                  {factura.subtotal_gravado_isv > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Importe Gravado 15%</span><span>L. {Number(factura.subtotal_gravado_isv).toFixed(2)}</span></div>}
                  {factura.isv_15 > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>ISV (15%)</span><span>L. {Number(factura.isv_15).toFixed(2)}</span></div>}
                  {factura.subtotal_gravado_iht > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Base Tasa Turística</span><span>L. {Number(factura.subtotal_gravado_iht).toFixed(2)}</span></div>}
                  {factura.iht_4 > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Tasa Turística (4%)</span><span>L. {Number(factura.iht_4).toFixed(2)}</span></div>}
                  {factura.descuento > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0',color:'#dc2626'}}><span>Descuento</span><span>-L. {Number(factura.descuento).toFixed(2)}</span></div>}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid #1B3A6B',paddingTop:'6px',marginTop:'4px',fontSize:'13px',fontWeight:900,color:'#1B3A6B'}}>
                    <span>GRAN TOTAL</span><span style={{fontSize:'14px'}}>L. {Number(factura.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* PIE */}
              <div style={{marginTop:'10px',borderTop:'1px dashed #ccc',paddingTop:'12px',textAlign:'center',fontSize:'9px',color:'#999',lineHeight:'1.8'}}>
                {h.factura_pie
                  ? <p style={{color:'#555',marginBottom:'4px'}}>{h.factura_pie}</p>
                  : null}
                <p>"La Factura es Beneficio de Todos, Exíjala"</p>
                <p>Este documento es una representación impresa de una Factura emitida conforme a SAR Honduras.</p>
                <p style={{marginTop:'4px',color:'#bbb'}}>Generado por <strong style={{color:'#1B3A6B'}}>MetricRoom</strong> · {new Date().toLocaleString('es-HN')}</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
