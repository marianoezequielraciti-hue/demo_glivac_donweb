import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { exportToXlsx, importFromXlsx, PRODUCT_COLUMNS } from '@/lib/xlsxUtils'
import { fmtMoney } from '@/components/argentina'
import { PencilLine, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { loadPromotions } from '@/lib/promotions'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import { useStoreGuard } from '@/hooks/useStoreGuard.jsx'

const INITIAL_FORM = {
  barcode: '', name: '', category: 'Otros', unit: 'unidad',
  current_stock: 0, min_stock: 0, purchase_price: 0, sale_price: 0,
  expiration_date: '',
  active: true, allow_negative_stock: true,
}

const CATEGORIES = ['Fiambres', 'Quesos', 'Lácteos', 'Bebidas', 'Panificados', 'Verdulería', 'Limpieza', 'Otros']
const UNITS = ['kg', 'g', 'unidad', 'litro', 'ml', 'docena', 'paquete']
const formatExpiry = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '-'
  return date.toLocaleDateString('es-AR')
}

const daysUntil = (value) => {
  if (!value) return null
  const now = new Date()
  const target = new Date(value)
  if (Number.isNaN(target.valueOf())) return null
  const diff = Math.ceil((target - now) / 86400000)
  return diff
}

export default function Products() {
  const queryClient = useQueryClient()
  const { user, isAdmin, storeId } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId } = useStoreFilter()
  const effectiveStoreId = selectedStoreId || storeId
  const { guard, PickerModal } = useStoreGuard()
  const fileInputRef = useRef(null)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', effectiveStoreId],
    queryFn: async () => {
      let q = supabase.from('products').select('*').order('name')
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      const result = await q
      console.log('[Products] query result:', result)
      return result.data || []
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  })

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [promotions, setPromotions] = useState(() => loadPromotions())

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="inline w-3 h-3 ml-1 text-zinc-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-zinc-600" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-zinc-600" />
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = products.filter(product => {
      const isBarcode = /^\d+$/.test(q)
      const matchesSearch = isBarcode
        ? String(product.barcode || '') === q
        : (
            String(product.name || '').toLowerCase().includes(q) ||
            String(product.barcode || '').toLowerCase().includes(q)
          )
      const matchesCategory = category ? product.category === category : true
      return matchesSearch && matchesCategory
    })
    return [...filtered].sort((a, b) => {
      let aVal, bVal
      if (sortKey === 'margin') {
        aVal = a.sale_price ? (a.sale_price - (a.purchase_price || 0)) / a.sale_price : 0
        bVal = b.sale_price ? (b.sale_price - (b.purchase_price || 0)) / b.sale_price : 0
      } else {
        aVal = a[sortKey] ?? ''
        bVal = b[sortKey] ?? ''
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal, 'es') : bVal.localeCompare(aVal, 'es')
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [products, search, category, sortKey, sortDir])

  const promotionsWithDetails = useMemo(() => promotions.map(promo => ({
    ...promo,
    items: (promo.productIds || []).map(id => products.find(product => product.id === id)).filter(Boolean),
  })), [promotions, products])

  const mutateCreate = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('products').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Producto creado')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error) => {
      if (error?.code === '23505') {
        toast.error('Ya existe un producto con ese código de barras')
      } else {
        toast.error('Error guardando producto: ' + (error?.message || ''))
      }
    },
  })

  const mutateUpdate = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { error } = await supabase.from('products').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Producto actualizado')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('Error actualizando producto'),
  })

  const mutateDelete = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Producto eliminado')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('No se pudo eliminar'),
  })

  const openModal = (product = null) => {
    setSubmitted(false)
    if (product) {
      setForm({
        barcode: product.barcode || '',
        name: product.name || '',
        category: product.category || 'Otros',
        unit: product.unit || 'unidad',
        current_stock: product.current_stock || 0,
        min_stock: product.min_stock || 0,
        purchase_price: product.purchase_price || 0,
        sale_price: product.sale_price || 0,
        markup_pct: product.purchase_price && product.sale_price
          ? +((product.sale_price / product.purchase_price - 1) * 100).toFixed(1)
          : '',
        expiration_date: product.expiration_date || '',
        active: product.active ?? true,
        allow_negative_stock: product.allow_negative_stock ?? true,
      })
      setEditingProduct(product)
    } else {
      setForm(INITIAL_FORM)
      setEditingProduct(null)
    }
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSubmitted(true)

    if (!form.barcode?.trim()) {
      toast.error('El código de barras es obligatorio')
      return
    }

    // Check if barcode collides with an active product (ignore inactive/deactivated ones)
    const barcodeNorm = form.barcode.trim()
    const newStoreId = editingProduct ? editingProduct.store_id : (selectedStoreId || form.store_id || storeId || null)
    const targetStore = newStoreId
    const collision = products.find(
      p => p.active !== false &&
           String(p.barcode).trim() === barcodeNorm &&
           p.id !== editingProduct?.id &&
           p.store_id === targetStore
    )
    if (collision) {
      toast.error(`El código ${barcodeNorm} ya pertenece a "${collision.name}"`)
      return
    }

    const { markup_pct: _, ...formData } = form
    const payload = {
      ...formData,
      barcode: barcodeNorm,
      current_stock: parseFloat(form.current_stock) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      expiration_date: form.expiration_date || null,
      ...(!editingProduct && newStoreId ? { store_id: newStoreId } : {}),
    }

    try {
      if (editingProduct) {
        await mutateUpdate.mutateAsync({ id: editingProduct.id, payload })
      } else {
        await mutateCreate.mutateAsync(payload)
      }
      setShowModal(false)
    } catch {
      // error already shown by mutation's onError toast
    }
  }

  const handleDelete = (product) => {
    if (window.confirm(`Eliminar ${product.name}?`)) {
      mutateDelete.mutate(product.id)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const rows = await importFromXlsx(file)
      const toCreate = rows.filter(r => r.name && r.sale_price).map(r => ({
        barcode: String(r.barcode || ''),
        name: String(r.name),
        category: String(r.category || 'Otros'),
        unit: String(r.unit || 'unidad'),
        current_stock: parseFloat(r.current_stock) || 0,
        min_stock: parseFloat(r.min_stock) || 0,
        purchase_price: parseFloat(r.purchase_price) || 0,
        sale_price: parseFloat(r.sale_price),
        expiration_date: r.expiration_date || r.Date_vto || null,
        active: true,
        allow_negative_stock: true,
        ...(storeId ? { store_id: storeId } : {}),
      }))
    if (!toCreate.length) { toast.error('No se encontraron filas válidas'); return }
    const { error } = await supabase.from('products').upsert(toCreate, { onConflict: 'store_id,barcode' })
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['products'] })
    toast.success(`${toCreate.length} productos importados / actualizados`)
  } catch (err) {
    toast.error('Error al importar: ' + err.message)
  } finally {
      event.target.value = ''
    }
  }

  const handleExport = () => {
    const mapped = products.map(p => ({ ...p, active: p.active ? 'Sí' : 'No' }))
    const date = new Date().toISOString().split('T')[0]
    exportToXlsx(mapped, PRODUCT_COLUMNS, `productos_${date}`, 'Productos', {
      title: 'Glivac — Productos',
      subtitle: `Exportado el ${date}`,
    })
  }

  useEffect(() => {
    const refresh = () => setPromotions(loadPromotions())
    const storageHandler = (event) => {
      if (event.key === 'glivac-demo-promotions') refresh()
    }
    window.addEventListener('glivac-demo-promotions', refresh)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('glivac-demo-promotions', refresh)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  const handleExportTemplate = () => {
    exportToXlsx([
      {
        barcode: '123456',
        name: 'Ejemplo de producto',
        category: 'Fiambres',
        unit: 'unidad',
        current_stock: 10,
        min_stock: 2,
        purchase_price: 100,
        sale_price: 180,
        active: 'Sí',
      },
    ], PRODUCT_COLUMNS, 'plantilla_productos', 'Productos', {
      title: 'Plantilla de importación',
      subtitle: 'Llená la tabla y exportála como XLSX',
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Productos</p>
          <h1 className="text-3xl font-bold">Gestión de inventario</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportTemplate}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold"
          >
            Plantilla Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold"
          >
            Importar Excel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-semibold"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => guard(() => openModal())}
            className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold"
          >
            Nuevo producto
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código"
          className="flex-1 border border-gray-200 rounded-full px-4 py-2"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-56 border border-gray-200 rounded-full px-4 py-2"
        >
          <option value="">Todas las categorías</option>
          {[...new Set(products.map(p => p.category))].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={selectedStoreId || ''}
            onChange={e => setSelectedStoreId(e.target.value || null)}
            className="w-48 border border-gray-200 rounded-full px-4 py-2"
          >
            <option value="">Todos los negocios</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {promotionsWithDetails.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {promotionsWithDetails.map(promo => (
            <div key={promo.id} className="bg-zinc-50 border border-blue-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-blue-500">Promoción sugerida</p>
              <p className="text-lg font-semibold text-zinc-900">{promo.name}</p>
              <p className="text-sm text-blue-700">{promo.description}</p>
              <div className="flex flex-wrap gap-2">
                {promo.items.map(item => (
                  <span key={item.id} className="px-3 py-1 rounded-full border border-blue-200 bg-white text-xs font-semibold text-blue-600">{item.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-zinc-400 border-b border-zinc-100">
                {[
                  { label: 'Producto',  col: 'name' },
                  { label: 'Categoría', col: 'category' },
                  { label: 'Stock',     col: 'current_stock' },
                  { label: 'P.Compra', col: 'purchase_price' },
                  { label: 'P.Venta',  col: 'sale_price' },
                  { label: 'Vence',    col: 'expiration_date' },
                  { label: 'Margen',   col: 'margin' },
                  { label: 'Estado',   col: 'active' },
                ].map(({ label, col }) => (
                  <th key={col} className="px-4 py-3 cursor-pointer select-none hover:text-zinc-600 transition-colors" onClick={() => handleSort(col)}>
                    {label}<SortIcon col={col} />
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => {
              const margin = product.sale_price
                ? ((product.sale_price - (product.purchase_price || 0)) / product.sale_price) * 100
                : 0
              return (
                <tr key={product.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.barcode || 'Sin código'}</p>
                  </td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.current_stock <= product.min_stock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {product.current_stock} / {product.min_stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">{fmtMoney(product.purchase_price || 0)}</td>
                  <td className="px-4 py-3">{fmtMoney(product.sale_price || 0)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const days = daysUntil(product.expiration_date)
                      const label = formatExpiry(product.expiration_date)
                      const tone = days === null ? 'text-gray-500' : days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-emerald-700'
                      return (
                        <span className={`text-xs font-semibold ${tone}`}>
                          {label} {days !== null ? `(${days < 0 ? 'vencido' : `en ${days}d`})` : ''}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">{margin.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                      {product.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openModal(product)} className="text-blue-600 hover:text-zinc-900">
                      <PencilLine className="inline w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(product)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="inline w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {!filteredProducts.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  {isLoading ? 'Cargando productos...' : 'No se encontraron productos.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" className="hidden" />

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-semibold">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h2>
            {isAdmin && !editingProduct && !selectedStoreId && (
              <label className="space-y-1 text-xs text-gray-500">
                Negocio *
                <select
                  value={form.store_id || ''}
                  onChange={e => setForm(prev => ({ ...prev, store_id: e.target.value || undefined }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Seleccioná un negocio</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-600 block">Código *</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
                  placeholder="Ej: 7790310985113"
                  required
                />
                {submitted && !form.barcode?.trim() && (
                  <p className="text-xs text-red-500">Campo obligatorio</p>
                )}
              </div>
              <label className="space-y-1 text-xs text-gray-500">
                Nombre
                <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-500">
                Categoría
                <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-gray-500">
                Unidad
                <select value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                  {UNITS.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-500">
                Stock actual
                <input type="number" value={form.current_stock} onChange={e => setForm(prev => ({ ...prev, current_stock: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </label>
              <label className="space-y-1 text-xs text-gray-500">
                Stock mínimo
                <input type="number" value={form.min_stock} onChange={e => setForm(prev => ({ ...prev, min_stock: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-500">
                Precio compra
                <input
                  type="number" min="0" step="0.01"
                  value={form.purchase_price}
                  onChange={e => {
                    const cost = parseFloat(e.target.value) || 0
                    setForm(prev => {
                      const markup = parseFloat(prev.markup_pct) || 0
                      const newSale = markup > 0 ? +(cost * (1 + markup / 100)).toFixed(2) : prev.sale_price
                      return { ...prev, purchase_price: e.target.value, sale_price: markup > 0 ? newSale : prev.sale_price }
                    })
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-xs text-gray-500">
                % Margen sobre costo
                <input
                  type="number" min="0" max="999" step="0.1" placeholder="ej: 40"
                  value={form.markup_pct ?? ''}
                  onChange={e => {
                    const pct = parseFloat(e.target.value) || 0
                    setForm(prev => {
                      const cost = parseFloat(prev.purchase_price) || 0
                      const newSale = cost > 0 && pct > 0 ? +(cost * (1 + pct / 100)).toFixed(2) : prev.sale_price
                      return { ...prev, markup_pct: e.target.value, sale_price: newSale }
                    })
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-500">
                Precio venta
                <input
                  type="number" min="0" step="0.01"
                  value={form.sale_price}
                  onChange={e => {
                    const sale = parseFloat(e.target.value) || 0
                    setForm(prev => {
                      const cost = parseFloat(prev.purchase_price) || 0
                      const pct = cost > 0 && sale > cost ? +((sale / cost - 1) * 100).toFixed(1) : prev.markup_pct
                      return { ...prev, sale_price: e.target.value, markup_pct: pct }
                    })
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  required
                />
              </label>
              <div className="space-y-1 text-xs text-gray-500">
                Margen calculado
                <div className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700">
                  {(() => {
                    const cost = parseFloat(form.purchase_price) || 0
                    const sale = parseFloat(form.sale_price) || 0
                    if (!cost || !sale || sale <= cost) return '—'
                    return `+${((sale / cost - 1) * 100).toFixed(1)}% sobre costo`
                  })()}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-gray-500">
                Fecha de vencimiento
                <input type="date" value={form.expiration_date} onChange={e => setForm(prev => ({ ...prev, expiration_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </label>
              <div />
            </div>
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))} />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allow_negative_stock} onChange={e => setForm(prev => ({ ...prev, allow_negative_stock: e.target.checked }))} />
                Permitir stock negativo
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-full text-sm font-semibold">
                Cancelar
              </button>
              <button type="submit" disabled={mutateCreate.isPending || mutateUpdate.isPending} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold disabled:opacity-50">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
      {PickerModal}
    </div>
  )
}
