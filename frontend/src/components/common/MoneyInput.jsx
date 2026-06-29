// src/components/common/MoneyInput.jsx
// Input numérico con un switch L./$ pegado. El recepcionista puede escribir el
// monto en la moneda que tenga a mano (efectivo entregado, tarifa cotizada, etc.)
// El valor que se reporta hacia afuera (onChange) SIEMPRE viene en Lempiras,
// para que el resto del formulario no tenga que preocuparse por conversiones.
import { useState, useEffect } from 'react'
import { useTasaCambio } from '../../context/TasaCambioContext'

export default function MoneyInput({ valueHNL, onChange, placeholder = '0.00', className = '', required = false, disabled = false }) {
  const { tasaVenta, tieneTasa } = useTasaCambio() || { tasaVenta: 1, tieneTasa: false }
  const [moneda, setMoneda] = useState('HNL')
  const [display, setDisplay] = useState(valueHNL ?? '')

  // Si el valor HNL controlado cambia desde afuera (ej: reset de formulario), sincronizar
  useEffect(() => {
    if (moneda === 'HNL') {
      setDisplay(valueHNL ?? '')
    }
  }, [valueHNL]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (raw) => {
    setDisplay(raw)
    const num = parseFloat(raw)
    if (raw === '' || isNaN(num)) { onChange(''); return }
    const enHNL = moneda === 'USD' ? num * tasaVenta : num
    onChange(enHNL)
  }

  const handleToggleMoneda = (nuevaMoneda) => {
    if (nuevaMoneda === moneda) return
    // Al cambiar de moneda, convertir el valor mostrado para que siga representando lo mismo
    const num = parseFloat(display)
    if (!isNaN(num)) {
      const nuevoDisplay = nuevaMoneda === 'USD' ? num / tasaVenta : num * tasaVenta
      setDisplay(Math.round(nuevoDisplay * 100) / 100)
    }
    setMoneda(nuevaMoneda)
  }

  return (
    <div className={`flex items-stretch ${className}`}>
      <div className="flex rounded-l-lg border border-r-0 border-slate-600 overflow-hidden flex-shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleToggleMoneda('HNL')}
          className={`px-2.5 text-xs font-semibold transition-colors ${moneda === 'HNL' ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
        >
          L.
        </button>
        <button
          type="button"
          disabled={disabled || !tieneTasa}
          title={!tieneTasa ? 'Registrá una tasa de cambio en Configuración para usar USD' : ''}
          onClick={() => handleToggleMoneda('USD')}
          className={`px-2.5 text-xs font-semibold transition-colors ${moneda === 'USD' ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          $
        </button>
      </div>
      <input
        type="number"
        step="0.01"
        min="0"
        required={required}
        disabled={disabled}
        value={display}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className="input-field rounded-l-none flex-1"
      />
    </div>
  )
}
