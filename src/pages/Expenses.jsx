import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { exportToXlsx, EXPENSE_COLUMNS } from '@/lib/xlsxUtils'
import { formatDateOnlyART, fmtMoney } from '@/components/argentina'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import { useStoreGuard } from '@/hooks/useStoreGuard.jsx'

const EXPENSE_CATEGORIES = [
  'Luz','Gas','Agua','Sueldos','Alquiler','Mantenimiento','Telefonía','Internet','Impuestos','Mercadería','Otros'
]

const TYPE_LABEL = {
  fijo: 'Fijo',
  variable: 'Variable'
}

const initialForm = () => ({
  description: '',
  amount: 0,
  category: 'Otros',
  expense_type: 'variable',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  store_id: '',
})

export default function Expenses() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId, isAdmin } = useStoreFilter()
  const effectiveStoreId = selectedStoreId
  const { guard, PickerModal } = useStoreGuard()

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', effectiveStoreId],
    queryFn: async () => {
      let q = supabase.from('expenses').select('*').order('date', { ascending: false }).limit(500)
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      const { data } = await q
      return data || []
    },
    enabled: !!user && isAdmin,
  })

  const storeMap = useMemo(() => new Map(stores.map(s => [s.id, s.name])), [stores])
  const showStoreName = isAdmin && !effectiveStoreId

  const [showModal, setShowModal] = useState(false)
  const [editingExp, setEditing] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [form, setForm] = useState(initialForm())

  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0), [expenses])
  const fixedExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'fijo').reduce((sum, exp) => sum + (exp.amount || 0), 0), [expenses])
  const variableExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'variable').reduce((sum, exp) => sum + (exp.amount || 0), 0), [expenses])

  const filtered = useMemo(() => expenses.filter(e =>
    (!filterCat || e.category === filterCat) &&
    (!filterType || e.expense_type === filterType)
  ), [expenses, filterCat, filterType])

  const handleExport = () => {
    exportToXlsx(
      filtered,
      EXPENSE_COLUMNS,
      `gastos_${new Date().toISOString().split('T')[0]}`,
      'Gastos',
      {
        title: 'Fiambrerías Vale — Gastos',
        subtitle: `Exportado el ${new Date().toLocaleDateString('es-AR')}`,
        totals: { amount: filtered.reduce((sum, e) => sum + (e.amount || 0), 0) }
      }
    )
  }

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('expenses').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gasto guardado')
      setShowModal(false)
      setEditing(null)
      setForm(initialForm())
    },
    onError: (err) => toast.error(err.message || 'Error al guardar el gasto'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data, error } = await supabase.from('expenses').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gasto actualizado')
      setShowModal(false)
      setEditing(null)
      setForm(initialForm())
    },
    onError: (err) => toast.error(err.message || 'Error al actualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (expense) => {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gasto eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const handleSubmit = () => {
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      store_id: form.store_id || effectiveStoreId || null,
    }
    if (editingExp) {
      updateMutation.mutate({ id: editingExp.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleEdit = (expense) => {
    setEditing(expense)
    setForm({
      description: expense.description || '',
      amount: expense.amount || 0,
      category: expense.category || 'Otros',
      expense_type: expense.expense_type || 'variable',
      date: expense.date || new Date().toISOString().split('T')[0],
      notes: expense.notes || '',
      store_id: expense.store_id || '',
    })
    setShowModal(true)
  }

  const handleDelete = (expense) => {
    if (!window.confirm('Eliminar este gasto?')) return
    deleteMutation.mutate(expense)
  }

  const openNewModal = () => {
    guard(() => {
      setEditing(null)
      setForm({ ...initialForm(), store_id: effectiveStoreId || '' })
      setShowModal(true)
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Gastos</p>
          <h1 className="text-3xl font-bold">Gestión de gastos fijos y variables</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-semibold"
            >
              Exportar Excel
            </button>
          )}
          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold"
          >
            Nuevo gasto
          </button>
        </div>
      </header>

      {isAdmin ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-5 rounded-2xl bg-red-50">
              <p className="text-sm text-red-500">Total Gastos</p>
              <p className="text-2xl font-bold text-red-700">{fmtMoney(totalExpenses)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100">
              <p className="text-sm text-gray-500">Gastos Fijos</p>
              <p className="text-2xl font-bold text-gray-900">{fmtMoney(fixedExpenses)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100">
              <p className="text-sm text-gray-500">Gastos Variables</p>
              <p className="text-2xl font-bold text-gray-900">{fmtMoney(variableExpenses)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {stores.length > 1 && (
              <select
                value={selectedStoreId || ''}
                onChange={e => setSelectedStoreId(e.target.value || null)}
                className="border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="">Todos los negocios</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">Todas las categorías</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">Todos los tipos</option>
              <option value="fijo">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-zinc-400 border-b border-zinc-100">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Descripción</th>
                  {showStoreName && <th className="px-4 py-3">Negocio</th>}
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={showStoreName ? 7 : 6} className="px-4 py-6 text-center text-gray-500">Cargando gastos...</td>
                  </tr>
                )}
                {!isLoading && !filtered.length && (
                  <tr>
                    <td colSpan={showStoreName ? 7 : 6} className="px-4 py-6 text-center text-gray-500">No hay gastos registrados.</td>
                  </tr>
                )}
                {!isLoading && filtered.map(expense => (
                  <tr key={expense.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">{formatDateOnlyART(expense.date)}</td>
                    <td className="px-4 py-3">{expense.description}</td>
                    {showStoreName && (
                      <td className="px-4 py-3 text-xs text-gray-500">{storeMap.get(expense.store_id) || '—'}</td>
                    )}
                    <td className="px-4 py-3">{expense.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${expense.expense_type === 'fijo' ? 'bg-blue-100 text-zinc-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {TYPE_LABEL[expense.expense_type] || 'Variable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(expense.amount)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:text-zinc-900 text-sm">Editar</button>
                      <button onClick={() => handleDelete(expense)} className="text-red-600 hover:text-red-900 text-sm">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
          <p className="text-gray-500 text-sm">El historial de gastos es visible solo para administradores.</p>
          <p className="text-gray-400 text-xs mt-1">Podés registrar nuevos gastos usando el botón de arriba.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editingExp ? 'Editar gasto' : 'Nuevo gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500">Cerrar</button>
            </div>
            <div className="grid gap-3">
              {stores.length > 1 && (
                <select
                  value={form.store_id || ''}
                  onChange={e => setForm(prev => ({ ...prev, store_id: e.target.value || '' }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Sin negocio asignado</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción"
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Monto"
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={form.expense_type}
                  onChange={e => setForm(prev => ({ ...prev, expense_type: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="variable">Variable</option>
                  <option value="fijo">Fijo</option>
                </select>
              </div>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas (opcional)"
                className="border border-gray-200 rounded-lg px-3 py-2 h-24"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditing(null)
                  setForm(initialForm())
                }}
                className="px-4 py-2 border border-gray-200 rounded-full text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {PickerModal}
    </div>
  )
}
