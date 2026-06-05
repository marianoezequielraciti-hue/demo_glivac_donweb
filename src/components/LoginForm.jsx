import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginForm() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone, setForgotDone] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const result = await login(email, password)
    if (!result.ok) {
      setError(result.error || 'Email o contraseña incorrectos')
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotError('')
    if (!forgotUsername.trim()) {
      setForgotError('Ingresá tu usuario')
      return
    }
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Ingresá un email de recuperación válido')
      return
    }
    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername.trim(), recovery_email: forgotEmail.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setForgotError(json.error || 'Error al enviar el email')
        return
      }
      setForgotDone(true)
    } catch {
      setForgotError('Error de conexión. Intentá de nuevo.')
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgot = () => {
    setShowForgot(false)
    setForgotUsername('')
    setForgotEmail('')
    setForgotDone(false)
    setForgotError('')
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--color-background-tertiary)] flex items-center justify-center">
        <div className="w-full max-w-sm bg-white border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-lg)] p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-gray-900">Glivac</div>
            <p className="text-sm text-gray-500">Sistema de Gestión</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700">
              Usuario o email
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cajero1 o correo@ejemplo.com"
                className="mt-1 w-full h-11 px-3 border border-[var(--color-border-tertiary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="mt-1 w-full h-11 px-3 border border-[var(--color-border-tertiary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-xs text-blue-600"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-900 text-white font-semibold rounded-lg disabled:opacity-60 transition-colors"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      </div>

      {/* Modal recuperar contraseña */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            {!forgotDone ? (
              <>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Recuperar contraseña</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Ingresá tu usuario y el email de recuperación vinculado a tu cuenta.
                  </p>
                </div>
                <form onSubmit={handleForgot} className="space-y-3">
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={e => setForgotUsername(e.target.value)}
                    placeholder="Tu usuario (ej: cajero1)"
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    autoFocus
                  />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="Email de recuperación"
                    className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {forgotError && <p className="text-sm text-red-600">{forgotError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeForgot}
                      className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 h-10 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
                    >
                      {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center space-y-3 py-2">
                <div className="text-4xl">📬</div>
                <h3 className="text-lg font-bold text-gray-900">Revisá tu correo</h3>
                <p className="text-sm text-gray-500">
                  Enviamos un enlace de recuperación a <strong>{forgotEmail}</strong>. Revisá también la carpeta de spam.
                </p>
                <button
                  onClick={closeForgot}
                  className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
