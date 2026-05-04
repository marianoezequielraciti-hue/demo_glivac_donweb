import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchApi } from '@/lib/api'
import { formatDateTimeART, fmtMoney, nowART } from '@/components/argentina'
import { Loader2, Printer, Plus, Minus, X, ShoppingCart, Search, Clock } from 'lucide-react'
import { loadPromotions } from '@/lib/promotions'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import Receipt from '@/components/pos/Receipt'

const PAYMENT_METHODS = ['efectivo', 'transferencia', 'qr', 'tarjeta', 'fiado']
const PAYMENT_LABELS = { efectivo: 'Efectivo', transferencia: 'Transf.', qr: 'QR', tarjeta: 'Tarjeta', fiado: 'Fiado' }
const PAYMENT_ICONS  = { efectivo: '💵', transferencia: '🏦', qr: '📱', tarjeta: '💳', fiado: '📋' }
const STORAGE_KEY = 'glivac-demo-turno'

export default function POSv2() {
  const queryClient = useQueryClient()
  const { user, displayName, storeId, storeName } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId, currentStore, isAdmin } = useStoreFilter()
  const effectiveStoreId = selectedStoreId || storeId || (stores.length === 1 ? stores[0].id : null)
  const [screen, setScreen] = useState('apertura')
  const [turno, setTurno] = useState(null)
  const [montoInicial, setMontoInicial] = useState('')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [fiadoCustomer, setFiadoCustomer] = useState('')
  const [showFiadoModal, setShowFiadoModal] = useState(false)
  const [pendingSale, setPendingSale] = useState(null)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetClientSearch, setBudgetClientSearch] = useState('')
  const [budgetClientId, setBudgetClientId] = useState(null)
  const [budgetClientName, setBudgetClientName] = useState('')
  const [fiadoClientSearch, setFiadoClientSearch] = useState('')
  const [fiadoClientSelected, setFiadoClientSelected] = useState(false)
  const [fiadoClientId, setFiadoClientId] = useState(null)
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)
  const fiadoInputRef = useRef(null)
  const [liveTime, setLiveTime] = useState(nowART())
  const [isNocturnalSurcharge, setIsNocturnalSurcharge] = useState(false)
  const [surchargeBypassed, setSurchargeBypassed] = useState(false)
  const [realCashCount, setRealCashCount] = useState('')
  const [observations, setObservations] = useState('')
  const [closingSummary, setClosingSummary] = useState(null)
  const barcodeRef = useRef(null)
  const montoRef = useRef(null)
  const [promotions, setPromotions] = useState(() => loadPromotions())
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [openShiftWarning, setOpenShiftWarning] = useState(null) // { id, cajero, inicio }

  const { data: products = [] } = useQuery({
    queryKey: ['products', effectiveStoreId],
    queryFn: async () => {
      let q = supabase.from('products').select('*').eq('active', true)
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', effectiveStoreId, turno?.inicio],
    queryFn: async () => {
      let q = supabase.from('sales').select('*').order('created_at', { ascending: false })
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      if (turno?.inicio) q = q.gte('created_at', turno.inicio)
      else q = q.limit(100)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })

  useEffect(() => {
    const interval = setInterval(() => setLiveTime(nowART()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (currentStore?.type !== 'kiosco') {
      setIsNocturnalSurcharge(false)
      return
    }
    const check = () => {
      const now = new Date()
      // ART = UTC-3
      const artMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() - 180 + 1440) % 1440
      setIsNocturnalSurcharge(artMinutes >= 22 * 60 + 30 || artMinutes < 6 * 60 + 30)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [currentStore?.type])

  useEffect(() => {
    if (screen === 'pos') barcodeRef.current?.focus()
    if (screen === 'apertura') montoRef.current?.focus()
  }, [screen])

  useEffect(() => {
    const refresh = () => setPromotions(loadPromotions())
    const storageHandler = (e) => { if (e.key === 'glivac-demo-promotions') refresh() }
    window.addEventListener('glivac-demo-promotions', refresh)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('glivac-demo-promotions', refresh)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.turno) {
          // Solo restaurar si el turno pertenece al mismo store del usuario actual
          const turnoStore = parsed.turno.storeId
          const userStore = effectiveStoreId
          // Descartar turno si tiene storeId null pero el usuario tiene uno asignado
          // (turno creado antes de los fixes de aislamiento)
          const shouldRestore = turnoStore && userStore
            ? turnoStore === userStore
            : !turnoStore && !userStore  // ambos null: caso admin legacy
          if (shouldRestore) {
            setTurno(parsed.turno)
            setScreen(parsed.screen || 'pos')
          } else {
            // Turno de otro local — descartarlo
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch {}
    }
  }, [user, effectiveStoreId])

  useEffect(() => {
    if (screen !== 'apertura' || !effectiveStoreId) {
      setOpenShiftWarning(null)
      return
    }
    let cancelled = false
    supabase
      .from('open_shifts')
      .select('id, cajero, inicio')
      .eq('store_id', effectiveStoreId)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setOpenShiftWarning(data?.[0] || null)
      })
    return () => { cancelled = true }
  }, [screen, effectiveStoreId])

  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return products
      .filter(p => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || String(p.barcode || '').includes(q)
        const matchCat = !categoryFilter || p.category === categoryFilter
        return matchSearch && matchCat
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [products, searchQuery, categoryFilter])

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const surchargeMultiplier = (isNocturnalSurcharge && !surchargeBypassed) ? 1.10 : 1

  const addToCart = (product, qty = 1) => {
    if (!product) return
    if (!product.allow_negative_stock) {
      const inCart = cart.find(i => i.product_id === product.id)?.quantity || 0
      if (inCart + qty > product.current_stock) {
        toast.error(`Sin stock suficiente (disponible: ${product.current_stock})`)
        return
      }
    }
    const effectivePrice = Math.round(product.sale_price * surchargeMultiplier)
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + qty, subtotal: (i.quantity + qty) * i.unit_price }
          : i)
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: effectivePrice,
        purchase_price: product.purchase_price || 0,
        subtotal: qty * effectivePrice,
      }]
    })
  }

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item
      const nextQty = Math.max(1, item.quantity + delta)
      return { ...item, quantity: nextQty, subtotal: nextQty * item.unit_price }
    }))
  }

  const handleQuantityInput = (productId, value) => {
    const parsed = parseInt(value, 10)
    if (Number.isNaN(parsed) || parsed <= 0) {
      setCart(prev => prev.filter(item => item.product_id !== productId))
      return
    }
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item
      return { ...item, quantity: parsed, subtotal: parsed * item.unit_price }
    }))
  }

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.product_id !== productId))

  // Clientes para presupuesto
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', effectiveStoreId],
    queryFn: async () => {
      let q = supabase.from('clients').select('id, full_name').eq('active', true).order('full_name')
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })

  const budgetMutation = useMutation({
    mutationFn: async ({ cartItems, total, clientId }) => {
      const { error } = await supabase.from('budgets').insert({
        client_id: clientId,
        budget_number: `P-${Date.now()}`,
        status: 'draft',
        items: cartItems,
        subtotal: total,
        ...(effectiveStoreId ? { store_id: effectiveStoreId } : {}),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Presupuesto generado')
      setCart([])
      setShowBudgetModal(false)
      setBudgetClientId(null)
      setBudgetClientName('')
      setBudgetClientSearch('')
    },
    onError: (err) => toast.error(`Error al generar presupuesto: ${err.message}`),
  })

  const handleOpenBudgetModal = () => {
    if (!cart.length) { toast.error('Agregá productos al carrito'); return }
    setShowBudgetModal(true)
  }

  const handleConfirmBudget = () => {
    if (!budgetClientId) { toast.error('Seleccioná un cliente'); return }
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
    budgetMutation.mutate({ cartItems: [...cart], total, clientId: budgetClientId })
  }

  const completeSaleMutation = useMutation({
    mutationFn: async ({ cartItems, total, method, customerName, clientId }) => {
      const { data: sale, error } = await supabase.from('sales').insert({
        sale_number: `V-${Date.now()}`,
        items: cartItems,
        total,
        payment_method: method,
        cashier: turno.cajero,
        notes: customerName ? `Fiado: ${customerName}` : null,
        ...(turno.storeId ? { store_id: turno.storeId } : {}),
      }).select().single()
      if (error) throw error

      if (method === 'fiado') {
        const { error: fiadoError } = await supabase.from('fiados').insert({
          client: customerName,
          customer_name: customerName,
          amount: total,
          paid: false,
          items: cartItems,
          notes: `Venta ${sale.sale_number}`,
          ...(clientId ? { client_id: clientId } : {}),
          ...(turno.storeId ? { store_id: turno.storeId } : {}),
        })
        if (fiadoError) {
          await supabase.from('sales').delete().eq('id', sale.id)
          throw new Error(`No se pudo registrar el fiado: ${fiadoError.message}`)
        }
      }

      // Decremento atómico por producto (agrupa por id para evitar dobles updates)
      const deltaMap = {}
      for (const item of cartItems) {
        if (item.product_id) deltaMap[item.product_id] = (deltaMap[item.product_id] || 0) + item.quantity
      }
      const stockItems = Object.entries(deltaMap).map(([product_id, qty]) => ({ product_id, qty }))
      if (stockItems.length) await fetchApi('/api/products/adjust-stock', { body: stockItems })
      return sale
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['fiados'] })
      setCompletedSale(sale)
      setCart([])
      setPaymentMethod('efectivo')
      setFiadoCustomer('')
      setFiadoClientSearch('')
      setFiadoClientSelected(false)
      setFiadoClientId(null)
      setShowFiadoModal(false)
      setPendingSale(null)
      setShowMobileCart(false)
      toast.success('Venta registrada')
    },
    onError: () => toast.error('Error al registrar la venta'),
  })

  const handleConfirmSale = () => {
    if (!cart.length || !turno) return
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
    const cartItems = [...cart]
    if (paymentMethod === 'fiado') {
      setPendingSale({ cartItems, total })
      setShowFiadoModal(true)
      setTimeout(() => fiadoInputRef.current?.focus(), 100)
      return
    }
    completeSaleMutation.mutate({ cartItems, total, method: paymentMethod })
  }

  const resetFiadoModal = () => {
    setShowFiadoModal(false)
    setPendingSale(null)
    setFiadoCustomer('')
    setFiadoClientSearch('')
    setFiadoClientSelected(false)
    setFiadoClientId(null)
    setShowNewClientForm(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  const handleConfirmFiado = () => {
    if (!fiadoClientId) { toast.error('Seleccioná o creá un cliente para continuar'); return }
    completeSaleMutation.mutate({
      cartItems: pendingSale.cartItems,
      total: pendingSale.total,
      method: 'fiado',
      customerName: fiadoCustomer.trim(),
      clientId: fiadoClientId,
    })
  }

  const handleCreateClientAndSelect = async () => {
    const name = newClientName.trim()
    if (!name) { toast.error('Ingresá el nombre del cliente'); return }
    setCreatingClient(true)
    try {
      const { data, error } = await supabase.from('clients').insert({
        full_name: name,
        phone: newClientPhone.trim() || null,
        active: true,
        ...(effectiveStoreId ? { store_id: effectiveStoreId } : {}),
      })
      if (error) throw error
      const created = data
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setFiadoCustomer(name)
      setFiadoClientSearch(name)
      setFiadoClientSelected(true)
      setFiadoClientId(created?.id || null)
      // Refetch clients so the new one appears
      const { data: fresh } = await supabase.from('clients').select('id, full_name, phone').ilike('full_name', name).limit(1).single()
      if (fresh) setFiadoClientId(fresh.id)
      setShowNewClientForm(false)
      setNewClientName('')
      setNewClientPhone('')
      toast.success(`Cliente "${name}" creado`)
    } catch (err) {
      toast.error('No se pudo crear el cliente: ' + err.message)
    } finally {
      setCreatingClient(false)
    }
  }

  const handleFiadoClientPick = (client) => {
    setFiadoCustomer(client.full_name)
    setFiadoClientSearch(client.full_name)
    setFiadoClientSelected(true)
    setFiadoClientId(client.id)
    setShowNewClientForm(false)
  }

  const handleApplyPromotion = (promo) => {
    if (!promo?.productIds?.length) return
    promo.productIds.forEach(id => {
      const product = products.find(p => p.id === id)
      if (product) addToCart(product)
    })
    toast.success(`Promoción "${promo.name}" aplicada`)
  }

  const startTurno = async () => {
    if (!montoInicial) {
      toast.error('Ingresá el monto inicial en caja')
      return
    }
    if (!effectiveStoreId) {
      toast.error('Seleccioná un negocio antes de abrir el turno')
      return
    }
    if (openShiftWarning) {
      toast.error('Cerrá el turno anterior antes de iniciar uno nuevo')
      return
    }
    const activeStoreId = effectiveStoreId
    const activeStoreName = stores.find(s => s.id === activeStoreId)?.name || storeName || null
    const cajero = displayName || user?.email || 'Cajero'
    const inicio = nowART().toISOString()

    let openShiftId = null
    try {
      const { data } = await supabase.from('open_shifts').insert({
        store_id: activeStoreId,
        cajero,
        inicio,
      }).select('id').single()
      openShiftId = data?.id
    } catch (err) {
      console.error('Error registrando apertura de turno:', err)
    }

    const newTurno = {
      cajero,
      montoInicial: parseFloat(montoInicial) || 0,
      inicio,
      storeId: activeStoreId,
      storeName: activeStoreName,
      openShiftId,
    }
    setTurno(newTurno)
    setScreen('pos')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ turno: newTurno, screen: 'pos' }))
  }

  const turnoSales = useMemo(() => {
    if (!turno) return []
    const inicio = new Date(turno.inicio)
    return sales.filter(s =>
      new Date(s.created_at) >= inicio &&
      (!turno.storeId || s.store_id === turno.storeId)
    )
  }, [sales, turno])

  const efectivoTotal = turnoSales.filter(s => s.payment_method === 'efectivo').reduce((sum, s) => sum + (s.total || 0), 0)
  const otherPayments = turnoSales.filter(s => s.payment_method !== 'efectivo').reduce((sum, s) => sum + (s.total || 0), 0)
  const expectedCash = (turno?.montoInicial || 0) + efectivoTotal
  const realCashNumber = parseFloat(realCashCount) || 0
  const cashDiff = realCashCount ? realCashNumber - expectedCash : 0

  const handleConfirmCierre = async () => {
    if (!realCashCount) { toast.error('Ingresá el conteo real'); return }
    const fiadoSales = turnoSales.filter(s => s.payment_method === 'fiado')
    const summary = {
      salesCount: turnoSales.length,
      total: turnoSales.reduce((sum, s) => sum + (s.total || 0), 0),
      efectivo: efectivoTotal,
      digital: otherPayments,
      fiadosCount: fiadoSales.length,
      fiadosTotal: fiadoSales.reduce((sum, s) => sum + (s.total || 0), 0),
      expectedCash,
      realCash: realCashNumber,
      diff: cashDiff,
      observations,
    }
    // Save shift log to DB (non-blocking — UI won't hang if it fails)
    try {
      await supabase.from('shift_logs').insert({
        cajero: turno.cajero,
        inicio: turno.inicio,
        fin: new Date().toISOString(),
        monto_inicial: turno.montoInicial,
        monto_esperado: expectedCash,
        monto_real: realCashNumber,
        diferencia: cashDiff,
        total_ventas: summary.salesCount,
        total_recaudado: summary.total,
        total_efectivo: efectivoTotal,
        total_digital: otherPayments,
        observaciones: observations,
        ...(turno.storeId ? { store_id: turno.storeId } : {}),
      })
    } catch (err) {
      console.error('Error guardando turno:', err)
    }
    // Marcar el turno como cerrado en open_shifts
    if (turno.openShiftId) {
      supabase.from('open_shifts').delete().eq('id', turno.openShiftId).then()
    }
    // Limpiar localStorage al confirmar el cierre — evita que el turno
    // se restaure como "abierto" si el usuario refresca antes de tocar
    // "Abrir nuevo turno"
    localStorage.removeItem(STORAGE_KEY)
    setClosingSummary(summary)
    setScreen('resumen')
  }

  const resetTurno = () => {
    setScreen('apertura')
    setTurno(null)
    setCart([])
    setCompletedSale(null)
    setMontoInicial('')
    setBarcodeInput('')
    setSearchQuery('')
    setCategoryFilter('')
    setPaymentMethod('efectivo')
    setRealCashCount('')
    setObservations('')
    setClosingSummary(null)
    setFiadoCustomer('')
    setFiadoClientId(null)
    setShowFiadoModal(false)
    setPendingSale(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const forceCloseOpenShift = async () => {
    if (!openShiftWarning) return
    try {
      await supabase.from('open_shifts').delete().eq('id', openShiftWarning.id)
      setOpenShiftWarning(null)
      toast.success('Turno anterior cerrado')
    } catch (err) {
      toast.error('Error al cerrar el turno anterior')
    }
  }

  // ─── APERTURA ────────────────────────────────────────────────────────────────
  if (screen === 'apertura') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              {(displayName || 'U')[0].toUpperCase()}
            </div>
            <p className="text-sm text-gray-500 uppercase tracking-widest">Bienvenido</p>
            <h2 className="text-2xl font-bold text-gray-900">{displayName || 'Cajero'}</h2>
          </div>

          {openShiftWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Hay un turno sin cerrar</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Cajero: <strong>{openShiftWarning.cajero}</strong> · Desde: {formatDateTimeART(new Date(openShiftWarning.inicio))}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Debés cerrar el turno anterior antes de iniciar uno nuevo.
                  </p>
                </div>
              </div>
              <button
                onClick={forceCloseOpenShift}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Cerrar turno anterior
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            {isAdmin && stores.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Negocio
                </label>
                <select
                  value={selectedStoreId || ''}
                  onChange={e => setSelectedStoreId(e.target.value || null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                >
                  <option value="">Seleccioná un negocio</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Monto en caja al iniciar
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  ref={montoRef}
                  type="number"
                  value={montoInicial}
                  onChange={e => setMontoInicial(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startTurno()}
                  placeholder="0,00"
                  disabled={!!openShiftWarning}
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <button
              onClick={startTurno}
              disabled={!!openShiftWarning}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Iniciar turno
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            <Clock className="inline w-3 h-3 mr-1" />
            {formatDateTimeART(liveTime)}
          </p>
        </div>
      </div>
    )
  }

  // ─── CIERRE ───────────────────────────────────────────────────────────────────
  if (screen === 'cierre' && turno) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Cierre de turno</p>
            <h2 className="text-xl font-bold">{turno.cajero}</h2>
          </div>
          <button onClick={() => setScreen('pos')} className="text-sm text-blue-600 font-semibold">Volver</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Ventas', value: turnoSales.length, isMoney: false },
            { label: 'Total recaudado', value: turnoSales.reduce((s, x) => s + (x.total || 0), 0), isMoney: true },
            { label: 'Efectivo', value: efectivoTotal, isMoney: true },
            { label: 'Digital', value: otherPayments, isMoney: true },
            { label: 'Fiados (pendientes)', value: turnoSales.filter(s => s.payment_method === 'fiado').length, isMoney: false },
            { label: 'Total fiado', value: turnoSales.filter(s => s.payment_method === 'fiado').reduce((s, x) => s + (x.total || 0), 0), isMoney: true },
          ].map(({ label, value, isMoney }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold mt-1">{isMoney ? fmtMoney(value) : value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Arqueo de caja</p>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Monto inicial</span>
              <span>{fmtMoney(turno.montoInicial)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventas en efectivo</span>
              <span>{fmtMoney(efectivoTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-2 mt-2">
              <span>Esperado en caja</span>
              <span>{fmtMoney(expectedCash)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conteo real</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number"
                value={realCashCount}
                onChange={e => setRealCashCount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                placeholder="0,00"
              />
            </div>
            {realCashCount && (
              <p className={`text-sm font-semibold mt-2 ${cashDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {cashDiff >= 0 ? '↑' : '↓'} Diferencia: {fmtMoney(Math.abs(cashDiff))} {cashDiff >= 0 ? 'sobrante' : 'faltante'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Observaciones (opcional)</label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 resize-none"
            />
          </div>

          <button
            onClick={handleConfirmCierre}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors"
          >
            Confirmar cierre
          </button>
        </div>
      </div>
    )
  }

  // ─── RESUMEN ─────────────────────────────────────────────────────────────────
  if (screen === 'resumen' && closingSummary) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center space-y-1 py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold">Turno cerrado</h2>
          <p className="text-sm text-gray-500">Resumen del turno de {turno?.cajero}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Ventas', value: closingSummary.salesCount, isMoney: false },
            { label: 'Total', value: closingSummary.total, isMoney: true },
            { label: 'Efectivo', value: closingSummary.efectivo, isMoney: true },
            { label: 'Digital', value: closingSummary.digital, isMoney: true },
            { label: 'Fiados (pendientes)', value: closingSummary.fiadosCount, isMoney: false },
            { label: 'Total fiado', value: closingSummary.fiadosTotal, isMoney: true },
          ].map(({ label, value, isMoney }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold mt-1">{isMoney ? fmtMoney(value) : value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Esperado en caja</span><span>{fmtMoney(closingSummary.expectedCash)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Conteo real</span><span>{fmtMoney(closingSummary.realCash)}</span>
          </div>
          <div className={`flex justify-between font-semibold border-t border-gray-100 pt-2 ${closingSummary.diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            <span>Diferencia</span><span>{fmtMoney(closingSummary.diff)}</span>
          </div>
          {closingSummary.observations && (
            <p className="text-gray-500 text-xs pt-1">{closingSummary.observations}</p>
          )}
        </div>

        <button
          onClick={resetTurno}
          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors"
        >
          Abrir nuevo turno
        </button>
      </div>
    )
  }

  // ─── POS PRINCIPAL ────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-zinc-900 text-white rounded-2xl flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
            {(turno?.cajero || 'C')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{turno?.cajero}</p>
            <p className="text-xs text-zinc-300">
              {turno?.storeName && <span className="mr-1 opacity-70">{turno.storeName} ·</span>}
              {turnoSales.length} ventas · {fmtMoney(turnoSales.reduce((s, x) => s + (x.total || 0), 0))}
            </p>
          </div>
        </div>
        <p className="font-mono text-sm text-zinc-200 hidden sm:block">{formatDateTimeART(liveTime)}</p>
        <button
          onClick={() => setScreen('cierre')}
          className="px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-sm font-semibold transition-colors"
        >
          Cerrar turno
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* Left: products */}
        <div className="space-y-3">
          {/* Search + barcode + category */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={barcodeRef}
                value={barcodeInput || searchQuery}
                onChange={e => {
                  const v = e.target.value
                  // barcode: only word chars and no spaces (handles alphanumeric barcodes)
                  if (/^[A-Za-z0-9_\-]+$/.test(v) && !v.includes(' ')) {
                    setBarcodeInput(v)
                    setSearchQuery('')
                  } else {
                    setSearchQuery(v)
                    setBarcodeInput('')
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && barcodeInput) {
                    const product = products.find(p => String(p.barcode) === barcodeInput.trim())
                    if (product) { addToCart(product); toast.success(product.name) }
                    else toast.error('Código no encontrado')
                    setBarcodeInput('')
                  }
                }}
                placeholder="Buscar o escanear código…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!categoryFilter ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(prev => prev === cat ? '' : cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${categoryFilter === cat ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Nocturnal surcharge banner */}
          {isNocturnalSurcharge && (
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold ${surchargeBypassed ? 'bg-zinc-700 text-zinc-300' : 'bg-indigo-950 text-indigo-100'}`}>
              <span>🌙</span>
              <span className={surchargeBypassed ? 'line-through opacity-50' : ''}>
                Precio nocturno activo (+10%) — 22:30 a 06:30
              </span>
              <label className="ml-auto flex items-center gap-2 cursor-pointer font-normal text-xs whitespace-nowrap select-none">
                <input
                  type="checkbox"
                  checked={surchargeBypassed}
                  onChange={e => setSurchargeBypassed(e.target.checked)}
                  className="w-4 h-4 accent-indigo-300 cursor-pointer"
                />
                Sin recargo
              </label>
            </div>
          )}

          {/* Promotions */}
          {promotions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {promotions.map(promo => (
                <button
                  key={promo.id}
                  onClick={() => handleApplyPromotion(promo)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  ⭐ {promo.name}
                </button>
              ))}
            </div>
          )}

          {/* Product grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pb-24 lg:pb-0">
            {filteredProducts.map(product => {
              const disabled = !product.allow_negative_stock && product.current_stock <= 0
              const inCart = cart.find(i => i.product_id === product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => !disabled && addToCart(product)}
                  disabled={disabled}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    disabled
                      ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                      : inCart
                        ? 'border-zinc-900 bg-zinc-50 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate">{product.category}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-tight line-clamp-2">{product.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {isNocturnalSurcharge && (
                        <p className="text-[10px] text-gray-400 line-through leading-none">{fmtMoney(product.sale_price)}</p>
                      )}
                      <p className={`text-sm font-bold ${isNocturnalSurcharge ? 'text-indigo-700' : 'text-zinc-900'}`}>
                        {fmtMoney(Math.round(product.sale_price * surchargeMultiplier))}
                      </p>
                    </div>
                    {inCart
                      ? <span className="text-xs font-bold text-zinc-900 bg-blue-100 px-2 py-0.5 rounded-full">×{inCart.quantity}</span>
                      : <span className="text-[10px] text-gray-400">stock {product.current_stock}</span>
                    }
                  </div>
                </button>
              )
            })}
            {!filteredProducts.length && (
              <div className="col-span-full py-12 text-center text-sm text-gray-400">Sin productos</div>
            )}
          </div>
        </div>

        {/* Right: cart — desktop sidebar / mobile bottom sheet */}
        {showMobileCart && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setShowMobileCart(false)} />
        )}
        <div
          className={`bg-white border border-gray-100 shadow-sm flex flex-col ${
            showMobileCart
              ? 'fixed inset-x-0 bottom-0 z-40 rounded-t-2xl max-h-[90vh] lg:static lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-2xl'
              : 'hidden lg:flex rounded-2xl'
          }`}
          style={!showMobileCart ? { maxHeight: 'calc(100vh - 160px)', position: 'sticky', top: '80px' } : undefined}
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}</span>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 font-semibold">Vaciar</button>
              )}
              <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            {cart.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center py-8">
                Tocá un producto<br/>para agregarlo
              </div>
            )}
            {cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{fmtMoney(item.unit_price)} × {item.quantity} = {fmtMoney(item.subtotal)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQuantity(item.product_id, -1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={e => handleQuantityInput(item.product_id, e.target.value)}
                    className="w-10 text-center text-sm font-semibold border-0 focus:outline-none"
                  />
                  <button onClick={() => updateQuantity(item.product_id, 1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeFromCart(item.product_id)} className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1">
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {completedSale ? (
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Venta registrada</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">{fmtMoney(completedSale.total)}</p>
                <p className="text-xs text-gray-500">{completedSale.sale_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCompletedSale(null)} className="py-2 text-sm font-semibold border border-zinc-900 text-zinc-900 rounded-xl hover:bg-zinc-50 transition-colors">
                  Nueva venta
                </button>
                <button onClick={() => window.print()} className="py-2 text-sm font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 flex items-center justify-center gap-1 transition-colors">
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-gray-100 space-y-3">
              {/* Payment method */}
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                      paymentMethod === method
                        ? 'bg-zinc-900 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    <span>{PAYMENT_ICONS[method]}</span>
                    {PAYMENT_LABELS[method]}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-2xl font-bold text-gray-900">{fmtMoney(cartTotal)}</span>
              </div>

              <button
                onClick={handleConfirmSale}
                disabled={!cart.length || completeSaleMutation.isPending}
                className="w-full py-3 rounded-xl text-white font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                {completeSaleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar venta
              </button>
              <button
                onClick={handleOpenBudgetModal}
                disabled={!cart.length || budgetMutation.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                📄 Generar presupuesto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Mobile floating cart button */}
    <div className="fixed bottom-0 inset-x-0 p-4 z-20 lg:hidden">
      <button
        onClick={() => setShowMobileCart(true)}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-between px-5 shadow-xl transition-all ${
          cart.length > 0
            ? 'bg-zinc-900 text-white'
            : 'bg-gray-100 text-gray-400 pointer-events-none'
        }`}
      >
        <span className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          {cart.length > 0 ? `${cart.length} ítem${cart.length !== 1 ? 's' : ''}` : 'Carrito vacío'}
        </span>
        <span className="text-lg">{cart.length > 0 ? fmtMoney(cartTotal) : ''}</span>
      </button>
    </div>

    {/* Receipt hidden in DOM — revealed by @media print */}
    <div className="hidden print:block">
      <Receipt sale={completedSale} />
    </div>

    {/* Budget modal */}
    {showBudgetModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Presupuesto</p>
            <h3 className="text-xl font-bold mt-1">Seleccioná el cliente</h3>
            <p className="text-sm text-gray-500 mt-1">
              Total: <span className="font-semibold text-gray-900">{fmtMoney(cart.reduce((s, i) => s + i.subtotal, 0))}</span>
              {' · '}{cart.length} {cart.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={budgetClientSearch}
            onChange={e => { setBudgetClientSearch(e.target.value); setBudgetClientId(null); setBudgetClientName('') }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {clients
              .filter(c => c.full_name.toLowerCase().includes(budgetClientSearch.toLowerCase()))
              .map(c => (
                <button
                  key={c.id}
                  onClick={() => { setBudgetClientId(c.id); setBudgetClientName(c.full_name); setBudgetClientSearch(c.full_name) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    budgetClientId === c.id ? 'bg-zinc-900 text-white' : 'hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  {c.full_name}
                </button>
              ))}
            {clients.filter(c => c.full_name.toLowerCase().includes(budgetClientSearch.toLowerCase())).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">Sin resultados</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowBudgetModal(false); setBudgetClientId(null); setBudgetClientName(''); setBudgetClientSearch('') }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmBudget}
              disabled={!budgetClientId || budgetMutation.isPending}
              className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {budgetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Fiado modal */}
    {showFiadoModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Venta a fiado</p>
            <h3 className="text-xl font-bold mt-1">Seleccionar cliente</h3>
            <p className="text-sm text-gray-500 mt-1">Total: <span className="font-semibold text-gray-900">{fmtMoney(pendingSale?.total || 0)}</span></p>
          </div>

          {!fiadoClientSelected ? (
            <>
              {/* Búsqueda — solo clientes registrados */}
              <div className="space-y-2">
                <input
                  ref={fiadoInputRef}
                  value={fiadoClientSearch}
                  onChange={e => { setFiadoClientSearch(e.target.value); setShowNewClientForm(false) }}
                  placeholder="Buscar cliente registrado..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                />
                {fiadoClientSearch.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                    {clients
                      .filter(c => c.full_name.toLowerCase().includes(fiadoClientSearch.toLowerCase()))
                      .slice(0, 6)
                      .map(c => (
                        <button key={c.id} onClick={() => handleFiadoClientPick(c)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 text-gray-800 flex flex-col">
                          <span className="font-medium">{c.full_name}</span>
                          {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                        </button>
                      ))}
                    {clients.filter(c => c.full_name.toLowerCase().includes(fiadoClientSearch.toLowerCase())).length === 0 && (
                      <div className="py-3 px-3 text-center space-y-2">
                        <p className="text-xs text-gray-400">No hay clientes con ese nombre</p>
                        <button onClick={() => { setShowNewClientForm(true); setNewClientName(fiadoClientSearch) }}
                          className="text-xs font-semibold text-zinc-900 underline underline-offset-2">
                          + Crear cliente nuevo
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {fiadoClientSearch.length === 0 && (
                  <button onClick={() => setShowNewClientForm(true)}
                    className="w-full text-sm font-semibold text-zinc-700 border border-dashed border-gray-300 rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
                    + Crear cliente nuevo
                  </button>
                )}
              </div>

              {/* Formulario nuevo cliente inline */}
              {showNewClientForm && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Nuevo cliente</p>
                  <input value={newClientName} onChange={e => setNewClientName(e.target.value)}
                    placeholder="Nombre completo *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
                  <input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="Teléfono (opcional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/20" />
                  <button onClick={handleCreateClientAndSelect} disabled={creatingClient || !newClientName.trim()}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                    {creatingClient && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Crear y seleccionar
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Cliente seleccionado — mostrar chip con opción de cambiar */
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">{fiadoCustomer}</p>
                <p className="text-xs text-emerald-600">Cliente seleccionado</p>
              </div>
              <button onClick={() => { setFiadoClientSelected(false); setFiadoClientId(null); setFiadoCustomer(''); setFiadoClientSearch('') }}
                className="text-xs text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-900">
                Cambiar
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={resetFiadoModal}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleConfirmFiado}
              disabled={!fiadoClientId || completeSaleMutation.isPending}
              className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2">
              {completeSaleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar fiado
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
