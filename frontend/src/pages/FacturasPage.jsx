// src/pages/FacturasPage.jsx - Emisión de facturas SAR Honduras + vista previa de impresión
import { useState, useEffect } from 'react'
import { Plus, FileText, Printer, X, Eye, AlertTriangle } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [sarConfig, setSarConfig] = useState(null)
  const [showEmitir, setShowEmitir] = useState(false)
  const [showVista, setShowVista] = useState(false)
  const [facturaDetalle, setFacturaDetalle] = useState(null)
  const [hotelConfig, setHotelConfig] = useState({})
  const [form, setForm] = useState({
    huesped_id:'', cliente_nombre:'', cliente_rtn:'', cliente_direccion:'',
    metodo_pago:'EFECTIVO', moneda:'HNL', tasa_cambio:1, descuento:0, observaciones:'',
    items: [{ descripcion:'Hospedaje', cantidad:1, precio_unitario:'', tipo_impuesto:'IHT' }]
  })

  const cargar = async () => {
    const [f, h, sar, conf] = await Promise.all([
      api.get('/facturas'),
      api.get('/huespedes', { params: { limit: 200 } }),
      api.get('/facturas/sar/config').catch(() => ({ data: { data: null } })),
      api.get('/configuracion'),
    ])
    setFacturas(f.data.data || [])
    setHuespedes(h.data.data || [])
    setSarConfig(sar.data.data)
    setHotelConfig(conf.data.data || {})
  }

  useEffect(() => { cargar() }, [])

  const autocompletar = (hId) => {
    const h = huespedes.find(x => x.id == hId)
    if (h) setForm(p => ({
      ...p, huesped_id: hId,
      cliente_nombre: `${h.nombres} ${h.apellidos}`,
      cliente_rtn: h.rtn || '',
    }))
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

  const imprimir = () => window.print()

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

      {/* Tabla de facturas */}
      <div className="card p-0 overflow-x-auto"><table className="w-full">
          <thead><tr>{['N° Factura','Cliente','RTN','Total','Impuesto','Método','Estado','Acciones'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
          <tbody>
            {facturas.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-600">No hay facturas emitidas</td></tr>
            : facturas.map(f => (
              <tr key={f.id} className="table-row">
                <td className="table-cell font-mono text-xs text-brand-400">{f.numero_factura}</td>
                <td className="table-cell text-slate-300 text-sm">{f.cliente_nombre}</td>
                <td className="table-cell text-slate-500 text-xs">{f.cliente_rtn || '—'}</td>
                <td className="table-cell font-semibold text-slate-200">L. {f.total?.toFixed(2)}</td>
                <td className="table-cell text-xs text-slate-400">ISV: {f.isv_15?.toFixed(2)} | IHT: {f.iht_4?.toFixed(2)}</td>
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
              {/* Datos del cliente */}
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

              {/* Items */}
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

              {/* Totales */}
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

      {/* Vista previa de impresión */}
      {showVista && facturaDetalle && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            {/* Botones de acción (no imprimen) */}
            <div className="no-print flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl">
              <h3 className="font-semibold text-gray-700">Vista Previa de Factura</h3>
              <div className="flex gap-2">
                <button onClick={imprimir} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Printer className="w-4 h-4" /> Imprimir</button>
                <button onClick={() => setShowVista(false)} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300"><X className="w-4 h-4" /> Cerrar</button>
              </div>
            </div>
            {/* Contenido imprimible */}
            <FacturaPrintable factura={facturaDetalle} hotel={facturaDetalle.hotel} />
          </div>
        </div>
      )}
    </div>
  )
}

function FacturaPrintable({ factura, hotel }) {
  if (!factura) return null
  return (
    <div className="p-8 font-mono text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Encabezado del hotel */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-black">{hotel?.hotel_nombre || 'HOTEL'}</h1>
        <p>{hotel?.hotel_direccion}</p>
        <p>RTN: {hotel?.hotel_rtn} | Tel: {hotel?.hotel_telefono}</p>
        <p>{hotel?.hotel_email}</p>
      </div>
      <div className="border-t-2 border-black my-2" />
      <div className="text-center my-3">
        <h2 className="text-base font-black">FACTURA</h2>
        <p className="text-lg font-black">{factura.numero_factura}</p>
      </div>
      {/* CAI y datos SAR */}
      <div className="bg-gray-100 border border-gray-300 rounded p-3 mb-4 text-[10px]">
        <p><strong>CAI:</strong> {factura.cai}</p>
        <p><strong>Fecha Límite Emisión:</strong> {factura.fecha_limite || '—'}</p>
        <p><strong>Rango Autorizado:</strong> {factura.rango_inicio || '—'} al {factura.rango_fin || '—'}</p>
      </div>
      {/* Datos del adquiriente */}
      <div className="mb-4">
        <p><strong>Fecha:</strong> {new Date(factura.created_at).toLocaleDateString('es-HN')}</p>
        <p><strong>Cliente:</strong> {factura.cliente_nombre}</p>
        <p><strong>RTN/Cédula:</strong> {factura.cliente_rtn || 'CONSUMIDOR FINAL'}</p>
        {factura.cliente_direccion && <p><strong>Dirección:</strong> {factura.cliente_direccion}</p>}
      </div>
      {/* Detalle */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="border-y border-gray-400">
            <th className="text-left py-1">Descripción</th>
            <th className="text-center py-1">Cant.</th>
            <th className="text-right py-1">P.Unit.</th>
            <th className="text-right py-1">Imp.</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {(factura.detalle || []).map((d, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-1">{d.descripcion}</td>
              <td className="text-center py-1">{d.cantidad}</td>
              <td className="text-right py-1">L. {d.precio_unitario?.toFixed(2)}</td>
              <td className="text-center py-1">{d.tipo_impuesto}</td>
              <td className="text-right py-1">L. {d.subtotal?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totales */}
      <div className="border-t border-gray-400 pt-3 space-y-1">
        {factura.subtotal_exento > 0 && <div className="flex justify-between"><span>Importe Exento</span><span>L. {factura.subtotal_exento?.toFixed(2)}</span></div>}
        {factura.subtotal_gravado_isv > 0 && <div className="flex justify-between"><span>Base Imponible ISV 15%</span><span>L. {factura.subtotal_gravado_isv?.toFixed(2)}</span></div>}
        {factura.isv_15 > 0 && <div className="flex justify-between"><span>ISV (15%)</span><span>L. {factura.isv_15?.toFixed(2)}</span></div>}
        {factura.subtotal_gravado_iht > 0 && <div className="flex justify-between"><span>Base Imponible IHT 4%</span><span>L. {factura.subtotal_gravado_iht?.toFixed(2)}</span></div>}
        {factura.iht_4 > 0 && <div className="flex justify-between"><span>IHT Turístico (4%)</span><span>L. {factura.iht_4?.toFixed(2)}</span></div>}
        {factura.descuento > 0 && <div className="flex justify-between"><span>Descuento</span><span>-L. {factura.descuento?.toFixed(2)}</span></div>}
        <div className="flex justify-between font-black text-base border-t border-black pt-2 mt-2"><span>TOTAL A PAGAR</span><span>L. {factura.total?.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Método de Pago</span><span>{factura.metodo_pago}</span></div>
      </div>
      <div className="text-center text-[9px] text-gray-500 mt-6">
        <p>Este documento es una representación impresa de una Factura emitida conforme a SAR Honduras.</p>
        <p>Conserve su factura. Sin ella no hay garantía de servicio.</p>
      </div>
    </div>
  )
}
