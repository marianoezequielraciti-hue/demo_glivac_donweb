import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatDateOnlyART, formatDateTimeART, fmtMoney } from '@/components/argentina'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'

const EMPTY_CLIENT = {
  full_name: '',
  phone: '',
  email: '',
  document_id: '',
  address: '',
  notes: '',
  active: true,
}

const EMPTY_ENTRY = {
  movement_type: 'debit',
  amount: '',
  description: '',
}

const EMPTY_BUDGET = {
  valid_until: '',
  notes: '',
  status: 'draft',
  items: [],
}

const BUDGET_STATUSES = [
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'expired', label: 'Vencido' },
]

const MOVEMENT_TYPES = [
  { value: 'debit', label: 'Cargo' },
  { value: 'credit', label: 'Pago' },
]

function createBudgetNumber() {
  return `P-${Date.now().toString().slice(-8)}`
}

function computeBudgetSubtotal(items) {
  return items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)), 0)
}

export default function Clients() {
  const queryClient = useQueryClient()
  const { user, isAdmin, storeId } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId } = useStoreFilter()
  const activeStoreId = selectedStoreId || storeId || (stores.length === 1 ? stores[0].id : null)
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [editingClient, setEditingClient] = useState(null)
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT)
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY)
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET)
  const [productToAdd, setProductToAdd] = useState('')

  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients', activeStoreId],
    queryFn: async () => {
      let query = supabase.from('clients').select('*').order('full_name')
      if (activeStoreId) query = query.eq('store_id', activeStoreId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['client-products', activeStoreId],
    queryFn: async () => {
      let query = supabase.from('products').select('id, name, sale_price, barcode').eq('active', true).order('name')
      if (activeStoreId) query = query.eq('store_id', activeStoreId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', selectedClientId, activeStoreId],
    queryFn: async () => {
      let query = supabase.from('budgets').select('*').order('created_at', { ascending: false })
      if (selectedClientId) query = query.eq('client_id', selectedClientId)
      if (activeStoreId) query = query.eq('store_id', activeStoreId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!user && !!selectedClientId,
  })

  const { data: accountEntries = [] } = useQuery({
    queryKey: ['client-account', selectedClientId, activeStoreId],
    queryFn: async () => {
      let query = supabase
        .from('client_account_entries')
        .select('*, budgets(budget_number)')
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: false })
      if (activeStoreId) query = query.eq('store_id', activeStoreId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!user && !!selectedClientId,
  })

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId(null)
      return
    }
    if (!selectedClientId || !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0].id)
    }
  }, [clients, selectedClientId])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) =>
      client.full_name.toLowerCase().includes(query) ||
      String(client.phone || '').toLowerCase().includes(query) ||
      String(client.document_id || '').toLowerCase().includes(query)
    )
  }, [clients, search])

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null
  const accountBalance = useMemo(() => accountEntries.reduce((sum, entry) => (
    sum + (entry.movement_type === 'debit' ? Number(entry.amount || 0) : -Number(entry.amount || 0))
  ), 0), [accountEntries])
  const pendingBudgets = budgets.filter((budget) => ['draft', 'sent', 'approved'].includes(budget.status) && !budget.posted_to_account)
  const budgetSubtotal = computeBudgetSubtotal(budgetForm.items)

  const resetClientForm = () => {
    setEditingClient(null)
    setClientForm(EMPTY_CLIENT)
  }

  const clientMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      if (id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', id)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('clients').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(editingClient ? 'Cliente actualizado' : 'Cliente creado')
      resetClientForm()
    },
    onError: (error) => toast.error(error.message || 'No se pudo guardar el cliente'),
  })

  const accountEntryMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('client_account_entries').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-account'] })
      toast.success('Movimiento registrado')
      setEntryForm(EMPTY_ENTRY)
    },
    onError: (error) => toast.error(error.message || 'No se pudo registrar el movimiento'),
  })

  const budgetMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('budgets').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Presupuesto guardado')
      setBudgetForm(EMPTY_BUDGET)
      setProductToAdd('')
    },
    onError: (error) => toast.error(error.message || 'No se pudo guardar el presupuesto'),
  })

  const budgetStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('budgets').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Estado actualizado')
    },
    onError: (error) => toast.error(error.message || 'No se pudo actualizar el presupuesto'),
  })

  const postBudgetMutation = useMutation({
    mutationFn: async (budget) => {
      const { error: entryError } = await supabase.from('client_account_entries').insert({
        client_id: budget.client_id,
        budget_id: budget.id,
        store_id: budget.store_id,
        movement_type: 'debit',
        amount: budget.subtotal,
        description: `Presupuesto ${budget.budget_number}`,
      })
      if (entryError) throw entryError

      const { error: budgetError } = await supabase.from('budgets').update({
        posted_to_account: true,
        status: budget.status === 'draft' ? 'approved' : budget.status,
      }).eq('id', budget.id)
      if (budgetError) throw budgetError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['client-account'] })
      toast.success('Presupuesto enviado a cuenta corriente')
    },
    onError: (error) => toast.error(error.message || 'No se pudo pasar el presupuesto a cuenta corriente'),
  })

  const handleSubmitClient = () => {
    if (!clientForm.full_name.trim()) {
      toast.error('Ingresá el nombre del cliente')
      return
    }
    if (!activeStoreId) {
      toast.error('Seleccioná un negocio para crear clientes')
      return
    }
    clientMutation.mutate({
      id: editingClient?.id,
      payload: {
        ...clientForm,
        full_name: clientForm.full_name.trim(),
        store_id: activeStoreId,
      },
    })
  }

  const startEditClient = (client) => {
    setEditingClient(client)
    setClientForm({
      full_name: client.full_name || '',
      phone: client.phone || '',
      email: client.email || '',
      document_id: client.document_id || '',
      address: client.address || '',
      notes: client.notes || '',
      active: client.active ?? true,
    })
  }

  const handleAddBudgetItem = () => {
    const product = products.find((item) => item.id === productToAdd)
    if (!product) return
    setBudgetForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: Number(product.sale_price || 0),
          subtotal: Number(product.sale_price || 0),
        },
      ],
    }))
    setProductToAdd('')
  }

  const handleBudgetItemChange = (index, field, value) => {
    setBudgetForm((prev) => {
      const nextItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: field === 'product_name' ? value : Number(value || 0) }
        nextItem.subtotal = Number(nextItem.quantity || 0) * Number(nextItem.unit_price || 0)
        return nextItem
      })
      return { ...prev, items: nextItems }
    })
  }

  const handleRemoveBudgetItem = (index) => {
    setBudgetForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const handleCreateBudget = () => {
    if (!selectedClient) {
      toast.error('Seleccioná un cliente')
      return
    }
    if (!activeStoreId) {
      toast.error('Seleccioná un negocio antes de registrar presupuestos')
      return
    }
    if (!budgetForm.items.length) {
      toast.error('Agregá al menos un producto al presupuesto')
      return
    }
    budgetMutation.mutate({
      client_id: selectedClient.id,
      store_id: activeStoreId,
      budget_number: createBudgetNumber(),
      status: budgetForm.status,
      items: budgetForm.items,
      subtotal: budgetSubtotal,
      notes: budgetForm.notes?.trim() || null,
      valid_until: budgetForm.valid_until || null,
    })
  }

  const handleCreateEntry = () => {
    if (!selectedClient) {
      toast.error('Seleccioná un cliente')
      return
    }
    if (!activeStoreId) {
      toast.error('Seleccioná un negocio antes de registrar movimientos')
      return
    }
    const amount = Number(entryForm.amount || 0)
    if (amount <= 0) {
      toast.error('Ingresá un importe válido')
      return
    }
    if (!entryForm.description.trim()) {
      toast.error('Ingresá una descripción')
      return
    }
    accountEntryMutation.mutate({
      client_id: selectedClient.id,
      store_id: activeStoreId,
      movement_type: entryForm.movement_type,
      amount,
      description: entryForm.description.trim(),
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Clientes</p>
          <h1 className="text-3xl font-bold">Gestión de clientes, cuenta corriente y presupuestos</h1>
        </div>
        {isAdmin && stores.length > 1 && (
          <select
            value={selectedStoreId || ''}
            onChange={(event) => setSelectedStoreId(event.target.value || null)}
            className="border border-gray-200 rounded-full px-4 py-2 text-sm"
          >
            <option value="">Todos los negocios</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente..."
              className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm"
            />
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {isLoadingClients && <p className="text-sm text-gray-400">Cargando clientes...</p>}
              {!isLoadingClients && filteredClients.length === 0 && (
                <p className="text-sm text-gray-400">No hay clientes cargados.</p>
              )}
              {filteredClients.map((client) => {
                const isSelected = client.id === selectedClientId
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${
                      isSelected ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold">{client.full_name}</p>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-zinc-300' : 'text-gray-500'}`}>
                      {client.phone || client.email || 'Sin contacto'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingClient ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              {editingClient && (
                <button type="button" onClick={resetClientForm} className="text-xs text-gray-500 hover:text-gray-900">
                  Cancelar
                </button>
              )}
            </div>
            <input value={clientForm.full_name} onChange={(event) => setClientForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Nombre y apellido" className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
            <input value={clientForm.phone} onChange={(event) => setClientForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Teléfono" className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
            <input value={clientForm.email} onChange={(event) => setClientForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
            <input value={clientForm.document_id} onChange={(event) => setClientForm((prev) => ({ ...prev, document_id: event.target.value }))} placeholder="DNI / CUIT" className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
            <input value={clientForm.address} onChange={(event) => setClientForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Dirección" className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
            <textarea value={clientForm.notes} onChange={(event) => setClientForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notas internas" className="w-full min-h-24 px-3 py-3 border border-gray-200 rounded-xl text-sm" />
            <button type="button" onClick={handleSubmitClient} disabled={clientMutation.isPending} className="w-full h-11 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">
              {editingClient ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </aside>

        <section className="space-y-6">
          {selectedClient ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedClient.full_name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedClient.phone || 'Sin teléfono'} · {selectedClient.email || 'Sin email'}</p>
                    <p className="text-sm text-gray-500 mt-1">{selectedClient.document_id || 'Sin documento'} · {selectedClient.address || 'Sin dirección'}</p>
                    {selectedClient.notes && <p className="text-sm text-gray-600 mt-3">{selectedClient.notes}</p>}
                  </div>
                  <button type="button" onClick={() => startEditClient(selectedClient)} className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold">
                    Editar cliente
                  </button>
                </div>
                <div className="grid gap-3 mt-5 md:grid-cols-3">
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-sm text-amber-600">Saldo cuenta corriente</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{fmtMoney(accountBalance)}</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-sm text-sky-600">Presupuestos activos</p>
                    <p className="text-2xl font-bold text-sky-700 mt-1">{pendingBudgets.length}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-500">Último movimiento</p>
                    <p className="text-base font-semibold text-zinc-900 mt-1">{accountEntries[0] ? formatDateTimeART(accountEntries[0].created_at) : 'Sin movimientos'}</p>
                  </div>
                </div>
              </div>

              {/* Cuenta corriente */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Cuenta corriente</h2>
                  <span className="text-sm text-gray-500">{accountEntries.length} movimientos</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={entryForm.movement_type} onChange={(e) => setEntryForm((prev) => ({ ...prev, movement_type: e.target.value }))} className="h-10 px-3 border border-gray-200 rounded-xl text-sm">
                    {MOVEMENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={entryForm.amount} onChange={(e) => setEntryForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Importe" type="number" min="0" className="h-10 w-36 px-3 border border-gray-200 rounded-xl text-sm" />
                  <input value={entryForm.description} onChange={(e) => setEntryForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descripción" className="h-10 flex-1 min-w-[160px] px-3 border border-gray-200 rounded-xl text-sm" />
                  <button type="button" onClick={handleCreateEntry} disabled={accountEntryMutation.isPending} className="h-10 px-5 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">
                    Registrar
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {accountEntries.length === 0 && <p className="text-sm text-gray-400">Todavía no hay movimientos para este cliente.</p>}
                  {accountEntries.map((entry) => (
                    <div key={entry.id} className="border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{entry.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTimeART(entry.created_at)}{entry.budgets?.budget_number ? ` · ${entry.budgets.budget_number}` : ''}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${entry.movement_type === 'debit' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {entry.movement_type === 'debit' ? '+' : '-'} {fmtMoney(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nuevo presupuesto */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Nuevo presupuesto</h2>
                  <span className="text-sm font-semibold text-gray-700">{fmtMoney(budgetSubtotal)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={productToAdd} onChange={(e) => setProductToAdd(e.target.value)} className="h-10 flex-1 min-w-[180px] px-3 border border-gray-200 rounded-xl text-sm">
                    <option value="">Agregar producto...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</option>)}
                  </select>
                  <input value={budgetForm.valid_until} onChange={(e) => setBudgetForm((prev) => ({ ...prev, valid_until: e.target.value }))} type="date" className="h-10 px-3 border border-gray-200 rounded-xl text-sm" />
                  <select value={budgetForm.status} onChange={(e) => setBudgetForm((prev) => ({ ...prev, status: e.target.value }))} className="h-10 px-3 border border-gray-200 rounded-xl text-sm">
                    {BUDGET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button type="button" onClick={handleAddBudgetItem} disabled={!productToAdd} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">
                    Agregar
                  </button>
                </div>
                <textarea value={budgetForm.notes} onChange={(e) => setBudgetForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notas del presupuesto" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" />
                <div className="space-y-2">
                  {budgetForm.items.length === 0 && <p className="text-sm text-gray-400">Todavía no agregaste productos al presupuesto.</p>}
                  {budgetForm.items.map((item, index) => (
                    <div key={`${item.product_id}-${index}`} className="flex flex-wrap gap-2 items-center">
                      <input value={item.product_name} onChange={(e) => handleBudgetItemChange(index, 'product_name', e.target.value)} className="h-9 flex-1 min-w-[120px] px-3 border border-gray-200 rounded-lg text-sm" />
                      <input value={item.quantity} onChange={(e) => handleBudgetItemChange(index, 'quantity', e.target.value)} type="number" min="1" placeholder="Cant." className="h-9 w-20 px-3 border border-gray-200 rounded-lg text-sm" />
                      <input value={item.unit_price} onChange={(e) => handleBudgetItemChange(index, 'unit_price', e.target.value)} type="number" min="0" placeholder="Precio" className="h-9 w-28 px-3 border border-gray-200 rounded-lg text-sm" />
                      <span className="h-9 px-3 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center text-sm font-semibold text-zinc-900 shrink-0">{fmtMoney(item.subtotal)}</span>
                      <button type="button" onClick={() => handleRemoveBudgetItem(index)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">✕</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleCreateBudget} disabled={budgetMutation.isPending || !budgetForm.items.length} className="w-full h-11 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">
                  Guardar presupuesto
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Presupuestos registrados</h2>
                  <span className="text-sm text-gray-500">{budgets.length} presupuestos</span>
                </div>
                <div className="space-y-3">
                  {budgets.length === 0 && <p className="text-sm text-gray-400">Este cliente todavía no tiene presupuestos.</p>}
                  {budgets.map((budget) => (
                    <div key={budget.id} className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{budget.budget_number}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatDateTimeART(budget.created_at)}{budget.valid_until ? ` · vence ${formatDateOnlyART(budget.valid_until)}` : ''}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold">
                            {BUDGET_STATUSES.find((status) => status.value === budget.status)?.label || budget.status}
                          </span>
                          <select value={budget.status} onChange={(event) => budgetStatusMutation.mutate({ id: budget.id, status: event.target.value })} className="h-10 px-3 border border-gray-200 rounded-xl text-sm">
                            {BUDGET_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                          </select>
                          <button type="button" disabled={budget.posted_to_account || postBudgetMutation.isPending} onClick={() => postBudgetMutation.mutate(budget)} className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                            {budget.posted_to_account ? 'En cuenta corriente' : 'Pasar a cuenta corriente'}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(budget.items || []).map((item, index) => (
                          <div key={`${budget.id}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{item.product_name} <span className="text-gray-400">×{item.quantity}</span></span>
                            <span className="font-semibold text-gray-900">{fmtMoney(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                      {budget.notes && <p className="text-sm text-gray-500">{budget.notes}</p>}
                      <div className="flex justify-end">
                        <span className="text-base font-bold text-zinc-900">{fmtMoney(budget.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              Seleccioná o creá un cliente para empezar a trabajar con su cuenta corriente y presupuestos.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
