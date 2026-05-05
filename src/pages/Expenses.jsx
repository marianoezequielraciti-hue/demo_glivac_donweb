import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { exportToXlsx, EXPENSE_COLUMNS } from '@/lib/xlsxUtils'
import { formatDateOnlyART, fmtMoney } from '@/components/argentina'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import { useStoreGuard } from '@/hooks/useStoreGuard.jsx'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'

const BASE_CATEGORIES = [
  'Luz','Gas','Agua','Sueldos','Alquiler','Mantenimiento','Telefonía','Internet','Impuestos','Mercadería','Otros'
]

const TYPE_LABEL = { fijo: 'Fijo', variable: 'Variable' }

const initialForm = () => ({
  description: '',
  amount: 0,
  category: '',
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

  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [customCatInput, setCustomCatInput] = useState('')
  const [usingCustomCat, setUsingCustomCat] = useState(false)

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

  const { data: dbCategories = [] } = useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('expense_categories').select('*').order('name')
      return data || []
    },
    enabled: !!user,
  })

  const allCategories = useMemo(() => {
    const dbNames = dbCategories.map(c => c.name)
    const set = new Set([...BASE_CATEGORIES, ...dbNames])
    return [...set].sort()
  }, [dbCategories])

  const storeMap = useMemo(() => new Map(stores.map(s => [s.id, s.name])), [stores])
  const showStoreName = isAdmin && !effectiveStoreId

  const [showModal, setShowModal] = useState(false)
  const [editingExp, setEditing] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [form, setForm] = useState(initialForm())

  const categoriesInUse = useMemo(() => {
    const fromExpenses = expenses.map(e => e.category).filter(Boolean)
    const set = new Set([...allCategories, ...fromExpenses])
    return [...set].sort()
  }, [allCategories, expenses])

  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses])
  const fixedExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'fijo').reduce((sum, e) => sum + (e.amount || 0), 0), [expenses])
  const variableExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'variable').reduce((sum, e) => sum + (e.amount || 0), 0), [expenses])

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
        title: 'Glivac — Gastos',
        subtitle: `Exportado el ${new Date().toLocaleDateString('es-AR')}`,
        totals: { amount: filtered.reduce((sum, e) => sum + (e.amount || 0), 0) }
      }
    )
  }

  const addCategoryMutation = useMutation({
    mutationFn: async (name) => {
      const { data, error } = await supabase.from('expense_categories').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] })
      toast.success(`Categoría "${data.name}" agregada`)
      setNewCatInput('')
    },
    onError: (err) => toast.error(err.message || 'Error al agregar categoría'),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('expense_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expense_categories'] }),
    onError: () => toast.error('Error al eliminar categoría'),
  })

  const addCustomCategory = async () => {
    const name = newCatInput.trim()
    if (!name) return
    if (allCategories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      toast.error('Esa categoría ya existe')
      return
    }
    addCategoryMutation.mutate(name)
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
      setCustomCatInput('')
      setUsingCustomCat(false)
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
      setCustomCatInput('')
      setUsingCustomCat(false)
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

  const handleSubmit = async () => {
    let finalCategory = usingCustomCat ? customCatInput.trim() : form.category
    if (!finalCategory) { toast.error('Seleccioná o escribí una categoría'); return }

    // Si es una categoría nueva escrita a mano, guardarla en la DB
    if (usingCustomCat && !allCategories.map(c => c.toLowerCase()).includes(finalCategory.toLowerCase())) {
      try {
        await addCategoryMutation.mutateAsync(finalCategory)
      } catch {}
    }

    const payload = {
      ...form,
      category: finalCategory,
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
    const cat = expense.category || ''
    const isKnown = allCategories.includes(cat)
    setUsingCustomCat(!isKnown && !!cat)
    setCustomCatInput(!isKnown ? cat : '')
    setForm({
      description: expense.description || '',
      amount: expense.amount || 0,
      category: isKnown ? cat : (allCategories[0] || ''),
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
      setUsingCustomCat(false)
      setCustomCatInput('')
      setForm({ ...initialForm(), store_id: effectiveStoreId || '', category: allCategories[0] || '' })
      setShowModal(true)
    })
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(initialForm())
    setCustomCatInput('')
    setUsingCustomCat(false)
  }

  const customDbCategories = dbCategories.filter(c => !BASE_CATEGORIES.map(b => b.toLowerCase()).includes(c.name.toLowerCase()))

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Gastos</p>
          <h1 className="text-3xl font-bold">Gestión de gastos fijos y variables</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowCatManager(true)}
                className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Categorías
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-semibold"
              >
                Exportar Excel
              </button>
            </>
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
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">Todas las categorías</option>
              {categoriesInUse.map(cat => (
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
                  <tr><td colSpan={showStoreName ? 7 : 6} className="px-4 py-6 text-center text-gray-500">Cargando gastos...</td></tr>
                )}
                {!isLoading && !filtered.length && (
                  <tr><td colSpan={showStoreName ? 7 : 6} className="px-4 py-6 text-center text-gray-500">No hay gastos registrados.</td></tr>
                )}
                {!isLoading && filtered.map(expense => (
                  <tr key={expense.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">{formatDateOnlyART(expense.date)}</td>
                    <td className="px-4 py-3">{expense.description}</td>
                    {showStoreName && (
                      <td className="px-4 py-3 text-xs text-gray-500">{storeMap.get(expense.store_id) || '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                        {expense.category || '—'}
                      </span>
                    </td>
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

      {/* ── Modal nuevo / editar gasto ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editingExp ? 'Editar gasto' : 'Nuevo gasto'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-3">
              {stores.length > 1 && (
                <select
                  value={form.store_id || ''}
                  onChange={e => setForm(prev => ({ ...prev, store_id: e.target.value || '' }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Sin negocio asignado</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

              {/* Selector de categoría */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  {!usingCustomCat ? (
                    <div className="flex gap-1.5">
                      <select
                        value={form.category}
                        onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        {allCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setUsingCustomCat(true); setCustomCatInput('') }}
                        title="Escribir categoría personalizada"
                        className="px-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-zinc-900 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        autoFocus
                        value={customCatInput}
                        onChange={e => setCustomCatInput(e.target.value)}
                        placeholder="Escribí la categoría..."
                        className="flex-1 border border-zinc-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                      />
                      <button
                        type="button"
                        onClick={() => { setUsingCustomCat(false); setCustomCatInput('') }}
                        title="Volver al selector"
                        className="px-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <select
                    value={form.expense_type}
                    onChange={e => setForm(prev => ({ ...prev, expense_type: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <option value="variable">Variable</option>
                    <option value="fijo">Fijo</option>
                  </select>
                </div>
                {usingCustomCat && customCatInput.trim() && !allCategories.map(c => c.toLowerCase()).includes(customCatInput.trim().toLowerCase()) && (
                  <p className="text-xs text-zinc-500">
                    Se guardará <strong>"{customCatInput.trim()}"</strong> como nueva categoría en la base de datos
                  </p>
                )}
              </div>

              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas (opcional)"
                className="border border-gray-200 rounded-lg px-3 py-2 h-24"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-full text-sm font-semibold">
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

      {/* ── Modal gestión de categorías ────────────────────────────────────── */}
      {showCatManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Categorías de gastos</h2>
              <button onClick={() => setShowCatManager(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
                placeholder="Nueva categoría (ej: Auto 1, Nafta, Seguros...)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              />
              <button
                onClick={addCustomCategory}
                disabled={!newCatInput.trim() || addCategoryMutation.isPending}
                className="px-3 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Categorías base</p>
              <div className="flex flex-wrap gap-2">
                {BASE_CATEGORIES.map(cat => (
                  <span key={cat} className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">{cat}</span>
                ))}
              </div>
            </div>

            {customDbCategories.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mis categorías</p>
                <div className="flex flex-wrap gap-2">
                  {customDbCategories.map(cat => (
                    <span key={cat.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-white text-sm">
                      {cat.name}
                      <button
                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                        className="hover:text-red-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {customDbCategories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">
                Todavía no agregaste categorías personalizadas.
              </p>
            )}
          </div>
        </div>
      )}

      {PickerModal}
    </div>
  )
}
