// src/pages/FacturasPage.jsx - Facturación SAR Honduras con impresión profesional
import { useState, useEffect, useRef } from 'react'
import { Plus, FileText, Printer, X, Eye, AlertTriangle, Download } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [sarConfig, setSarConfig] = useState(null)
  const [showEmitir, setShowEmitir] = useState(false)
  const [showVista, setShowVista] = useState(false)
  const [facturaDetalle, setFacturaDetalle] = useState(null)
  const [form, setForm] = useState({
    huesped_id:'', cliente_nombre:'', cliente_rtn:'', cliente_direccion:'',
    metodo_pago:'EFECTIVO', moneda:'HNL', tasa_cambio:1, descuento:0, observaciones:'',
    items: [{ descripcion:'Hospedaje', cantidad:1, precio_unitario:'', tipo_impuesto:'IHT' }]
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

  const autocompletar = (hId) => {
    const h = huespedes.find(x => x.id == hId)
    if (h) setForm(p => ({ ...p, huesped_id: hId, cliente_nombre: `${h.nombres} ${h.apellidos}`, cliente_rtn: h.rtn || '' }))
  }

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { descripcion:'', cantidad:1, precio_unitario:'', tipo_impuesto:'ISV' }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, k, v) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? {...it, [k]: v} : it) }))

  const calcTotales = () => {
    let exento = 0, gravIsv = 0, gravIht = 0
    form.items.forEach(it => {
      const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)
      if (it.tipo_impuesto === 'ISV') gravIsv += sub
      else if (it.tipo_impuesto === 'IHT') gravIht += sub
      else exento += sub
    })
    const isv = gravIsv * 0.15
    const iht = gravIht * 0.04
    const desc = parseFloat(form.descuento) || 0
    return { exento, gravIsv, gravIht, isv, iht, desc, total: exento + gravIsv + gravIht + isv + iht - desc }
  }

  const emitir = async (e) => {
    e.preventDefault()
    const { total } = calcTotales()
    if (total <= 0) return toast.error('El total debe ser mayor a cero')
    await api.post('/facturas', { ...form, items: form.items.map(it => ({ ...it, cantidad: parseFloat(it.cantidad), precio_unitario: parseFloat(it.precio_unitario) })) })
    toast.success('Factura emitida exitosamente')
    setShowEmitir(false)
    cargar()
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
                  <td className="table-cell font-semibold text-slate-200">L. {f.total?.toFixed(2)}</td>
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
                      {huespedes.map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos}</option>)}
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
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Descripción de Servicios</h3>
                  <button type="button" onClick={addItem} className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar línea</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={item.descripcion} onChange={e=>updateItem(i,'descripcion',e.target.value)} placeholder="Descripción" className="input-field col-span-4" required />
                      <input type="number" min="1" value={item.cantidad} onChange={e=>updateItem(i,'cantidad',e.target.value)} placeholder="Cant." className="input-field col-span-1" />
                      <input type="number" step="0.01" value={item.precio_unitario} onChange={e=>updateItem(i,'precio_unitario',e.target.value)} placeholder="Precio" className="input-field col-span-3" required />
                      <select value={item.tipo_impuesto} onChange={e=>updateItem(i,'tipo_impuesto',e.target.value)} className="input-field col-span-3">
                        <option value="IHT">IHT 4% (Hab.)</option>
                        <option value="ISV">ISV 15%</option>
                        <option value="EXENTO">Exento</option>
                      </select>
                      <button type="button" onClick={()=>removeItem(i)} disabled={form.items.length === 1} className="col-span-1 text-red-500 hover:text-red-400 disabled:opacity-30 flex justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400"><span>Exento</span><span>L. {tots.exento.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Base ISV 15%</span><span>L. {tots.gravIsv.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>ISV (15%)</span><span>L. {tots.isv.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Base IHT 4%</span><span>L. {tots.gravIht.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>IHT (4%)</span><span>L. {tots.iht.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-white text-base border-t border-slate-700 pt-2 mt-2">
                  <span>TOTAL A PAGAR</span><span className="text-brand-400">L. {tots.total.toFixed(2)}</span>
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
                  <label className="label">Descuento (L.)</label>
                  <input type="number" step="0.01" value={form.descuento} onChange={e=>setForm(p=>({...p,descuento:e.target.value}))} className="input-field" />
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

// ─── Modal de impresión ───────────────────────────────────────────────────────
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
          .header { display:flex; align-items:flex-start; justify-content:space-between; border-bottom: 2px solid #1B3A6B; padding-bottom:16px; margin-bottom:16px; }
          .hotel-info h1 { font-size:18px; font-weight:900; color:#1B3A6B; margin-bottom:3px; }
          .hotel-info p { font-size:10px; color:#555; line-height:1.5; }
          .factura-title { text-align:right; }
          .factura-title .label { font-size:10px; color:#888; text-transform:uppercase; letter-spacing:1px; }
          .factura-title .numero { font-size:15px; font-weight:900; color:#1B3A6B; margin:3px 0; }
          .factura-title .fecha { font-size:10px; color:#555; }
          .logo { max-height:70px; max-width:160px; object-fit:contain; margin-bottom:6px; }
          .cai-box { background:#f0f4ff; border:1px solid #c7d7fe; border-radius:6px; padding:10px 14px; margin-bottom:14px; font-size:9.5px; color:#333; }
          .cai-box p { line-height:1.7; }
          .cai-box strong { color:#1B3A6B; }
          .section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; border-bottom:1px solid #e5e7eb; padding-bottom:3px; }
          .adquiriente { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; margin-bottom:14px; font-size:10.5px; }
          .adquiriente .row { display:flex; gap:6px; }
          .adquiriente .key { color:#888; min-width:80px; }
          .adquiriente .val { font-weight:600; color:#111; }
          table { width:100%; border-collapse:collapse; margin-bottom:14px; font-size:10.5px; }
          thead tr { background:#1B3A6B; color:#fff; }
          thead th { padding:7px 8px; text-align:left; font-weight:600; font-size:10px; }
          thead th:not(:first-child) { text-align:right; }
          tbody tr { border-bottom:1px solid #f0f0f0; }
          tbody tr:nth-child(even) { background:#f9faff; }
          tbody td { padding:6px 8px; }
          tbody td:not(:first-child) { text-align:right; }
          .totales { margin-left:auto; width:280px; font-size:10.5px; }
          .totales .row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #f0f0f0; }
          .totales .row.grand { border-top:2px solid #1B3A6B; border-bottom:none; font-size:13px; font-weight:900; color:#1B3A6B; padding-top:6px; margin-top:4px; }
          .totales .row.grand span:last-child { font-size:14px; }
          .metodo { display:inline-block; background:#e0eaff; color:#1B3A6B; border-radius:4px; padding:2px 8px; font-size:9.5px; font-weight:700; margin-top:8px; }
          .footer { margin-top:24px; border-top:1px dashed #ccc; padding-top:12px; text-align:center; font-size:9px; color:#999; line-height:1.8; }
          .footer strong { color:#555; }
          .anulada-stamp { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:72px; font-weight:900; color:rgba(220,38,38,0.12); text-transform:uppercase; pointer-events:none; z-index:999; letter-spacing:8px; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .factura-wrap { padding: 10px 14px; }
          }
        </style>
      </head>
      <body>
        ${content}
        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  const h = factura.hotel || {}
  const det = factura.detalle || []

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl">

        {/* Barra de acciones */}
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

        {/* Contenido scrollable */}
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
                <div style={{marginBottom:'2px'}}><strong style={{color:'#1B3A6B'}}>CAI:</strong> {factura.cai}</div>
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

              {/* DETALLE */}
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'10.5px'}}>
                <thead>
                  <tr style={{background:'#1B3A6B',color:'#fff'}}>
                    <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,fontSize:'10px'}}>Descripción</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>Cant.</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>P. Unitario</th>
                    <th style={{padding:'7px 8px',textAlign:'center',fontWeight:600,fontSize:'10px'}}>Impuesto</th>
                    <th style={{padding:'7px 8px',textAlign:'right',fontWeight:600,fontSize:'10px'}}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {det.map((d, i) => (
                    <tr key={i} style={{borderBottom:'1px solid #f0f0f0',background: i%2===1 ? '#f9faff' : '#fff'}}>
                      <td style={{padding:'6px 8px'}}>{d.descripcion}</td>
                      <td style={{padding:'6px 8px',textAlign:'right'}}>{d.cantidad}</td>
                      <td style={{padding:'6px 8px',textAlign:'right'}}>L. {Number(d.precio_unitario).toFixed(2)}</td>
                      <td style={{padding:'6px 8px',textAlign:'center',fontSize:'9px'}}>{d.tipo_impuesto}</td>
                      <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600}}>L. {Number(d.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALES */}
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'16px'}}>
                <div style={{width:'280px',fontSize:'10.5px'}}>
                  {factura.subtotal_exento > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Importe Exento</span><span>L. {Number(factura.subtotal_exento).toFixed(2)}</span></div>}
                  {factura.subtotal_gravado_iht > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Base IHT 4%</span><span>L. {Number(factura.subtotal_gravado_iht).toFixed(2)}</span></div>}
                  {factura.iht_4 > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>IHT Turístico (4%)</span><span>L. {Number(factura.iht_4).toFixed(2)}</span></div>}
                  {factura.subtotal_gravado_isv > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>Base ISV 15%</span><span>L. {Number(factura.subtotal_gravado_isv).toFixed(2)}</span></div>}
                  {factura.isv_15 > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:'#666'}}>ISV (15%)</span><span>L. {Number(factura.isv_15).toFixed(2)}</span></div>}
                  {factura.descuento > 0 && <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #f0f0f0',color:'#dc2626'}}><span>Descuento</span><span>-L. {Number(factura.descuento).toFixed(2)}</span></div>}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid #1B3A6B',paddingTop:'6px',marginTop:'4px',fontSize:'13px',fontWeight:900,color:'#1B3A6B'}}>
                    <span>TOTAL A PAGAR</span><span style={{fontSize:'14px'}}>L. {Number(factura.total).toFixed(2)}</span>
                  </div>
                  <div style={{marginTop:'6px'}}>
                    <span style={{display:'inline-block',background:'#e0eaff',color:'#1B3A6B',borderRadius:'4px',padding:'2px 8px',fontSize:'9.5px',fontWeight:700}}>
                      {factura.metodo_pago}
                    </span>
                  </div>
                </div>
              </div>

              {/* PIE */}
              <div style={{marginTop:'20px',borderTop:'1px dashed #ccc',paddingTop:'12px',textAlign:'center',fontSize:'9px',color:'#999',lineHeight:'1.8'}}>
                {h.factura_pie
                  ? <p style={{color:'#555',marginBottom:'4px'}}>{h.factura_pie}</p>
                  : null}
                <p>Este documento es una representación impresa de una Factura emitida conforme a SAR Honduras.</p>
                <p>Conserve su factura. Sin ella no hay garantía de servicio.</p>
                <p style={{marginTop:'4px',color:'#bbb'}}>Generado por <strong style={{color:'#1B3A6B'}}>MetricRoom</strong> · {new Date().toLocaleString('es-HN')}</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
