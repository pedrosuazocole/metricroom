// src/components/common/DateRangePicker.jsx
// Selector de fechas con calendario visual. Marca en rojo las fechas ya ocupadas
// de la habitación seleccionada (vienen del endpoint /reservas/disponibilidad/:id)
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Do','Lu','Ma','Mi','Ju','Vi','Sa']

function toISO(d) {
  return d.toISOString().split('T')[0]
}

function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Genera el set de fechas (formato YYYY-MM-DD) ocupadas dado un arreglo de rangos {fecha_entrada, fecha_salida}
function buildOcupadasSet(rangos) {
  const set = new Set()
  rangos.forEach(({ fecha_entrada, fecha_salida }) => {
    let cur = parseISO(fecha_entrada.split(' ')[0].split('T')[0])
    const fin = parseISO(fecha_salida.split(' ')[0].split('T')[0])
    while (cur < fin) {
      set.add(toISO(cur))
      cur.setDate(cur.getDate() + 1)
    }
  })
  return set
}

export default function DateRangePicker({ fechaEntrada, fechaSalida, onChange, ocupadas = [], disabled = false }) {
  const [open, setOpen]   = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const base = parseISO(fechaEntrada) || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const ref = useRef(null)

  const ocupadasSet = buildOcupadasSet(ocupadas)
  const hoy = new Date(); hoy.setHours(0,0,0,0)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const entradaDate = parseISO(fechaEntrada)
  const salidaDate  = parseISO(fechaSalida)

  const diasDelMes = () => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const dias = []
    // Relleno inicial
    for (let i = 0; i < primerDia.getDay(); i++) dias.push(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d))
    return dias
  }

  const handleDayClick = (day) => {
    if (!day) return
    const iso = toISO(day)
    if (day < hoy) return // no permitir fechas pasadas
    if (ocupadasSet.has(iso)) return // no permitir fecha ocupada

    // Lógica de selección de rango: si no hay entrada o ya hay rango completo, reinicia con esta fecha como entrada
    if (!entradaDate || (entradaDate && salidaDate)) {
      onChange({ fecha_entrada: iso, fecha_salida: '' })
    } else if (day <= entradaDate) {
      // Click antes o igual a la entrada -> reinicia
      onChange({ fecha_entrada: iso, fecha_salida: '' })
    } else {
      // Verificar que no haya fechas ocupadas en el rango intermedio
      let cur = new Date(entradaDate)
      let bloqueado = false
      while (cur < day) {
        if (ocupadasSet.has(toISO(cur))) { bloqueado = true; break }
        cur.setDate(cur.getDate() + 1)
      }
      if (bloqueado) {
        // Reinicia con esta fecha como nueva entrada
        onChange({ fecha_entrada: iso, fecha_salida: '' })
      } else {
        onChange({ fecha_entrada: fechaEntrada, fecha_salida: iso })
        setOpen(false)
      }
    }
  }

  const isInRange = (day) => {
    if (!day || !entradaDate || !salidaDate) return false
    return day > entradaDate && day < salidaDate
  }

  const noches = entradaDate && salidaDate
    ? Math.round((salidaDate - entradaDate) / 86400000)
    : 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="input-field flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={fechaEntrada ? 'text-slate-200' : 'text-slate-500'}>
          {fechaEntrada ? fechaEntrada : 'Entrada'} → {fechaSalida ? fechaSalida : 'Salida'}
          {noches > 0 && <span className="text-brand-400 ml-2">({noches} {noches === 1 ? 'noche' : 'noches'})</span>}
        </span>
        <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-72">
          {/* Header navegación mes */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-200">
              {MESES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>
            <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS.map(d => (
              <div key={d} className="text-center text-[10px] text-slate-500 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {diasDelMes().map((day, i) => {
              if (!day) return <div key={i} />
              const iso = toISO(day)
              const esOcupado = ocupadasSet.has(iso)
              const esPasado = day < hoy
              const esEntrada = entradaDate && toISO(day) === toISO(entradaDate)
              const esSalida = salidaDate && toISO(day) === toISO(salidaDate)
              const enRango = isInRange(day)

              return (
                <button
                  key={i}
                  type="button"
                  disabled={esOcupado || esPasado}
                  onClick={() => handleDayClick(day)}
                  className={[
                    'text-xs h-8 rounded-lg transition-colors flex items-center justify-center font-medium',
                    esPasado ? 'text-slate-700 cursor-not-allowed' :
                    esOcupado ? 'bg-red-500/20 text-red-400/50 cursor-not-allowed line-through' :
                    esEntrada || esSalida ? 'bg-brand-600 text-white' :
                    enRango ? 'bg-brand-600/20 text-brand-300' :
                    'text-slate-300 hover:bg-slate-700',
                  ].join(' ')}
                  title={esOcupado ? 'Fecha ocupada' : ''}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/30" /> Ocupado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-600" /> Seleccionado</span>
          </div>

          {(fechaEntrada || fechaSalida) && (
            <button
              type="button"
              onClick={() => { onChange({ fecha_entrada: '', fecha_salida: '' }) }}
              className="text-xs text-slate-500 hover:text-slate-300 mt-2 w-full text-center"
            >
              Limpiar selección
            </button>
          )}
        </div>
      )}
    </div>
  )
}
