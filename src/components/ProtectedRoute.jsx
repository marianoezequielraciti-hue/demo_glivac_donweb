import { Outlet } from 'react-router-dom'
import LoginForm from './LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { roleRequiresStore } from '@/lib/roles'

export default function ProtectedRoute() {
  const { user, role, storeId, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-300 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginForm />

  // Usuario con rol que requiere tienda pero sin store_id en el token → bloquear
  if (roleRequiresStore(role) && !storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8 max-w-sm">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-semibold text-gray-800">Sin negocio asignado</h2>
          <p className="text-sm text-gray-500">
            Tu cuenta no tiene un negocio vinculado. Contactá al administrador para que te asigne uno.
          </p>
          <button
            onClick={logout}
            className="mt-4 px-6 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold hover:bg-zinc-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
