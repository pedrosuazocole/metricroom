// src/context/TasaCambioContext.jsx
// Carga la tasa de cambio vigente UNA vez al iniciar sesión y la comparte
// en toda la app, evitando que cada página la pida por su cuenta.
// La "Tasa de Venta" es la oficial del sistema para convertir USD -> HNL.
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useAuth } from './AuthContext'

const TasaCambioContext = createContext(null)

export function TasaCambioProvider({ children }) {
  const { user } = useAuth()
  const [tasa, setTasa] = useState(null) // { tasa_compra, tasa_venta, fecha, observaciones }
  const [loading, setLoading] = useState(false)

  const recargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/tasa-cambio/actual')
      setTasa(r.data.data || null)
    } catch {
      setTasa(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) recargar()
  }, [user, recargar])

  // Tasa de venta vigente (1 si no hay tasa registrada, para no romper cálculos)
  const tasaVenta = parseFloat(tasa?.tasa_venta) || 1
  const tieneTasa = !!tasa?.tasa_venta

  // Convierte un monto en HNL a su equivalente en USD
  const aDolares = (montoHNL) => (parseFloat(montoHNL) || 0) / tasaVenta
  // Convierte un monto en USD a su equivalente en HNL (usando tasa de venta)
  const aLempiras = (montoUSD) => (parseFloat(montoUSD) || 0) * tasaVenta

  return (
    <TasaCambioContext.Provider value={{ tasa, tasaVenta, tieneTasa, loading, recargar, aDolares, aLempiras }}>
      {children}
    </TasaCambioContext.Provider>
  )
}

export const useTasaCambio = () => useContext(TasaCambioContext)
