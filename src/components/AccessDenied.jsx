import { useNavigate } from 'react-router-dom'

export default function AccessDenied() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-3 bg-white shadow-lg rounded-2xl p-8 border border-gray-200">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-semibold">Sin acceso</h1>
        <p className="text-sm text-gray-500">No tenés permiso para ver esta sección</p>
        <button
          onClick={() => navigate('/pos')}
          className="mt-4 px-4 py-2 border border-blue-700 text-blue-700 rounded-lg"
        >
          Ir al Punto de Venta
        </button>
      </div>
    </div>
  )
}
