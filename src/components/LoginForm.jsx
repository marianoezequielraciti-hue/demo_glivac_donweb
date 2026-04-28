import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginForm() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const result = await login(email, password)
    if (!result.ok) {
      setError(result.error || 'Email o contraseña incorrectos')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-tertiary)] flex items-center justify-center">
      <div className="w-full max-w-sm bg-white border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-lg)] p-8 shadow-lg">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-900">Fiambrerías Vale</div>
          <p className="text-sm text-gray-500">Sistema de Gestión</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
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
      </div>
    </div>
  )
}
