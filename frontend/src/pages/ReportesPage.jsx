// src/pages/ReportesPage.jsx - Reportes operativos y financieros
import { useState } from 'react'
import { FileBarChart, Printer, Download, Calendar, Users, DollarSign, BarChart2, Landmark, TrendingUp, TrendingDown, BedDouble, LayoutDashboard } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import PrecioDual from '../components/common/PrecioDual'

const REPORTES = [
  { id: 'cierre-caja', icon: DollarSign, label: 'Cierre de Caja', desc: 'Cuadre por turno y método de pago', color: 'emerald' },
  { id: 'libro-ventas', icon: FileBarChart, label: 'Libro de Ventas', desc: 'Ventas mensuales con desglose de impuestos', color: 'brand' },
  { id: 'libro-huespedes', icon: Users, label: 'Libro de Huéspedes', desc: 'Registro oficial de ingresos al hotel', color: 'violet' },
  { id: 'ocupacion', icon: BarChart2, label: 'Reporte de Ocupación', desc: 'Porcentaje de ocupación por período', color: 'orange' },
  { id: 'ingresos-habitacion', icon: BedDouble, label: 'Ingresos por Habitación', desc: 'Ingresos hoteleros por tipo de habitación', color: 'pink' },
  { id: 'bancos', icon: Landmark, label: 'Bancos y Cuentas', desc: 'Saldos, depósitos y retiros por cuenta', color: 'cyan' },
  { id: 'cxc-antiguedad', icon: TrendingUp, label: 'Antigüedad CxC', desc: 'Saldos por cobrar vencidos por rango', color: 'teal' },
  { id: 'cxp-antiguedad', icon: TrendingDown, label: 'Antigüedad CxP', desc: 'Saldos por pagar vencidos por rango', color: 'red' },
  { id: 'resumen-ejecutivo', icon: LayoutDashboard, label: 'Resumen Ejecutivo', desc: 'Panorama general para Administración', color: 'indigo' },
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

  // Tailwind solo genera las clases que puede detectar como texto literal en
  // el código — un template string como `border-${color}-500/40` no funciona
  // para colores que no aparezcan también escritos completos en algún lado.
  // Por eso el mapa de abajo escribe cada clase completa, aunque parezca repetitivo.
  const colorClasses = {
    emerald: { active: 'border-emerald-500/40 bg-emerald-500/5', icon: 'text-emerald-400' },
    brand:   { active: 'border-brand-500/40 bg-brand-500/5', icon: 'text-brand-400' },
    violet:  { active: 'border-violet-500/40 bg-violet-500/5', icon: 'text-violet-400' },
    orange:  { active: 'border-orange-500/40 bg-orange-500/5', icon: 'text-orange-400' },
    pink:    { active: 'border-pink-500/40 bg-pink-500/5', icon: 'text-pink-400' },
    cyan:    { active: 'border-cyan-500/40 bg-cyan-500/5', icon: 'text-cyan-400' },
    teal:    { active: 'border-teal-500/40 bg-teal-500/5', icon: 'text-teal-400' },
    red:     { active: 'border-red-500/40 bg-red-500/5', icon: 'text-red-400' },
    indigo:  { active: 'border-indigo-500/40 bg-indigo-500/5', icon: 'text-indigo-400' },
  }

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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 no-print">
        {REPORTES.map(rep => {
          const Icon = rep.icon
          const isActive = activo === rep.id
          const colores = colorClasses[rep.color]
          return (
            <button key={rep.id} onClick={() => { setActivo(rep.id); setDatos(null) }}
              className={`card text-left transition-all hover:border-slate-500 ${isActive ? colores.active : ''}`}>
              <Icon className={`w-6 h-6 mb-2 ${isActive ? colores.icon : 'text-slate-500'}`} />
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
          {activo === 'ingresos-habitacion' && <ReporteIngresosHabitacion datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
          {activo === 'bancos' && <ReporteBancos datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
          {activo === 'cxc-antiguedad' && <ReporteAntiguedad datos={datos} desde={fechaDesde} hasta={fechaHasta} titulo="Antigüedad de Saldos — Cuentas por Cobrar" columnaEntidad="cliente_nombre" etiquetaEntidad="Cliente" />}
          {activo === 'cxp-antiguedad' && <ReporteAntiguedad datos={datos} desde={fechaDesde} hasta={fechaHasta} titulo="Antigüedad de Saldos — Cuentas por Pagar" columnaEntidad="proveedor_nombre" etiquetaEntidad="Proveedor" />}
          {activo === 'resumen-ejecutivo' && <ReporteResumenEjecutivo datos={datos} desde={fechaDesde} hasta={fechaHasta} />}
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

function ReporteIngresosHabitacion({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Ingresos por Tipo de Habitación" desde={desde} hasta={hasta} />
      <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4 mb-6 inline-block">
        <p className="text-pink-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Ingresos por Hospedaje</p>
        <p className="text-2xl font-bold text-white"><PrecioDual monto={datos.total_ingresos || 0} size="xl" /></p>
      </div>
      <table className="w-full text-sm">
        <thead><tr>
          {['Tipo de Habitación', 'Estadías', 'Ingresos', 'Promedio por Estadía'].map(h => (
            <th key={h} className="table-header text-left">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos.por_tipo || []).map((t, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell font-medium text-slate-200">{t.tipo}</td>
              <td className="table-cell text-slate-400">{t.estadias}</td>
              <td className="table-cell font-semibold text-white"><PrecioDual monto={t.ingresos || 0} size="sm" /></td>
              <td className="table-cell text-slate-400"><PrecioDual monto={t.promedio_por_estadia || 0} size="sm" /></td>
            </tr>
          ))}
          {(datos.por_tipo || []).length === 0 && (
            <tr><td colSpan={4} className="text-center py-8 text-slate-600">Sin ingresos de hospedaje en este período</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReporteBancos({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Bancos y Cuentas" desde={desde} hasta={hasta} />
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Saldo Total HNL', val: `L. ${parseFloat(datos.saldo_total_hnl || 0).toFixed(2)}`, color: 'text-emerald-400' },
          { label: 'Saldo Total USD', val: `$ ${parseFloat(datos.saldo_total_usd || 0).toFixed(2)}`, color: 'text-brand-400' },
          { label: 'Depósitos del Período', val: `L. ${parseFloat(datos.total_depositos || 0).toFixed(2)}`, color: 'text-cyan-400' },
          { label: 'Retiros del Período', val: `L. ${parseFloat(datos.total_retiros || 0).toFixed(2)}`, color: 'text-red-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-slate-700/40 rounded-lg p-3">
            <p className="text-slate-500 text-xs mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Cuentas Bancarias</h3>
      <table className="w-full text-sm mb-6">
        <thead><tr>
          {['Banco', 'N° Cuenta', 'Moneda', 'Depósitos', 'Retiros', 'Saldo Actual'].map(h => (
            <th key={h} className="table-header text-left">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos.cuentas || []).map((c, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell font-medium text-slate-200">{c.banco_nombre}</td>
              <td className="table-cell font-mono text-xs text-slate-400">{c.numero_cuenta}</td>
              <td className="table-cell text-slate-500 text-xs">{c.moneda}</td>
              <td className="table-cell text-cyan-400 text-xs">{parseFloat(c.depositos_periodo || 0).toFixed(2)}</td>
              <td className="table-cell text-red-400 text-xs">{parseFloat(c.retiros_periodo || 0).toFixed(2)}</td>
              <td className="table-cell font-semibold text-white">{parseFloat(c.saldo_actual || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Movimientos del Período</h3>
      <table className="w-full text-sm">
        <thead><tr>
          {['Fecha', 'Cuenta', 'Tipo', 'Descripción', 'Monto', 'Saldo Después'].map(h => (
            <th key={h} className="table-header text-left text-xs">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos.movimientos || []).map((m, i) => (
            <tr key={i} className="table-row">
              <td className="table-cell text-xs">{m.fecha}</td>
              <td className="table-cell text-xs text-slate-400">{m.banco_nombre} — {m.numero_cuenta}</td>
              <td className="table-cell text-xs">
                <span className={['DEPOSITO', 'INTERES'].includes(m.tipo) ? 'text-emerald-400' : 'text-red-400'}>{m.tipo}</span>
              </td>
              <td className="table-cell text-xs text-slate-400">{m.descripcion}</td>
              <td className="table-cell text-xs font-semibold text-white">{parseFloat(m.monto).toFixed(2)}</td>
              <td className="table-cell text-xs text-slate-500">{parseFloat(m.saldo_despues || 0).toFixed(2)}</td>
            </tr>
          ))}
          {(datos.movimientos || []).length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-slate-600">Sin movimientos en este período</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReporteAntiguedad({ datos, desde, hasta, titulo, columnaEntidad, etiquetaEntidad }) {
  const rangos = [
    { key: 'vigente', label: 'Vigente', color: 'text-emerald-400' },
    { key: 'd1_30', label: '1-30 días', color: 'text-yellow-400' },
    { key: 'd31_60', label: '31-60 días', color: 'text-orange-400' },
    { key: 'd61_90', label: '61-90 días', color: 'text-red-400' },
    { key: 'mas_90', label: '+90 días', color: 'text-red-600' },
  ]
  return (
    <div className="card">
      <HeaderReporte titulo={titulo} desde={desde} hasta={hasta} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {rangos.map(r => (
          <div key={r.key} className="bg-slate-700/40 rounded-lg p-3 text-center">
            <p className="text-slate-500 text-xs mb-1">{r.label}</p>
            <p className={`text-base font-bold ${r.color}`}>L. {parseFloat(datos.resumen_por_rango?.[r.key] || 0).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <div className="bg-slate-700/40 rounded-xl p-4 mb-6 inline-block">
        <p className="text-slate-500 text-xs mb-1">Total Pendiente</p>
        <p className="text-2xl font-bold text-white"><PrecioDual monto={datos.total_pendiente || 0} size="xl" /></p>
      </div>
      <table className="w-full text-sm">
        <thead><tr>
          {[etiquetaEntidad, 'Factura/Ref.', 'Vencimiento', 'Días Vencido', 'Saldo', 'Rango'].map(h => (
            <th key={h} className="table-header text-left">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {(datos.detalle || []).map((c, i) => {
            const rangoInfo = rangos.find(r => r.key === c.rango)
            return (
              <tr key={i} className="table-row">
                <td className="table-cell font-medium text-slate-200">{c[columnaEntidad]}</td>
                <td className="table-cell font-mono text-xs text-brand-400">{c.numero_factura || c.numero_factura_proveedor || `#${c.id}`}</td>
                <td className="table-cell text-slate-400 text-sm">{c.fecha_vencimiento?.split('T')[0] || '—'}</td>
                <td className="table-cell text-slate-400 text-sm">{c.dias_vencido > 0 ? `${c.dias_vencido}d` : 'Vigente'}</td>
                <td className="table-cell font-semibold text-white"><PrecioDual monto={c.saldo_pendiente} size="sm" /></td>
                <td className="table-cell"><span className={`text-xs font-medium ${rangoInfo?.color}`}>{rangoInfo?.label}</span></td>
              </tr>
            )
          })}
          {(datos.detalle || []).length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-slate-600">No hay saldos pendientes</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReporteResumenEjecutivo({ datos, desde, hasta }) {
  return (
    <div className="card">
      <HeaderReporte titulo="Resumen Ejecutivo" desde={desde} hasta={hasta} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Ingresos Facturados</p>
          <p className="text-xl font-bold text-white"><PrecioDual monto={datos.ingresos_facturado || 0} size="lg" /></p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">Depósitos Bancarios</p>
          <p className="text-xl font-bold text-white">L. {parseFloat(datos.depositos_periodo || 0).toFixed(2)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">Retiros Bancarios</p>
          <p className="text-xl font-bold text-white">L. {parseFloat(datos.retiros_periodo || 0).toFixed(2)}</p>
        </div>
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-1">Por Cobrar (CxC)</p>
          <p className="text-xl font-bold text-white"><PrecioDual monto={datos.cxc_pendiente || 0} size="lg" /></p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-1">Por Pagar (CxP)</p>
          <p className="text-xl font-bold text-white"><PrecioDual monto={datos.cxp_pendiente || 0} size="lg" /></p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">Ocupación Promedio</p>
          <p className="text-xl font-bold text-white">{parseFloat(datos.ocupacion_promedio || 0).toFixed(1)}%</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-slate-700/40 rounded-lg p-4">
          <p className="text-slate-500 text-xs mb-1">Saldo Bancario Total HNL</p>
          <p className="text-lg font-bold text-emerald-400">L. {parseFloat(datos.saldo_bancario_hnl || 0).toFixed(2)}</p>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-4">
          <p className="text-slate-500 text-xs mb-1">Saldo Bancario Total USD</p>
          <p className="text-lg font-bold text-brand-400">$ {parseFloat(datos.saldo_bancario_usd || 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
