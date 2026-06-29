// src/components/common/ErrorBoundary.jsx
// Si cualquier componente de la app lanza un error durante el render,
// React por defecto desmonta TODO el árbol dejando una pantalla en blanco.
// Este Error Boundary atrapa esos errores y muestra un mensaje útil en vez
// de dejar al usuario viendo solo el fondo oscuro sin nada.
import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó un error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
          <div className="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Algo salió mal</h2>
            <p className="text-sm text-slate-400 mb-4">
              Ocurrió un error inesperado al mostrar esta pantalla. Probá recargar la página.
            </p>
            <p className="text-xs text-slate-600 font-mono bg-slate-900/50 rounded-lg p-2 mb-4 break-all">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full justify-center"
            >
              <RefreshCw className="w-4 h-4" /> Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
