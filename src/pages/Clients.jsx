import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatDateOnlyART, formatDateTimeART, fmtMoney } from '@/components/argentina'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import { Loader2, Plus, X, Search, Printer, Share2, TrendingUp, FileText, CreditCard, Clock } from 'lucide-react'

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
  { value: 'draft',    label: 'Borrador',  color: 'bg-gray-100 text-gray-600' },
  { value: 'sent',     label: 'Enviado',   color: 'bg-blue-100 text-blue-700' },
  { value: 'approved', label: 'Aprobado',  color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  { value: 'expired',  label: 'Vencido',   color: 'bg-amber-100 text-amber-700' },
]

const MOVEMENT_TYPES = [
  { value: 'debit',  label: 'Cargo' },
  { value: 'credit', label: 'Pago' },
]

function createBudgetNumber() {
  return `P-${Date.now().toString().slice(-8)}`
}

function computeBudgetSubtotal(items) {
  return items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)), 0)
}

function budgetStatusInfo(status) {
  return BUDGET_STATUSES.find(s => s.value === status) || { label: status, color: 'bg-gray-100 text-gray-600' }
}

// ── Impresión / PDF ───────────────────────────────────────────────────────────
function generateBudgetHTML(budget, client) {
  const fecha = new Date(budget.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const vence = budget.valid_until
    ? new Date(budget.valid_until + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const rows = (budget.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.product_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">$${Number(item.unit_price).toLocaleString('es-AR')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">$${Number(item.subtotal || (item.quantity * item.unit_price)).toLocaleString('es-AR')}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Presupuesto ${budget.budget_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
    .brand-sub { font-size: 11px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .meta { text-align: right; }
    .meta h2 { font-size: 20px; font-weight: 700; color: #111; }
    .meta p { font-size: 12px; color: #666; margin-top: 4px; }
    .divider { border: none; border-top: 2px solid #111; margin: 0 0 28px; }
    .client-box { background: #f7f7f7; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; }
    .client-box p { font-size: 13px; color: #444; margin-top: 4px; }
    .client-box strong { font-size: 16px; font-weight: 700; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #111; color: #fff; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; letter-spacing: 0.5px; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    tbody tr:last-child td { border-bottom: none; }
    td { font-size: 13px; color: #333; }
    .totals { display: flex; justify-content: flex-end; }
    .totals table { width: auto; min-width: 280px; }
    .totals td { padding: 6px 12px; font-size: 14px; border-bottom: none !important; }
    .totals .total-row td { font-size: 18px; font-weight: 800; border-top: 2px solid #111; padding-top: 10px; }
    .notes { margin-top: 24px; padding: 14px 18px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 13px; color: #555; }
    .notes strong { display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; }
    .footer { margin-top: 52px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer .firma { border-top: 1px solid #aaa; padding-top: 8px; min-width: 180px; text-align: center; font-size: 11px; color: #888; }
    .footer .brand-footer { text-align: right; font-size: 11px; color: #bbb; }
    .footer .brand-footer strong { display: block; font-size: 14px; font-weight: 800; color: #999; letter-spacing: 1px; }
    @media print { body { padding: 28px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">GLIVAC</div>
      <div class="brand-sub">Presupuesto comercial</div>
    </div>
    <div class="meta">
      <h2>${budget.budget_number}</h2>
      <p>Fecha: ${fecha}</p>
      ${vence ? `<p>Válido hasta: ${vence}</p>` : ''}
      <p style="margin-top:6px;display:inline-block;background:#111;color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;">${budgetStatusInfo(budget.status).label.toUpperCase()}</p>
    </div>
  </div>
  <hr class="divider" />
  <div class="client-box">
    <strong>${client?.full_name || 'Cliente'}</strong>
    ${client?.phone ? `<p>Tel: ${client.phone}</p>` : ''}
    ${client?.email ? `<p>Email: ${client.email}</p>` : ''}
    ${client?.document_id ? `<p>DNI/CUIT: ${client.document_id}</p>` : ''}
    ${client?.address ? `<p>Dirección: ${client.address}</p>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Cant.</th>
        <th>Precio unit.</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <table>
      <tr>
        <td style="color:#666;">Subtotal</td>
        <td style="text-align:right;">$${Number(budget.subtotal).toLocaleString('es-AR')}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right;">$${Number(budget.subtotal).toLocaleString('es-AR')}</td>
      </tr>
    </table>
  </div>
  ${budget.notes ? `<div class="notes"><strong>Notas</strong>${budget.notes}</div>` : ''}
  <div class="footer">
    <div class="firma">Firma y aclaración</div>
    <div class="brand-footer">
      <strong>GLIVAC</strong>
      glivac.com
    </div>
  </div>
</body>
</html>`
}

function printBudget(budget, client) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) { toast.error('Habilitá los pop-ups para imprimir'); return }
  win.document.write(generateBudgetHTML(budget, client))
  win.document.close()
  win.onload = () => win.print()
}

async function shareBudgetWhatsApp(budget, client) {
  const canShare = typeof navigator.share === 'function' && navigator.canShare
  if (!canShare) {
    // fallback: open print window so they can save as PDF and share manually
    toast.info('Imprimí el presupuesto y guardalo como PDF para compartir')
    printBudget(budget, client)
    return
  }
  // Open print window — user saves PDF — then they share it
  // Since we can't intercept the file, show a message
  toast.info('Guardá el presupuesto como PDF y luego compartilo desde la galería')
  printBudget(budget, client)
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = 'bg-gray-50' }) {
  return (
    <div className={`${color} rounded-2xl p-4 flex items-start gap-3`}>
      <div className="mt-0.5 p-2 rounded-xl bg-white/60">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Clients() {
  const queryClient = useQueryClient()
  const { user, isAdmin, storeId } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId } = useStoreFilter()
  const activeStoreId = selectedStoreId || storeId || (stores.length === 1 ? stores[0].id : null)

  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [selectedClientId, setSelectedClientId] = useState(() => searchParams.get('client_id') || null)

  // Auto-select client when navigated from Fiados with ?client_id=
  useEffect(() => {
    const id = searchParams.get('client_id')
    if (id) setSelectedClientId(id)
  }, [searchParams])

  // Modals
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT)

  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET)
  const [productToAdd, setProductToAdd] = useState('')

  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY)
  const [showEntryForm, setShowEntryForm] = useState(false)

  const [fiadoPayModal, setFiadoPayModal] = useState(null) // fiado object
  const [fiadoPayMethod, setFiadoPayMethod] = useState('efectivo')

  // Queries
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

  const { data: clientFiados = [] } = useQuery({
    queryKey: ['client-fiados', selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiados')
        .select('*')
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(f => ({
        ...f,
        customer_name: f.customer_name || f.client || '—',
        status: f.status ?? (f.paid ? 'pagado' : 'pendiente'),
      }))
    },
    enabled: !!user && !!selectedClientId,
  })

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      String(c.phone || '').includes(q) ||
      String(c.document_id || '').includes(q)
    )
  }, [clients, search])

  const selectedClient = clients.find(c => c.id === selectedClientId) || null

  const accountBalance = useMemo(() =>
    accountEntries.reduce((sum, e) =>
      sum + (e.movement_type === 'debit' ? Number(e.amount || 0) : -Number(e.amount || 0)), 0),
    [accountEntries]
  )

  const pendingBudgets = budgets.filter(b => ['draft', 'sent', 'approved'].includes(b.status) && !b.posted_to_account)
  const totalBudgetado = budgets.reduce((s, b) => s + Number(b.subtotal || 0), 0)
  const budgetSubtotal = computeBudgetSubtotal(budgetForm.items)

  // ── Client mutations ───────────────────────────────────────────────────────
  const clientMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      if (id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(editingClient ? 'Cliente actualizado' : 'Cliente creado')
      setShowClientModal(false)
      setEditingClient(null)
      setClientForm(EMPTY_CLIENT)
    },
    onError: (err) => toast.error(err.message || 'No se pudo guardar el cliente'),
  })

  const handleSubmitClient = () => {
    if (!clientForm.full_name.trim()) { toast.error('Ingresá el nombre del cliente'); return }
    if (!activeStoreId) { toast.error('Seleccioná un negocio para crear clientes'); return }
    clientMutation.mutate({
      id: editingClient?.id,
      payload: { ...clientForm, full_name: clientForm.full_name.trim(), store_id: activeStoreId },
    })
  }

  const openNewClientModal = () => {
    setEditingClient(null)
    setClientForm(EMPTY_CLIENT)
    setShowClientModal(true)
  }

  const openEditClientModal = (client) => {
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
    setShowClientModal(true)
  }

  // ── Budget mutations ───────────────────────────────────────────────────────
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
      setShowBudgetForm(false)
    },
    onError: (err) => toast.error(err.message || 'No se pudo guardar el presupuesto'),
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
    onError: (err) => toast.error(err.message || 'No se pudo actualizar el presupuesto'),
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
    onError: (err) => toast.error(err.message || 'No se pudo pasar a cuenta corriente'),
  })

  const handleCreateBudget = () => {
    if (!selectedClient) { toast.error('Seleccioná un cliente'); return }
    if (!activeStoreId) { toast.error('Seleccioná un negocio'); return }
    if (!budgetForm.items.length) { toast.error('Agregá al menos un producto'); return }
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

  const handleAddBudgetItem = () => {
    const product = products.find(p => p.id === productToAdd)
    if (!product) return
    setBudgetForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: Number(product.sale_price || 0),
        subtotal: Number(product.sale_price || 0),
      }],
    }))
    setProductToAdd('')
  }

  const handleBudgetItemChange = (index, field, value) => {
    setBudgetForm(prev => {
      const nextItems = prev.items.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, [field]: field === 'product_name' ? value : Number(value || 0) }
        next.subtotal = Number(next.quantity || 0) * Number(next.unit_price || 0)
        return next
      })
      return { ...prev, items: nextItems }
    })
  }

  // ── Account entry mutation ─────────────────────────────────────────────────
  const accountEntryMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('client_account_entries').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-account'] })
      toast.success('Movimiento registrado')
      setEntryForm(EMPTY_ENTRY)
      setShowEntryForm(false)
    },
    onError: (err) => toast.error(err.message || 'No se pudo registrar el movimiento'),
  })

  const markFiadoPaidMutation = useMutation({
    mutationFn: async ({ id, method }) => {
      const { error } = await supabase.from('fiados').update({ paid: true, notes: method }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-fiados', selectedClientId] })
      queryClient.invalidateQueries({ queryKey: ['fiados'] })
      toast.success('Fiado cobrado')
      setFiadoPayModal(null)
    },
    onError: (err) => toast.error(err.message || 'No se pudo cobrar el fiado'),
  })

  const handleCreateEntry = () => {
    if (!selectedClient) { toast.error('Seleccioná un cliente'); return }
    if (!activeStoreId) { toast.error('Seleccioná un negocio'); return }
    const amount = Number(entryForm.amount || 0)
    if (amount <= 0) { toast.error('Ingresá un importe válido'); return }
    if (!entryForm.description.trim()) { toast.error('Ingresá una descripción'); return }
    accountEntryMutation.mutate({
      client_id: selectedClient.id,
      store_id: activeStoreId,
      movement_type: entryForm.movement_type,
      amount,
      description: entryForm.description.trim(),
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Clientes</p>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && stores.length > 1 && (
            <select
              value={selectedStoreId || ''}
              onChange={e => setSelectedStoreId(e.target.value || null)}
              className="border border-gray-200 rounded-full px-4 py-2 text-sm"
            >
              <option value="">Todos los negocios</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={openNewClientModal}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-full hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Sidebar: client list ─────────────────────────────────────────── */}
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-4 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {isLoadingClients && (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            )}
            {!isLoadingClients && filteredClients.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">
                {search ? 'Sin resultados' : 'No hay clientes aún'}
              </div>
            )}
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-220px)] overflow-y-auto">
              {filteredClients.map(client => {
                const isSelected = client.id === selectedClientId
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${
                      isSelected ? 'bg-zinc-900 text-white' : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <p className="font-semibold text-sm leading-tight">{client.full_name}</p>
                    <p className={`text-xs mt-1 truncate ${isSelected ? 'text-zinc-400' : 'text-gray-400'}`}>
                      {client.phone || client.email || 'Sin contacto'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">{clients.length} clientes registrados</p>
        </aside>

        {/* ── Main panel ──────────────────────────────────────────────────── */}
        <section className="space-y-4 min-h-[60vh]">
          {!selectedClient ? (
            <div className="h-full min-h-[400px] bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">👤</div>
              <p className="font-semibold text-gray-700">Seleccioná un cliente</p>
              <p className="text-sm text-gray-400">Elegí un cliente de la lista para ver su cuenta corriente, presupuestos y métricas</p>
              <button
                onClick={openNewClientModal}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-full hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo cliente
              </button>
            </div>
          ) : (
            <>
              {/* Client header */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-700 shrink-0">
                      {selectedClient.full_name[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedClient.full_name}</h2>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {selectedClient.phone && <span className="text-sm text-gray-500">📞 {selectedClient.phone}</span>}
                        {selectedClient.email && <span className="text-sm text-gray-500">✉️ {selectedClient.email}</span>}
                        {selectedClient.document_id && <span className="text-sm text-gray-500">🪪 {selectedClient.document_id}</span>}
                      </div>
                      {selectedClient.address && <p className="text-sm text-gray-400 mt-1">📍 {selectedClient.address}</p>}
                      {selectedClient.notes && <p className="text-sm text-gray-500 italic mt-1">{selectedClient.notes}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => openEditClientModal(selectedClient)}
                    className="shrink-0 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Editar
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <MetricCard
                    icon={CreditCard}
                    label="Saldo cuenta corriente"
                    value={fmtMoney(accountBalance)}
                    color={accountBalance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
                  />
                  <MetricCard
                    icon={FileText}
                    label="Presupuestos activos"
                    value={pendingBudgets.length}
                    sub={`${budgets.length} total`}
                    color="bg-sky-50"
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Total presupuestado"
                    value={fmtMoney(totalBudgetado)}
                    color="bg-purple-50"
                  />
                  <MetricCard
                    icon={Clock}
                    label="Último movimiento"
                    value={accountEntries[0] ? formatDateOnlyART(accountEntries[0].created_at) : '—'}
                    sub={accountEntries[0]?.description}
                    color="bg-gray-50"
                  />
                </div>
              </div>

              {/* Presupuestos */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">Presupuestos</h2>
                  <button
                    onClick={() => setShowBudgetForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo presupuesto
                  </button>
                </div>

                {/* Budget form (collapsible) */}
                {showBudgetForm && (
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-gray-50">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={productToAdd}
                        onChange={e => setProductToAdd(e.target.value)}
                        className="h-10 flex-1 min-w-[180px] px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      >
                        <option value="">Agregar producto...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</option>)}
                      </select>
                      <button
                        onClick={handleAddBudgetItem}
                        disabled={!productToAdd}
                        className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-white disabled:opacity-40 bg-white"
                      >
                        Agregar
                      </button>
                      <input
                        value={budgetForm.valid_until}
                        onChange={e => setBudgetForm(prev => ({ ...prev, valid_until: e.target.value }))}
                        type="date"
                        className="h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      />
                      <select
                        value={budgetForm.status}
                        onChange={e => setBudgetForm(prev => ({ ...prev, status: e.target.value }))}
                        className="h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      >
                        {BUDGET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>

                    {budgetForm.items.length > 0 && (
                      <div className="space-y-2">
                        {budgetForm.items.map((item, index) => (
                          <div key={`${item.product_id}-${index}`} className="flex flex-wrap gap-2 items-center">
                            <input
                              value={item.product_name}
                              onChange={e => handleBudgetItemChange(index, 'product_name', e.target.value)}
                              className="h-9 flex-1 min-w-[120px] px-3 border border-gray-200 rounded-lg text-sm bg-white"
                            />
                            <input
                              value={item.quantity}
                              onChange={e => handleBudgetItemChange(index, 'quantity', e.target.value)}
                              type="number" min="1" placeholder="Cant."
                              className="h-9 w-20 px-3 border border-gray-200 rounded-lg text-sm bg-white"
                            />
                            <input
                              value={item.unit_price}
                              onChange={e => handleBudgetItemChange(index, 'unit_price', e.target.value)}
                              type="number" min="0" placeholder="Precio"
                              className="h-9 w-28 px-3 border border-gray-200 rounded-lg text-sm bg-white"
                            />
                            <span className="h-9 px-3 rounded-lg bg-white border border-gray-100 flex items-center text-sm font-semibold text-zinc-900 shrink-0">
                              {fmtMoney(item.subtotal)}
                            </span>
                            <button
                              onClick={() => setBudgetForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))}
                              className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-sm font-semibold">
                          <span className="text-gray-500">Total</span>
                          <span className="text-gray-900">{fmtMoney(budgetSubtotal)}</span>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={budgetForm.notes}
                      onChange={e => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas del presupuesto (opcional)"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none bg-white"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBudgetForm(false)}
                        className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateBudget}
                        disabled={budgetMutation.isPending || !budgetForm.items.length}
                        className="flex-1 h-10 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {budgetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar presupuesto
                      </button>
                    </div>
                  </div>
                )}

                {/* Budget list */}
                {budgets.length === 0 && !showBudgetForm && (
                  <p className="text-sm text-gray-400 py-4 text-center">Este cliente no tiene presupuestos aún</p>
                )}
                <div className="space-y-3">
                  {budgets.map(budget => {
                    const statusInfo = budgetStatusInfo(budget.status)
                    return (
                      <div key={budget.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                        {/* Budget header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{budget.budget_number}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDateOnlyART(budget.created_at)}
                              {budget.valid_until ? ` · vence ${formatDateOnlyART(budget.valid_until)}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            <select
                              value={budget.status}
                              onChange={e => budgetStatusMutation.mutate({ id: budget.id, status: e.target.value })}
                              className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white"
                            >
                              {BUDGET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            {/* Print button */}
                            <button
                              onClick={() => printBudget(budget, selectedClient)}
                              title="Imprimir / Guardar como PDF"
                              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Imprimir
                            </button>
                            {/* WhatsApp share */}
                            <button
                              onClick={() => shareBudgetWhatsApp(budget, selectedClient)}
                              title="Compartir por WhatsApp"
                              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              Compartir
                            </button>
                            {/* Post to account */}
                            <button
                              disabled={budget.posted_to_account || postBudgetMutation.isPending}
                              onClick={() => postBudgetMutation.mutate(budget)}
                              className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                            >
                              {budget.posted_to_account ? 'En cuenta corriente' : 'Pasar a CC'}
                            </button>
                          </div>
                        </div>
                        {/* Budget items */}
                        <div className="px-4 py-3 space-y-1.5">
                          {(budget.items || []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{item.product_name} <span className="text-gray-400">×{item.quantity}</span></span>
                              <span className="font-semibold text-gray-900">{fmtMoney(item.subtotal)}</span>
                            </div>
                          ))}
                          {budget.notes && <p className="text-xs text-gray-400 italic pt-1">{budget.notes}</p>}
                          <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                            <span className="text-xs text-gray-400">Total</span>
                            <span className="font-bold text-base text-zinc-900">{fmtMoney(budget.subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cuenta corriente */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Cuenta corriente</h2>
                    <p className="text-xs text-gray-400">{accountEntries.length} movimientos</p>
                  </div>
                  <button
                    onClick={() => setShowEntryForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo movimiento
                  </button>
                </div>

                {showEntryForm && (
                  <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={entryForm.movement_type}
                        onChange={e => setEntryForm(prev => ({ ...prev, movement_type: e.target.value }))}
                        className="h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      >
                        {MOVEMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input
                        value={entryForm.amount}
                        onChange={e => setEntryForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="Importe"
                        type="number" min="0"
                        className="h-10 w-36 px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      />
                      <input
                        value={entryForm.description}
                        onChange={e => setEntryForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descripción"
                        className="h-10 flex-1 min-w-[160px] px-3 border border-gray-200 rounded-xl text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowEntryForm(false)}
                        className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateEntry}
                        disabled={accountEntryMutation.isPending}
                        className="flex-1 h-10 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {accountEntryMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Registrar
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {accountEntries.length === 0 && (
                    <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos aún</p>
                  )}
                  {accountEntries.map(entry => (
                    <div key={entry.id} className="border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm leading-tight">{entry.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateTimeART(entry.created_at)}
                          {entry.budgets?.budget_number ? ` · ${entry.budgets.budget_number}` : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${entry.movement_type === 'debit' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {entry.movement_type === 'debit' ? '+' : '-'} {fmtMoney(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fiados del cliente ─────────────────────────────────────── */}
              {(() => {
                const pendientes = clientFiados.filter(f => f.status === 'pendiente')
                const pagados    = clientFiados.filter(f => f.status === 'pagado')
                const totalDeuda = pendientes.reduce((s, f) => s + (f.amount || 0), 0)
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">Fiados</h2>
                        {pendientes.length > 0 && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} · Deuda total: <strong>{fmtMoney(totalDeuda)}</strong>
                          </p>
                        )}
                      </div>
                      {totalDeuda > 0 && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-full">
                          {fmtMoney(totalDeuda)}
                        </span>
                      )}
                    </div>

                    {clientFiados.length === 0 && (
                      <p className="text-sm text-gray-400 py-2">Este cliente no tiene fiados registrados.</p>
                    )}

                    {pendientes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pendientes</p>
                        {pendientes.map(f => (
                          <div key={f.id} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-500">{formatDateTimeART(f.created_at)}</p>
                              {f.notes && <p className="text-xs text-gray-400 truncate">{f.notes}</p>}
                              {(f.items || []).length > 0 && (
                                <p className="text-xs text-gray-400 truncate">
                                  {(f.items || []).map(i => `${i.product_name || 'Producto'} ×${i.quantity}`).join(' · ')}
                                </p>
                              )}
                            </div>
                            <p className="text-base font-bold text-amber-700 shrink-0">{fmtMoney(f.amount)}</p>
                            <button
                              onClick={() => { setFiadoPayModal(f); setFiadoPayMethod('efectivo') }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0"
                            >
                              Cobrar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {pagados.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cobrados</p>
                        {pagados.map(f => (
                          <div key={f.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-500">{formatDateTimeART(f.created_at)}</p>
                              {f.notes && <p className="text-xs text-gray-400 truncate">{f.notes}</p>}
                            </div>
                            <p className="text-sm font-semibold text-gray-500 line-through">{fmtMoney(f.amount)}</p>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Cobrado</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </section>
      </div>

      {/* ── Modal: cobrar fiado desde cliente ─────────────────────────────── */}
      {fiadoPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-xl">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Cobrar fiado</p>
              <h3 className="text-xl font-bold mt-1">{fiadoPayModal.customer_name}</h3>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{fmtMoney(fiadoPayModal.amount)}</p>
              {fiadoPayModal.notes && <p className="text-xs text-gray-400 mt-1">{fiadoPayModal.notes}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de cobro</p>
              <div className="grid grid-cols-2 gap-2">
                {[{ key: 'efectivo', label: '💵 Efectivo' }, { key: 'mercadopago', label: '📱 Mercado Pago' }].map(({ key, label }) => (
                  <button key={key} onClick={() => setFiadoPayMethod(key)}
                    className={`py-3 rounded-xl text-sm font-semibold transition-colors ${fiadoPayMethod === key ? 'bg-zinc-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFiadoPayModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => markFiadoPaidMutation.mutate({ id: fiadoPayModal.id, method: fiadoPayMethod })}
                disabled={markFiadoPaidMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: nuevo / editar cliente ─────────────────────────────────── */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingClient ? 'Editar cliente' : 'Nuevo cliente'}</h3>
              <button
                onClick={() => { setShowClientModal(false); setEditingClient(null); setClientForm(EMPTY_CLIENT) }}
                className="p-2 rounded-xl hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={clientForm.full_name}
                onChange={e => setClientForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nombre y apellido *"
                className="w-full h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={clientForm.phone}
                  onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Teléfono"
                  className="h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                />
                <input
                  value={clientForm.email}
                  onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={clientForm.document_id}
                  onChange={e => setClientForm(prev => ({ ...prev, document_id: e.target.value }))}
                  placeholder="DNI / CUIT"
                  className="h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                />
                <input
                  value={clientForm.address}
                  onChange={e => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Dirección"
                  className="h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                />
              </div>
              <textarea
                value={clientForm.notes}
                onChange={e => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas internas (opcional)"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowClientModal(false); setEditingClient(null); setClientForm(EMPTY_CLIENT) }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitClient}
                disabled={clientMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {clientMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingClient ? 'Guardar cambios' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
