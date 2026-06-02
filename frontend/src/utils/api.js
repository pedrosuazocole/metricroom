// src/utils/api.js - Cliente HTTP centralizado
import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de respuestas para manejo global de errores
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Error de conexión'
    // No mostrar toast para 401 (se maneja en AuthContext)
    if (err.response?.status !== 401) {
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

export default api
