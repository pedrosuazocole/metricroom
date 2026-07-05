// src/pages/ReportesPage.jsx - Reportes operativos y financieros
import { useState } from 'react'
import { FileBarChart, Printer, Download, Calendar, Users, DollarSign, BarChart2 } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'

const REPORTES = [
  { id: 'cierre-caja', icon: DollarSign, label: 'Cierre de Caja', desc: 'Cuadre por turno y método de pago', color: 'emerald' },
  { id: 'libro-ventas', icon: FileBarChart, label: 'Libro de Ventas', desc: 'Ventas mensuales con desglose de impuestos', color: 'brand' },
  { id: 'libro-huespedes', icon: Users, label: 'Libro de Huéspedes', desc: 'Registro oficial de ingresos al hotel', color: 'violet' },
  { id: 'ocupacion', icon: BarChart2, label: 'Reporte de Ocupación', desc: 'Porcentaje de ocupación por período', color: 'orange' },
]

export default function ReportesPage() {
  const [activo, setActivo] = useState('cierre-caja')
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(false)

  const generar = async () => {
    setLoading(true)
    setDatos(null)
    try {
      const r = await api.get(`/reportes/${activo}`, { params: { desde: fechaDesde, hasta: fechaHasta } })
      setDatos(r.data.data)
    } catch {
      toast.error('Error al generar el reporte')
    } finally { setLoading(false) }
  }

  const imprimir = () => window.print()

  const colorMap = { emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', brand: 'text-brand-400 bg-brand-500/10 border-brand-500/20', violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20', orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        {datos && (
          <button onClick={imprimir} className="btn-secondary">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        )}
      </div>

      {/* Selector de reporte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        {REPORTES.map(rep => {
          const Icon = rep.icon
          const isActive = activo === rep.id
          return (
            <button key={rep.id} onClick={() => { setActivo(rep.id); setDatos(null) }}
              className={`card text-left transition-all hover:border-slate-500 ${isActive ? `border-${rep.color}-500/40 bg-${rep.color}-500/5` : ''}`}>
              <Icon className={`w-6 h-6 mb-2 ${isActive ? `text-${rep.color}-400` : 'text-slate-500'}`} />
              <p className={`font-medium text-sm ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>{rep.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{rep.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros de fecha */}
      <div className="card no-print">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Fecha Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Fecha Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="input-field" />
          </div>
          {/* Atajos rápidos */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Hoy', fn: () => { const h = new Date().toISOString().split('T')[0]; setFechaDesde(h); setFechaHasta(h) } },
              { label: 'Este mes', fn: () => { const n = new Date(); setFechaDesde(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`); setFechaHasta(new Date().toISOString().split('T')[0]) } },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors">
                {label}
              </button>
            ))}
          </div>
          <button onClick={generar} className="btn-primary ml-auto" disabled={loading}>
            <FileBarChart className="w-4 h-4" /> {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
        </div>
      </div>

      {/* Resultado del reporte */}
      {datos && (
        <div className="print-only-visible">
          {activo === 'cierre-caja' && <ReporteCierreCaja datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
          {activo === 'libro-ventas' && <ReporteLibroVentas datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
          {activo === 'libro-huespedes' && <ReporteLibroHuespedes datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
          {activo === 'ocupacion' && <ReporteOcupacion datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
        </div>
      )}
    </div>
  )
}

// --- Sub-componentes de reportes ---

function HeaderReporte({ titulo, desde, hasta }) {
  return (
    <div className="mb-6 text-center print:mb-4">
      <h2 className="text-xl font-bold text-white print:text-black">{titulo}</h2>
      <p className="text-slate-400 text-sm print:text-gray-600">Período: {desde} al {hasta}</p>
      <p className="text-slate-600 text-xs print:text-gray-400">Generado: {new Date().toLocaleString('es-HN')}</p>
    </div>
  )
}

function ReporteCierreCaja({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Cierre de Caja" desde={desde} hasta={hasta} />
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Ingresos</p>
          <p className="text-2xl font-bold text-white"><PrecioDual monto={datos.total_ingresos || 0} size="xl" /></p>
        </div>
        <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-wider mb-1">Total ISV</p>
          <p className="text-2xl font-bold text-white">L. {parseFloat(datos.total_isv || 0).toFixed(2)}</p>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <p className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-1">Total IHT</p>
          <p className="text-2xl font-bold text-white">L. {parseFloat(datos.total_iht || 0).toFixed(2)}</p>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Desglose por Método de Pago</h3>
      <table className="w-full">
        <thead><tr>
          {['Método', 'Transacciones', 'Total'].map(h => <th key={h} className="table-header text-left">{h}</th>)}
        </tr></thead>
        <tbody>
          {(datos.por_metodo || []).map((m, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell font-medium text-slate-200">{m.metodo_pago}</td>
              <td className="table-cell text-slate-400">{m.cantidad}</td>
              <td className="table-cell font-semibold text-white"><PrecioDual monto={m.total} size="sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReporteLibroVentas({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Libro de Ventas" desde={desde} hasta={hasta} />
      <div className="grid sm:grid-cols-4 gap-3 mb-6 text-center">
        {[
          { label: 'Ventas Exentas', val: datos.total_exento, color: 'text-slate-300' },
          { label: 'Base ISV 15%', val: datos.total_gravado_isv, color: 'text-blue-400' },
          { label: 'ISV Recaudado', val: datos.total_isv, color: 'text-brand-400' },
          { label: 'IHT Recaudado', val: datos.total_iht, color: 'text-violet-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-slate-700/40 rounded-lg p-3">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>L. {parseFloat(val || 0).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead><tr>
          {['Fecha', 'N° Factura', 'Cliente', 'RTN', 'Exento', 'Grav. ISV', 'ISV', 'IHT', 'Total'].map(h => (
            <th key={h} className="table-header text-left text-xs">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos.facturas || []).map((f, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell text-xs">{f.fecha?.split('T')[0]}</td>
              <td className="table-cell font-mono text-xs text-brand-400">{f.numero_factura}</td>
              <td className="table-cell text-slate-300 text-xs">{f.cliente_nombre}</td>
              <td className="table-cell text-slate-500 text-xs">{f.cliente_rtn || 'C.F.'}</td>
              <td className="table-cell text-xs">{parseFloat(f.subtotal_exento || 0).toFixed(2)}</td>
              <td className="table-cell text-xs">{parseFloat(f.subtotal_gravado_isv || 0).toFixed(2)}</td>
              <td className="table-cell text-xs text-brand-400">{parseFloat(f.isv_15 || 0).toFixed(2)}</td>
              <td className="table-cell text-xs text-violet-400">{parseFloat(f.iht_4 || 0).toFixed(2)}</td>
              <td className="table-cell font-semibold text-white text-xs">{parseFloat(f.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReporteLibroHuespedes({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Libro de Huéspedes Oficial" desde={desde} hasta={hasta} />
      <table className="w-full text-sm">
        <thead><tr>
          {['N°', 'Huésped', 'Documento', 'Nacionalidad', 'Empresa', 'Hab.', 'Check-In', 'Check-Out', 'Motivo'].map(h => (
            <th key={h} className="table-header text-left text-xs">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos || []).map((h, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell text-slate-500 text-xs">{i + 1}</td>
              <td className="table-cell text-slate-200 text-xs">{h.nombres} {h.apellidos}</td>
              <td className="table-cell font-mono text-xs text-slate-400">{h.numero_documento}</td>
              <td className="table-cell text-xs text-slate-400">{h.nacionalidad || '—'}</td>
              <td className="table-cell text-xs text-slate-500">{h.empresa || '—'}</td>
              <td className="table-cell text-xs font-medium text-brand-400">{h.habitacion_numero}</td>
              <td className="table-cell text-xs">{h.fecha_checkin?.split('T')[0]}</td>
              <td className="table-cell text-xs">{h.fecha_checkout?.split('T')[0] || 'En estadía'}</td>
              <td className="table-cell text-xs text-slate-500">{h.motivo_visita || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReporteOcupacion({ datos, desde, hasta }) {
  const pct = datos.porcentaje_ocupacion || 0
  return (
    <div className="card">
      <HeaderReporte titulo="Reporte de Ocupación" desde={desde} hasta={hasta} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: '% Ocupación', val: `${pct.toFixed(1)}%`, color: 'text-brand-400' },
          { label: 'Hab. Disponibles', val: datos.total_habitaciones, color: 'text-slate-300' },
          { label: 'Check-Ins', val: datos.total_checkins, color: 'text-emerald-400' },
          { label: 'Noches Vendidas', val: datos.noches_vendidas, color: 'text-violet-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-slate-700/40 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
          </div>
        ))}
      </div>
      {/* Barra de ocupación */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Ocupación del período</span>
          <span className="font-bold text-brand-400">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
      {datos.por_habitacion && (
        <>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Detalle por Habitación</h3>
          <table className="w-full text-sm">
            <thead><tr>
              {['Habitación', 'Tipo', 'Piso', 'Noches Ocupadas', 'Ingresos'].map(h => <th key={h} className="table-header text-left">{h}</th>)}
            </tr></thead>
            <tbody>
              {datos.por_habitacion.map((h, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium text-brand-400">{h.numero}</td>
                  <td className="table-cell text-slate-400 text-xs">{h.tipo}</td>
                  <td className="table-cell text-slate-500 text-xs">{h.piso}</td>
                  <td className="table-cell text-slate-200">{h.noches}</td>
                  <td className="table-cell font-semibold text-white"><PrecioDual monto={h.ingresos || 0} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
