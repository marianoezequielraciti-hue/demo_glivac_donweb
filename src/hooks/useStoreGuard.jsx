import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'

/**
 * Protege cualquier acción ABM con selección de negocio para admins.
 * - Empleados: pasan directo (usan su storeId del auth)
 * - Admin con negocio seleccionado: pasan directo
 * - Admin sin negocio seleccionado: muestra picker antes de ejecutar
 *
 * Uso:
 *   const { guard, PickerModal } = useStoreGuard()
 *   <button onClick={() => guard(openModal)}>Nuevo</button>
 *   {PickerModal}
 */
export function useStoreGuard() {
  const { isAdmin, storeId } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId } = useStoreFilter()

  const [showPicker, setShowPicker] = useState(false)
  const [pickerTmp, setPickerTmp] = useState('')
  const pendingFn = useRef(null)

  // Llama a fn(storeId) directo o muestra el picker primero
  const guard = useCallback((fn) => {
    if (!isAdmin) {
      fn(storeId)
      return
    }
    if (selectedStoreId) {
      fn(selectedStoreId)
      return
    }
    pendingFn.current = fn
    setPickerTmp('')
    setShowPicker(true)
  }, [isAdmin, storeId, selectedStoreId])

  const confirmPick = () => {
    if (!pickerTmp) return
    setSelectedStoreId(pickerTmp)
    setShowPicker(false)
    if (pendingFn.current) {
      pendingFn.current(pickerTmp)
      pendingFn.current = null
    }
  }

  const cancelPick = () => {
    setShowPicker(false)
    pendingFn.current = null
  }

  const PickerModal = showPicker ? (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold">¿A qué negocio pertenece?</h2>
        <p className="text-sm text-gray-500">Seleccioná el negocio antes de continuar.</p>
        <div className="space-y-2">
          {stores.map(s => (
            <button
              key={s.id}
              onClick={() => setPickerTmp(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                pickerTmp === s.id
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={cancelPick}
            className="px-4 py-2 border border-gray-200 rounded-full text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={confirmPick}
            disabled={!pickerTmp}
            className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { guard, PickerModal }
}
