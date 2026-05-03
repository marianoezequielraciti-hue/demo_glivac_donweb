import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Algo salió mal</h2>
          <p className="text-sm text-gray-500">
            Ocurrió un error inesperado en esta sección. Podés volver al inicio o recargar la página.
          </p>
          {this.state.error && (
            <p className="text-xs text-red-400 font-mono bg-red-50 rounded-lg p-3 text-left break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-full border border-zinc-300 text-sm font-medium hover:bg-zinc-50"
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-medium"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
