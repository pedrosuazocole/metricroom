// src/components/common/PrecioDual.jsx
// Muestra un monto en Lempiras con su equivalente en Dólares al lado (informativo).
// El dato real/fiscal SIEMPRE es el de Lempiras — el USD es solo de referencia visual.
import { useTasaCambio } from '../../context/TasaCambioContext'

export default function PrecioDual({ monto, size = 'base', className = '', usdClassName = '' }) {
  const { aDolares, tieneTasa } = useTasaCambio() || {}
  const montoNum = parseFloat(monto) || 0

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className={sizeClasses[size] || sizeClasses.base}>
        L. {montoNum.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
      </span>
      {tieneTasa && aDolares && (
        <span className={`text-slate-500 ${size === 'lg' || size === 'xl' ? 'text-xs' : 'text-[10px]'} ${usdClassName}`}>
          (${aDolares(montoNum).toLocaleString('en-US', { minimumFractionDigits: 2 })})
        </span>
      )}
    </span>
  )
}
