import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fmtMoney, formatDateTimeART } from '@/components/argentina'
import { useReportsData } from '@/hooks/useReportsData'
import { addPromotion } from '@/lib/promotions'
import { useAuth } from '@/hooks/useAuth'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const PAYMENT_COLORS = { efectivo: '#34c759', transferencia: '#007AFF', qr: '#af52de', tarjeta: '#ff9500', fiado: '#ff3b30' }
const PIE_COLORS = ['#007AFF','#34c759','#af52de','#ff9500','#ff3b30','#5ac8fa','#ffcc00']

// ── Animated Number ───────────────────────────────────────────────
function AnimatedNumber({ value, format = v => v }) {
  const [display, setDisplay] = useState(value)
  const ref = useRef(value)
  useEffect(() => {
    const from = ref.current, to = value
    if (from === to) return
    const steps = 24; let i = 0
    const id = setInterval(() => {
      i++
      setDisplay(from + (to - from) * (i / steps))
      if (i >= steps) { clearInterval(id); ref.current = to }
    }, 16)
    return () => clearInterval(id)
  }, [value])
  return <span>{format(display)}</span>
}

// ── Segmented Control ────────────────────────────────────────────
function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="relative flex bg-black/5 rounded-[10px] p-0.5 gap-0.5">
      {options.map(opt => {
        const isActive = value === opt.value
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className="relative px-4 py-1.5 text-sm font-medium rounded-[8px] transition-colors z-10">
            {isActive && (
              <motion.div layoutId={`seg-${options.map(o=>o.value).join('')}`}
                className="absolute inset-0 bg-white rounded-[8px] shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
            )}
            <span className={`relative z-10 transition-colors ${isActive ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────
function Widget({ children, className = '' }) {
  return <div className={`bg-white border border-black/5 rounded-2xl ${className}`}>{children}</div>
}

// ── Section label ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-[#86868b] uppercase tracking-[0.2em] mb-4">{children}</p>
}

// ── Apple Tooltip ─────────────────────────────────────────────────
function AppleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-xl border border-black/8 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="text-[#86868b] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.stroke }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtMoney(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const now = new Date()
  const todayART = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { user, isAdmin, storeId } = useAuth()

  const [storeFilter, setStoreFilter] = useState('all')
  const [stores, setStores] = useState([])
  const [periodMode, setPeriodMode] = useState('month')
  const [customYear, setCustomYear] = useState(now.getFullYear())
  const [customMonth, setCustomMonth] = useState(now.getMonth())
  const [customDate, setCustomDate] = useState(todayART)
  const [periodConfig, setPeriodConfig] = useState({ type: 'month', year: now.getFullYear(), month: now.getMonth() })
  const [insights, setInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const insightsRef = useRef(null)
  const [purchaseInsights, setPurchaseInsights] = useState(null)
  const [loadingPurchaseInsights, setLoadingPurchaseInsights] = useState(false)
  const purchaseInsightsRef = useRef(null)
  const [salesPriceInsights, setSalesPriceInsights] = useState(null)
  const [loadingSalesPriceInsights, setLoadingSalesPriceInsights] = useState(false)
  const salesPriceInsightsRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('stores').select('id, name, type').eq('active', true)
      .then(({ data }) => { if (data) setStores(data) })
  }, [isAdmin])

  const activeStoreId = isAdmin ? (storeFilter === 'all' ? null : storeFilter) : storeId

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(2000)
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('expenses').select('*').order('date', { ascending: false }).limit(2000)
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('products').select('*')
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })
  const { data: shiftLogs = [] } = useQuery({
    queryKey: ['shift_logs', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('shift_logs').select('*').order('created_at', { ascending: false }).limit(300)
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('purchases').select('*').order('created_at', { ascending: false }).limit(500)
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets_report', activeStoreId],
    queryFn: async () => {
      let q = supabase.from('budgets').select('*, clients(full_name)').order('created_at', { ascending: false }).limit(1000)
      if (activeStoreId) q = q.eq('store_id', activeStoreId)
      const { data } = await q; return data || []
    },
    enabled: !!user,
  })

  const { data: orphanCounts } = useQuery({
    queryKey: ['orphan_counts'],
    queryFn: async () => {
      const [p, s, c] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).is('store_id', null),
        supabase.from('sales').select('id', { count: 'exact', head: true }).is('store_id', null),
        supabase.from('purchases').select('id', { count: 'exact', head: true }).is('store_id', null),
      ])
      return { products: p.count || 0, sales: s.count || 0, purchases: c.count || 0 }
    },
    enabled: !!user && isAdmin,
    staleTime: 1000 * 60 * 5,
  })

  const data = useReportsData(sales, expenses, products, periodConfig)

  useEffect(() => {
    if (periodMode === 'custom') setPeriodConfig({ type: 'month', year: customYear, month: customMonth })
  }, [customYear, customMonth, periodMode])

  useEffect(() => {
    if (periodMode === 'day') setPeriodConfig({ type: 'day', date: customDate })
  }, [customDate, periodMode])

  const handleModeChange = (mode) => {
    setPeriodMode(mode)
    if (mode === 'week') setPeriodConfig({ type: 'week' })
    else if (mode === 'month') setPeriodConfig({ type: 'month', year: now.getFullYear(), month: now.getMonth() })
    else if (mode === 'day') setPeriodConfig({ type: 'day', date: customDate })
    else setPeriodConfig({ type: 'month', year: customYear, month: customMonth })
  }

  const {
    totalRevenue, prevRevenue, sameLastYear, totalExpenses, totalProfit,
    netProfit, projected, daysInMonth, daysElapsed, dailyAvg,
    avgTicket, bestDay, breakEvenUnits,
    dailyChart, byDayOfWeek, hourlyChart, paymentChart, expPieChart,
    rotacion, canasta, criticalStock, cajeroStats, tips,
  } = data

  const revDelta = prevRevenue === 0 ? 0 : Math.round((totalRevenue - prevRevenue) / prevRevenue * 100)
  const yearDelta = sameLastYear === 0 ? 0 : Math.round((totalRevenue - sameLastYear) / sameLastYear * 100)
  const marginPct = totalRevenue ? Math.round(totalProfit / totalRevenue * 100) : 0
  const maxRotation = rotacion[0]?.totalUnits || 1
  const maxDow = Math.max(...byDayOfWeek.map(d => d.Ventas), 1)
  const bestDow = byDayOfWeek.reduce((b, d) => d.Ventas > (b?.Ventas || 0) ? d : b, null)

  // Anomalías
  const anomalies = useMemo(() => {
    const list = []
    if (totalRevenue > 0 && totalExpenses === 0)
      list.push({ icon: '◈', title: 'Inconsistencia de datos', label: 'Se detectaron ingresos pero el registro de egresos está vacío. Esto afecta el cálculo de utilidad neta.' })
    if (totalRevenue > 0 && totalExpenses > totalRevenue * 0.8)
      list.push({ icon: '◆', title: 'Margen crítico', label: `Los gastos representan el ${Math.round(totalExpenses / totalRevenue * 100)}% de los ingresos. El margen neto está bajo el umbral recomendado del 20%.` })
    if (prevRevenue > 0 && totalRevenue < prevRevenue * 0.8)
      list.push({ icon: '▲', title: 'Caída de ventas', label: `Las ventas cayeron un ${Math.round((1 - totalRevenue / prevRevenue) * 100)}% respecto al período anterior. Revisar causas antes de que el mes cierre.` })
    if (orphanCounts) {
      const total = (orphanCounts.products || 0) + (orphanCounts.sales || 0) + (orphanCounts.purchases || 0)
      if (total > 0) {
        const parts = []
        if (orphanCounts.products > 0) parts.push(`${orphanCounts.products} producto${orphanCounts.products > 1 ? 's' : ''}`)
        if (orphanCounts.sales > 0) parts.push(`${orphanCounts.sales} venta${orphanCounts.sales > 1 ? 's' : ''}`)
        if (orphanCounts.purchases > 0) parts.push(`${orphanCounts.purchases} compra${orphanCounts.purchases > 1 ? 's' : ''}`)
        list.push({ icon: '⚠', title: 'Registros sin negocio asignado', label: `${parts.join(', ')} sin negocio asignado. No son visibles para los empleados y pueden causar inconsistencias en los datos.` })
      }
    }
    return list
  }, [totalRevenue, totalExpenses, prevRevenue, orphanCounts])

  const shiftsInPeriod = useMemo(() => {
    if (!shiftLogs.length) return []
    const { periodStart, periodEnd } = (() => {
      if (periodConfig.type === 'day') {
        const [y, m, d] = periodConfig.date.split('-').map(Number)
        return { periodStart: new Date(Date.UTC(y, m - 1, d, 3, 0, 0)), periodEnd: new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59)) }
      }
      if (periodConfig.type === 'month') {
        const y = periodConfig.year, m = periodConfig.month
        return { periodStart: new Date(Date.UTC(y, m, 1, 3, 0, 0)), periodEnd: new Date(Date.UTC(y, m + 1, 0, 26, 59, 59)) }
      }
      const now2 = new Date(), d = new Date(now2), day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0)
      return { periodStart: d, periodEnd: now2 }
    })()
    return shiftLogs.filter(s => { const d = new Date(s.created_at); return d >= periodStart && d <= periodEnd })
  }, [shiftLogs, periodConfig])

  const budgetStats = useMemo(() => {
    const total = budgets.length
    const concretados = budgets.filter(b => b.status === 'approved' || b.posted_to_account)
    const pendientes = budgets.filter(b => !b.posted_to_account && b.status !== 'approved' && b.status !== 'rejected' && b.status !== 'expired')
    const totalMonto = budgets.reduce((s, b) => s + (b.subtotal || 0), 0)
    const montoConcretado = concretados.reduce((s, b) => s + (b.subtotal || 0), 0)
    const conversionRate = total > 0 ? Math.round(concretados.length / total * 100) : 0

    const byClient = new Map()
    budgets.forEach(b => {
      const name = b.clients?.full_name || 'Sin nombre'
      if (!byClient.has(name)) byClient.set(name, { name, total: 0, concretados: 0, monto: 0, montoConcretado: 0 })
      const entry = byClient.get(name)
      entry.total++
      entry.monto += b.subtotal || 0
      if (b.status === 'approved' || b.posted_to_account) {
        entry.concretados++
        entry.montoConcretado += b.subtotal || 0
      }
    })

    const clientList = [...byClient.values()].sort((a, b) => b.monto - a.monto)

    return { total, concretados: concretados.length, pendientes: pendientes.length, totalMonto, montoConcretado, conversionRate, clientList }
  }, [budgets])

  const topRotation = rotacion[0]
  const criticalProduct = criticalStock[0]
  const suggestedPromotion = useMemo(() => {
    if (!topRotation || !criticalProduct) return null
    return {
      name: `Combo: ${topRotation.product_name} + ${criticalProduct.name}`,
      description: `${topRotation.product_name} lidera ventas. ${criticalProduct.name} está crítico en stock.`,
      productIds: [topRotation.product_id, criticalProduct.id].filter(Boolean),
      productNames: [topRotation.product_name, criticalProduct.name],
    }
  }, [topRotation, criticalProduct])

  // Aggregate purchase items: unique products with avg price and purchase count
  const purchaseSummary = useMemo(() => {
    const map = new Map()
    purchases.forEach(p => {
      ;(p.items || []).forEach(item => {
        if (!item.product_name || !item.purchase_price) return
        const key = item.product_name.toLowerCase().trim()
        if (!map.has(key)) map.set(key, { name: item.product_name, prices: [], sale_price: 0, count: 0 })
        const entry = map.get(key)
        entry.prices.push(item.purchase_price)
        entry.count += item.quantity || 1
        if (item.sale_price) entry.sale_price = item.sale_price
      })
    })
    return [...map.values()]
      .map(e => ({
        name: e.name,
        avg_purchase_price: Math.round(e.prices.reduce((s, v) => s + v, 0) / e.prices.length),
        sale_price: e.sale_price,
        purchases_count: e.prices.length,
      }))
      .filter(e => e.avg_purchase_price > 0)
      .sort((a, b) => b.purchases_count - a.purchases_count)
      .slice(0, 25)
  }, [purchases])

  const handleAnalyzePurchases = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_AI_STUDIO_API_KEY
    if (!apiKey) { toast.error('Configurá VITE_GOOGLE_AI_STUDIO_API_KEY en Vercel'); return }
    if (!purchaseSummary.length) { toast.error('No hay datos de compras para analizar'); return }
    setLoadingPurchaseInsights(true)
    setPurchaseInsights(null)
    try {
      const productList = purchaseSummary
        .map(p => `- ${p.name}: compra ARS ${p.avg_purchase_price}${p.sale_price ? `, venta ARS ${p.sale_price}` : ''}`)
        .join('\n')

      const prompt = `Sos un experto en compras mayoristas de Argentina para comercios minoristas. Analizá los siguientes productos con sus precios de compra (en pesos argentinos ARS):

${productList}

Evaluá si cada precio de compra es competitivo para el mercado mayorista argentino actual.
Respondé ÚNICAMENTE con este JSON exacto (sin markdown, sin texto extra):
{"resumen":"2 oraciones directas sobre cómo están comprando en general","productos":[{"nombre":"nombre exacto","precio_compra":0,"evaluacion":"justo","comentario":"observación breve máximo 12 palabras"}]}

Valores posibles para evaluacion: "justo" (precio razonable para el mayorista), "caro" (hay alternativas más baratas), "muy_caro" (precio significativamente alto).
Incluí TODOS los productos de la lista.`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
      const parts = json.candidates?.[0]?.content?.parts || []
      const text = parts.map(p => p.text || '').join('')
      const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
      const start = stripped.indexOf('{'), end = stripped.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error(`Respuesta inesperada: ${text.slice(0, 100)}`)
      const parsed = JSON.parse(stripped.slice(start, end + 1))
      parsed.productos = (parsed.productos || []).map(p => ({
        ...p,
        link_ml: `https://www.mercadolibre.com.ar/search?q=${encodeURIComponent(p.nombre + ' mayorista')}`,
        link_google: `https://www.google.com.ar/search?q=${encodeURIComponent(p.nombre + ' precio mayorista argentina')}`,
      }))
      setPurchaseInsights(parsed)
      setTimeout(() => purchaseInsightsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error(err)
      toast.error(`Error IA: ${err.message}`)
    } finally {
      setLoadingPurchaseInsights(false)
    }
  }

  // Combine rotation data with product prices for sales price analysis
  const salesPriceSummary = useMemo(() => {
    return rotacion
      .map(r => {
        const prod = products.find(p => p.id === r.product_id || p.name === r.product_name)
        if (!prod?.sale_price) return null
        const margin = prod.purchase_price
          ? Math.round((prod.sale_price - prod.purchase_price) / prod.sale_price * 100)
          : null
        return {
          name: r.product_name,
          sale_price: prod.sale_price,
          purchase_price: prod.purchase_price || null,
          margin,
          units: r.totalUnits,
          category: prod.category || '',
        }
      })
      .filter(Boolean)
      .slice(0, 25)
  }, [rotacion, products])

  const handleAnalyzeSalesPrices = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_AI_STUDIO_API_KEY
    if (!apiKey) { toast.error('Configurá VITE_GOOGLE_AI_STUDIO_API_KEY en Vercel'); return }
    if (!salesPriceSummary.length) { toast.error('No hay ventas en el período seleccionado'); return }
    setLoadingSalesPriceInsights(true)
    setSalesPriceInsights(null)
    try {
      const productList = salesPriceSummary
        .map(p =>
          `- ${p.name}: venta ARS ${p.sale_price}${p.purchase_price ? `, compra ARS ${p.purchase_price}, margen ${p.margin}%` : ''}, vendidas ${p.units} uds`
        )
        .join('\n')

      const prompt = `Sos un experto en precios para comercios minoristas de Argentina. Analizá los siguientes productos con sus precios de venta actuales (en pesos argentinos ARS):

${productList}

Para cada producto evaluá si el precio de venta es adecuado para el mercado minorista argentino actual.
Respondé ÚNICAMENTE con este JSON exacto (sin markdown, sin texto extra):
{"resumen":"2 oraciones directas sobre la estrategia de precios general","productos":[{"nombre":"nombre exacto","precio_venta":0,"evaluacion":"optimo","comentario":"observación breve máximo 12 palabras"}]}

Valores posibles para evaluacion:
- "optimo": precio competitivo y margen saludable
- "bajo": podrías subir el precio sin perder clientes (dejás plata en la mesa)
- "alto": podría estar espantando clientes, considerar bajar

Incluí TODOS los productos. Sé directo y específico.`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
      const parts = json.candidates?.[0]?.content?.parts || []
      const text = parts.map(p => p.text || '').join('')
      const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
      const start = stripped.indexOf('{'), end = stripped.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error(`Respuesta inesperada: ${text.slice(0, 100)}`)
      const parsed = JSON.parse(stripped.slice(start, end + 1))
      parsed.productos = (parsed.productos || []).map(p => ({
        ...p,
        link_google: `https://www.google.com.ar/search?q=${encodeURIComponent(p.nombre + ' precio argentina')}`,
      }))
      setSalesPriceInsights(parsed)
      setTimeout(() => salesPriceInsightsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error(err)
      toast.error(`Error IA: ${err.message}`)
    } finally {
      setLoadingSalesPriceInsights(false)
    }
  }

  const handleGenerateInsights = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_AI_STUDIO_API_KEY
    if (!apiKey) { toast.error('Configurá VITE_GOOGLE_AI_STUDIO_API_KEY en Vercel'); return }
    setLoadingInsights(true); setInsights(null)
    try {
      const periodLabel = periodMode === 'week' ? 'esta semana' : `${MONTHS[customMonth]} ${customYear}`
      const prompt = `Sos un asesor financiero y de negocios experto en comercios minoristas de Argentina. Todos los valores son en pesos argentinos (ARS).

Datos del período "${periodLabel}":
- Ingresos: ARS ${Math.round(totalRevenue)} (${revDelta >= 0 ? '+' : ''}${revDelta}% vs período anterior, ${yearDelta >= 0 ? '+' : ''}${yearDelta}% vs mismo mes año pasado)
- Ganancia bruta: ARS ${Math.round(totalProfit)} (margen ${marginPct}%)
- Gastos: ARS ${Math.round(totalExpenses)}
- Utilidad neta: ARS ${Math.round(netProfit)}
- Ticket promedio: ARS ${Math.round(avgTicket)}
- Proyección mensual: ARS ${Math.round(projected)} (día ${daysElapsed}/${daysInMonth})
- Promedio diario: ARS ${Math.round(dailyAvg)}
- Mejor día de la semana: ${bestDow?.day || 'N/A'} (ARS ${Math.round(bestDow?.Ventas || 0)})
- Métodos de pago: ${paymentChart.map(p => `${p.name}: ARS ${p.value} (${p.count} ops)`).join(', ') || 'sin datos'}
- Top 5 vendidos: ${rotacion.slice(0,5).map(p => `${p.product_name} (${p.totalUnits} uds)`).join(', ') || 'sin datos'}
- Productos críticos (<14 días stock): ${criticalStock.slice(0,5).map(p => p.name).join(', ') || 'ninguno'}
- Cajeros: ${cajeroStats.map(c => `${c.name}: ${c.count} ventas ARS ${Math.round(c.total)}`).join(' | ') || 'sin datos'}
- Turnos del período: ${shiftsInPeriod.length}

Respondé ÚNICAMENTE con este JSON exacto (sin markdown, sin texto extra):
{"diagnostico":"2-3 oraciones directas sobre la salud financiera del período","alerta":"La alerta más urgente si existe, o null si todo está bien","oportunidad":"La mayor oportunidad de crecimiento detectada en los datos","accion_semana":"1 acción concreta y específica a ejecutar esta semana","prediccion":"Proyección inteligente para el próximo período basada en tendencias"}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`)
      const parts = json.candidates?.[0]?.content?.parts || []
      const text = parts.map(p => p.text || '').join('')
      const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
      const start = stripped.indexOf('{'), end = stripped.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error(`Respuesta inesperada: ${text.slice(0,150)}`)
      setInsights(JSON.parse(stripped.slice(start, end + 1)))
      setTimeout(() => insightsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error(err)
      toast.error(`Error IA: ${err.message}`)
    } finally {
      setLoadingInsights(false)
    }
  }

  const handleCreatePromotion = () => {
    if (!suggestedPromotion?.productIds?.length) { toast.error('Sin datos suficientes'); return }
    if (addPromotion(suggestedPromotion)) toast.success('Promoción creada')
    else toast.error('Ya existe')
  }

  const storeOptions = [{ value: 'all', label: 'Global' }, ...stores.map(s => ({ value: s.id, label: s.name }))]
  const PERIOD_OPTIONS = [{ value: 'day', label: 'Día' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }, { value: 'custom', label: 'Personalizado' }]

  return (
    <div className="space-y-4 pb-16">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-2">
        <div>
          <p className="text-xs text-[#86868b] uppercase tracking-[0.2em]">Asesor financiero</p>
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">Inteligencia de negocio</h1>
        </div>
        <div className="flex flex-col gap-2 items-start md:items-end">
          {isAdmin && stores.length > 0 && (
            <SegmentedControl options={storeOptions} value={storeFilter} onChange={setStoreFilter} />
          )}
          <SegmentedControl options={PERIOD_OPTIONS} value={periodMode} onChange={handleModeChange} />
          {periodMode === 'day' && (
            <input
              type="date"
              value={customDate}
              max={todayART}
              onChange={e => setCustomDate(e.target.value)}
              className="bg-white border border-black/10 rounded-xl px-3 py-1.5 text-sm text-[#1d1d1f] focus:outline-none"
            />
          )}
          {periodMode === 'custom' && (
            <div className="flex gap-2">
              <select value={customYear} onChange={e => setCustomYear(Number(e.target.value))}
                className="bg-white border border-black/10 rounded-xl px-3 py-1.5 text-sm text-[#1d1d1f] focus:outline-none">
                {[now.getFullYear(), now.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={customMonth} onChange={e => setCustomMonth(Number(e.target.value))}
                className="bg-white border border-black/10 rounded-xl px-3 py-1.5 text-sm text-[#1d1d1f] focus:outline-none">
                {MONTHS.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── AVISOS ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {anomalies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Widget className="p-5 space-y-3">
              <SectionLabel>Avisos del sistema</SectionLabel>
              {anomalies.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 text-amber-500 text-sm">{a.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{a.title}</p>
                    <p className="text-sm text-[#86868b] leading-relaxed">{a.label}</p>
                  </div>
                </div>
              ))}
            </Widget>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPIs FILA 1 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Ingresos netos</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            <AnimatedNumber value={totalRevenue} format={v => fmtMoney(Math.round(v))} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">{sales.length} ventas</p>
          {prevRevenue > 0 && (
            <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${revDelta >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              {revDelta >= 0 ? '↑' : '↓'} {Math.abs(revDelta)}% vs anterior
            </span>
          )}
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Gastos del período</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            <AnimatedNumber value={totalExpenses} format={v => fmtMoney(Math.round(v))} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">{expenses.length} registros</p>
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Margen de rentabilidad</p>
          <p className={`text-2xl font-semibold tracking-tight ${marginPct >= 20 ? 'text-[#34c759]' : marginPct >= 10 ? 'text-amber-500' : 'text-[#ff3b30]'}`}>
            <AnimatedNumber value={marginPct} format={v => `${Math.round(v)}%`} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">Ganancia: {fmtMoney(totalProfit)}</p>
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Utilidad neta</p>
          <p className={`text-2xl font-semibold tracking-tight ${netProfit >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
            <AnimatedNumber value={netProfit} format={v => fmtMoney(Math.round(v))} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">{netProfit >= 0 ? 'Positiva ✓' : 'Negativa — revisar gastos'}</p>
        </Widget>
      </div>

      {/* ── KPIs FILA 2 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Ticket promedio</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            <AnimatedNumber value={avgTicket} format={v => fmtMoney(Math.round(v))} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">por venta</p>
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Promedio diario</p>
          <p className="text-2xl font-semibold text-[#007AFF] tracking-tight">
            <AnimatedNumber value={dailyAvg} format={v => fmtMoney(Math.round(v))} />
          </p>
          <p className="text-xs text-[#86868b] mt-1">Día {daysElapsed} de {daysInMonth}</p>
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Proyección mensual</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            <AnimatedNumber value={projected} format={v => fmtMoney(Math.round(v))} />
          </p>
          <div className="mt-2 h-1 bg-black/5 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-[#007AFF]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round(daysElapsed / daysInMonth * 100))}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>
        </Widget>
        <Widget className="p-5">
          <p className="text-xs text-[#86868b] font-medium mb-2">Mejor día</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">{bestDow?.day || '—'}</p>
          <p className="text-xs text-[#86868b] mt-1">{bestDow ? fmtMoney(bestDow.Ventas) + ' en prom.' : 'Sin datos'}</p>
        </Widget>
      </div>

      {/* ── GRÁFICO VENTAS + MÉTODO DE PAGO ─────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Widget className="lg:col-span-2 p-5">
          <SectionLabel>Evolución de ventas y ganancias</SectionLabel>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGanancias" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34c759" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#34c759" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<AppleTooltip />} />
                <Area type="monotone" dataKey="Ventas" stroke="#007AFF" strokeWidth={1.5} fill="url(#gVentas)" dot={false} />
                <Area type="monotone" dataKey="Ganancias" stroke="#34c759" strokeWidth={1.5} fill="url(#gGanancias)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Comparativa rápida */}
          <div className="mt-4 pt-4 border-t border-black/5 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-[#86868b]">Este período</p>
              <p className="text-sm font-semibold text-[#1d1d1f]">{fmtMoney(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-[#86868b]">Período anterior</p>
              <p className="text-sm font-semibold text-[#1d1d1f]">{fmtMoney(prevRevenue)}</p>
              {prevRevenue > 0 && (
                <span className={`text-xs font-semibold ${revDelta >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {revDelta >= 0 ? '↑' : '↓'}{Math.abs(revDelta)}%
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-[#86868b]">Mismo mes año ant.</p>
              <p className="text-sm font-semibold text-[#1d1d1f]">{fmtMoney(sameLastYear)}</p>
              {sameLastYear > 0 && (
                <span className={`text-xs font-semibold ${yearDelta >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {yearDelta >= 0 ? '↑' : '↓'}{Math.abs(yearDelta)}%
                </span>
              )}
            </div>
          </div>
        </Widget>

        {/* Métodos de pago */}
        <Widget className="p-5">
          <SectionLabel>Métodos de pago</SectionLabel>
          {paymentChart.length === 0 ? (
            <p className="text-sm text-[#86868b]">Sin datos</p>
          ) : (
            <>
              <div className="h-32 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentChart} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                      {paymentChart.map((entry, i) => (
                        <Cell key={i} fill={PAYMENT_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<AppleTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {paymentChart.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PAYMENT_COLORS[p.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                      <p className="text-xs text-[#1d1d1f] capitalize">{p.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{fmtMoney(p.value)}</p>
                      <p className="text-[10px] text-[#86868b]">{p.count} ops</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Widget>
      </div>

      {/* ── DÍA DE LA SEMANA + HORARIO ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget className="p-5">
          <SectionLabel>Ventas por día de la semana</SectionLabel>
          <div className="space-y-3">
            {byDayOfWeek.map(d => (
              <div key={d.day}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-sm font-medium ${d.day === bestDow?.day ? 'text-[#007AFF]' : 'text-[#1d1d1f]'}`}>{d.day}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-[#86868b]">{d.tickets} tickets</p>
                    <p className="text-xs font-semibold text-[#1d1d1f]">{fmtMoney(d.Ventas)}</p>
                  </div>
                </div>
                <div className="h-[3px] bg-black/5 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${d.day === bestDow?.day ? 'bg-[#007AFF]' : 'bg-black/15'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(d.Ventas / maxDow * 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Widget>

        <Widget className="p-5">
          <SectionLabel>Ventas por hora del día</SectionLabel>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={6}>
                <Tooltip content={<AppleTooltip />} />
                <Bar dataKey="Ventas" fill="#007AFF" radius={[3, 3, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[#86868b] mt-2 text-center">Hora del día (horario ART)</p>
        </Widget>
      </div>

      {/* ── ROTACIÓN + CANASTA ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget className="p-5">
          <SectionLabel>Rotación de productos</SectionLabel>
          {rotacion.length === 0 ? (
            <p className="text-sm text-[#86868b]">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {rotacion.map((item, i) => (
                <div key={item.product_name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-[#007AFF]' : 'text-[#86868b]'}`}>{i + 1}</span>
                      <p className="text-sm font-medium text-[#1d1d1f]">{item.product_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{item.totalUnits} uds</p>
                      <p className="text-[10px] text-[#86868b]">{item.ticketCount} tickets</p>
                    </div>
                  </div>
                  <div className="h-[2px] bg-black/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${i === 0 ? 'bg-[#007AFF]' : 'bg-black/20'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(item.totalUnits / maxRotation * 100)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Widget>

        <Widget className="p-5">
          <SectionLabel>Canasta de compra — productos que se venden juntos</SectionLabel>
          {canasta.length === 0 ? (
            <p className="text-sm text-[#86868b]">No hay suficientes datos de co-ventas aún.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {canasta.map((entry, i) => (
                <div key={entry.pair} className="flex items-center justify-between py-2.5">
                  <p className="text-sm text-[#1d1d1f]">{entry.pair}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f0f7ff] text-[#007AFF]">{entry.count}×</span>
                </div>
              ))}
            </div>
          )}
          {canasta.length > 0 && (
            <p className="text-xs text-[#86868b] mt-3 pt-3 border-t border-black/5">
              Estos pares son oportunidades para armar combos o posicionar productos juntos en la góndola.
            </p>
          )}
        </Widget>
      </div>

      {/* ── GASTOS POR CATEGORÍA ─────────────────────────────────── */}
      {expPieChart.length > 0 && (
        <Widget className="p-5">
          <SectionLabel>Gastos por categoría</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expPieChart} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                    {expPieChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<AppleTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {expPieChart.map((e, i) => (
                <div key={e.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <p className="text-sm text-[#1d1d1f] capitalize">{e.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1d1d1f]">{fmtMoney(e.value)}</p>
                    <p className="text-[10px] text-[#86868b]">{totalExpenses > 0 ? Math.round(e.value / totalExpenses * 100) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Widget>
      )}

      {/* ── CAJEROS ─────────────────────────────────────────────── */}
      {cajeroStats.length > 0 && (
        <Widget className="p-5">
          <SectionLabel>Rendimiento por cajero</SectionLabel>
          <div className="divide-y divide-black/5">
            {cajeroStats.map((c, i) => (
              <div key={c.name} className="flex items-center gap-4 py-3">
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-[#007AFF] text-white' : 'bg-black/5 text-[#86868b]'}`}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[#1d1d1f]">{c.name}</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{fmtMoney(c.total)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-[2px] bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#007AFF]"
                        style={{ width: `${cajeroStats[0]?.total ? Math.round(c.total / cajeroStats[0].total * 100) : 0}%` }} />
                    </div>
                    <p className="text-xs text-[#86868b] shrink-0">{c.count} ventas · tk. {fmtMoney(Math.round(c.avgTicket))} · {fmtMoney(c.profit)} gan.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Widget>
      )}

      {/* ── PROMOCIÓN SUGERIDA ──────────────────────────────────── */}
      {suggestedPromotion && (
        <Widget className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs text-[#86868b] font-medium uppercase tracking-[0.2em] mb-1">Sugerencia de combo</p>
            <p className="text-sm font-semibold text-[#1d1d1f]">{suggestedPromotion.name}</p>
            <p className="text-sm text-[#86868b]">{suggestedPromotion.description}</p>
          </div>
          <button onClick={handleCreatePromotion}
            className="shrink-0 px-4 py-2 rounded-full bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
            Crear promoción
          </button>
        </Widget>
      )}

      {/* ── TURNOS ──────────────────────────────────────────────── */}
      {shiftsInPeriod.length > 0 && (
        <Widget className="p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Historial de turnos</SectionLabel>
            <span className="text-xs text-[#86868b] -mt-4">{shiftsInPeriod.length} turno{shiftsInPeriod.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#86868b] border-b border-black/5">
                  {['Cajero','Inicio','Fin','Ventas','Recaudado','Efectivo','Digital','Diferencia'].map(h => (
                    <th key={h} className={`pb-2 font-medium ${h === 'Cajero' || h === 'Inicio' || h === 'Fin' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {shiftsInPeriod.map(shift => {
                  const durMin = shift.fin && shift.inicio ? Math.round((new Date(shift.fin) - new Date(shift.inicio)) / 60000) : null
                  const durLabel = durMin !== null ? durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin}m` : '—'
                  return (
                    <tr key={shift.id}>
                      <td className="py-2.5 font-medium text-[#1d1d1f]">
                        {shift.cajero} <span className="text-xs text-[#86868b] font-normal">{durLabel}</span>
                      </td>
                      <td className="py-2.5 text-xs text-[#86868b]">{formatDateTimeART(shift.inicio)}</td>
                      <td className="py-2.5 text-xs text-[#86868b]">{formatDateTimeART(shift.fin)}</td>
                      <td className="py-2.5 text-right">{shift.total_ventas}</td>
                      <td className="py-2.5 text-right font-semibold">{fmtMoney(shift.total_recaudado)}</td>
                      <td className="py-2.5 text-right text-[#34c759]">{fmtMoney(shift.total_efectivo)}</td>
                      <td className="py-2.5 text-right text-[#007AFF]">{fmtMoney(shift.total_digital)}</td>
                      <td className={`py-2.5 text-right font-semibold ${shift.diferencia >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                        {shift.diferencia >= 0 ? '+' : ''}{fmtMoney(shift.diferencia)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Widget>
      )}

      {/* ── ANÁLISIS IA ─────────────────────────────────────────── */}
      <div ref={insightsRef}>
        <Widget className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Asesor financiero IA</SectionLabel>
              <p className="text-xs text-[#86868b] -mt-3">Diagnóstico, alertas y plan de acción · Gemini 2.5</p>
            </div>
            <button onClick={handleGenerateInsights} disabled={loadingInsights}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-50">
              {loadingInsights ? (
                <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>Analizando…</>
              ) : 'Analizar período'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!insights && !loadingInsights && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-6 text-center">
                <p className="text-sm text-[#86868b]">Hacé clic en "Analizar período" para obtener un diagnóstico financiero completo con predicciones y plan de acción.</p>
              </motion.div>
            )}
            {loadingInsights && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-8 text-center">
                <p className="text-sm text-[#86868b] animate-pulse">Analizando datos del período…</p>
              </motion.div>
            )}
            {insights && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 md:grid-cols-2">
                <div className="bg-[#f0f7ff] border border-[#007AFF]/10 rounded-xl p-4 md:col-span-2">
                  <p className="text-xs text-[#007AFF] font-semibold mb-1">Diagnóstico del período</p>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">{insights.diagnostico}</p>
                </div>
                {insights.alerta && (
                  <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4">
                    <p className="text-xs text-amber-600 font-semibold mb-1">Alerta prioritaria</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed">{insights.alerta}</p>
                  </div>
                )}
                {insights.oportunidad && (
                  <div className="bg-[#f0fff4] border border-[#34c759]/15 rounded-xl p-4">
                    <p className="text-xs text-[#34c759] font-semibold mb-1">Mayor oportunidad</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed">{insights.oportunidad}</p>
                  </div>
                )}
                {insights.accion_semana && (
                  <div className="bg-[#f5f0ff] border border-[#af52de]/15 rounded-xl p-4">
                    <p className="text-xs text-[#af52de] font-semibold mb-1">Acción esta semana</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed">{insights.accion_semana}</p>
                  </div>
                )}
                {insights.prediccion && (
                  <div className="bg-black/3 border border-black/5 rounded-xl p-4">
                    <p className="text-xs text-[#86868b] font-semibold mb-1">Predicción próximo período</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed">{insights.prediccion}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Widget>
      </div>

      {/* ── ANÁLISIS DE COMPRAS IA ──────────────────────────────── */}
      <div ref={purchaseInsightsRef}>
        <Widget className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Análisis de compras IA</SectionLabel>
              <p className="text-xs text-[#86868b] -mt-3">¿Estás comprando bien? Precios vs mercado mayorista · Gemini 2.5</p>
            </div>
            <button
              onClick={handleAnalyzePurchases}
              disabled={loadingPurchaseInsights}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#34c759] text-white text-sm font-medium hover:bg-[#2dba50] transition-colors disabled:opacity-50"
            >
              {loadingPurchaseInsights ? (
                <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>Analizando…</>
              ) : 'Analizar compras'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!purchaseInsights && !loadingPurchaseInsights && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-6 text-center">
                <p className="text-sm text-[#86868b]">
                  {purchaseSummary.length === 0
                    ? 'Registrá compras primero para poder analizar los precios.'
                    : `Tenés ${purchaseSummary.length} productos con historial de compras. Hacé clic en "Analizar compras" para ver si estás pagando precios justos.`}
                </p>
              </motion.div>
            )}
            {loadingPurchaseInsights && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-8 text-center">
                <p className="text-sm text-[#86868b] animate-pulse">Comparando precios con el mercado mayorista argentino…</p>
              </motion.div>
            )}
            {purchaseInsights && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#f0fff4] border border-[#34c759]/15 rounded-xl p-4">
                  <p className="text-xs text-[#34c759] font-semibold mb-1">Resumen general</p>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">{purchaseInsights.resumen}</p>
                </div>

                <div className="space-y-2">
                  {(purchaseInsights.productos || []).map((p, i) => {
                    const isCaro = p.evaluacion === 'caro' || p.evaluacion === 'muy_caro'
                    const badgeStyle = p.evaluacion === 'muy_caro'
                      ? 'bg-[#fff2f2] text-[#ff3b30] border border-[#ff3b30]/15'
                      : p.evaluacion === 'caro'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      : 'bg-[#f0fff4] text-[#34c759] border border-[#34c759]/15'
                    const badgeLabel = p.evaluacion === 'muy_caro' ? '🔴 Muy caro' : p.evaluacion === 'caro' ? '🟡 Caro' : '🟢 Justo'
                    return (
                      <div key={i} className={`rounded-xl p-3 ${isCaro ? (p.evaluacion === 'muy_caro' ? 'bg-[#fff8f8]' : 'bg-amber-50/50') : 'bg-black/2'} border border-black/5`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[#1d1d1f]">{p.nombre}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>{badgeLabel}</span>
                            </div>
                            <p className="text-xs text-[#86868b] mt-0.5">{p.comentario}</p>
                          </div>
                          <p className="text-sm font-bold text-[#1d1d1f] shrink-0">{fmtMoney(p.precio_compra)}</p>
                        </div>
                        {isCaro && (
                          <div className="flex gap-2 mt-2.5 flex-wrap">
                            <a
                              href={p.link_ml}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFE600] hover:bg-[#f5dc00] text-[#333] rounded-full text-xs font-semibold transition-colors"
                            >
                              Buscar en MercadoLibre →
                            </a>
                            <a
                              href={p.link_google}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-black/10 hover:bg-black/5 text-[#1d1d1f] rounded-full text-xs font-semibold transition-colors"
                            >
                              Buscar precio en Google →
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Widget>
      </div>

      {/* ── ANÁLISIS DE PRECIOS DE VENTA IA ────────────────────── */}
      <div ref={salesPriceInsightsRef}>
        <Widget className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Análisis de precios de venta IA</SectionLabel>
              <p className="text-xs text-[#86868b] -mt-3">¿Estás cobrando bien? Precios vs mercado minorista · Gemini 2.5</p>
            </div>
            <button
              onClick={handleAnalyzeSalesPrices}
              disabled={loadingSalesPriceInsights}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#af52de] text-white text-sm font-medium hover:bg-[#9b45cc] transition-colors disabled:opacity-50"
            >
              {loadingSalesPriceInsights ? (
                <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>Analizando…</>
              ) : 'Analizar precios'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!salesPriceInsights && !loadingSalesPriceInsights && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-6 text-center">
                <p className="text-sm text-[#86868b]">
                  {salesPriceSummary.length === 0
                    ? 'No hay ventas en el período seleccionado.'
                    : `${salesPriceSummary.length} productos vendidos en el período. Hacé clic en "Analizar precios" para saber si estás cobrando lo correcto.`}
                </p>
              </motion.div>
            )}
            {loadingSalesPriceInsights && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-black/3 rounded-xl p-8 text-center">
                <p className="text-sm text-[#86868b] animate-pulse">Comparando precios con el mercado minorista argentino…</p>
              </motion.div>
            )}
            {salesPriceInsights && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#f5f0ff] border border-[#af52de]/15 rounded-xl p-4">
                  <p className="text-xs text-[#af52de] font-semibold mb-1">Resumen de precios</p>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">{salesPriceInsights.resumen}</p>
                </div>

                <div className="space-y-2">
                  {(salesPriceInsights.productos || []).map((p, i) => {
                    const prod = salesPriceSummary.find(s => s.name === p.nombre)
                    const badgeStyle = p.evaluacion === 'bajo'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      : p.evaluacion === 'alto'
                      ? 'bg-[#fff2f2] text-[#ff3b30] border border-[#ff3b30]/15'
                      : 'bg-[#f0fff4] text-[#34c759] border border-[#34c759]/15'
                    const badgeLabel = p.evaluacion === 'bajo' ? '🟡 Podés subir' : p.evaluacion === 'alto' ? '🔴 Muy alto' : '🟢 Óptimo'
                    return (
                      <div key={i} className={`rounded-xl p-3 border border-black/5 ${p.evaluacion === 'bajo' ? 'bg-amber-50/40' : p.evaluacion === 'alto' ? 'bg-[#fff8f8]' : 'bg-black/2'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[#1d1d1f]">{p.nombre}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>{badgeLabel}</span>
                              {prod?.margin != null && (
                                <span className="text-xs text-[#86868b]">margen {prod.margin}%</span>
                              )}
                            </div>
                            <p className="text-xs text-[#86868b] mt-0.5">{p.comentario}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-[#1d1d1f]">{fmtMoney(p.precio_venta)}</p>
                            {prod?.units && <p className="text-xs text-[#86868b]">{prod.units} uds</p>}
                          </div>
                        </div>
                        {p.evaluacion !== 'optimo' && (
                          <div className="mt-2.5">
                            <a
                              href={p.link_google}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-black/10 hover:bg-black/5 text-[#1d1d1f] rounded-full text-xs font-semibold transition-colors"
                            >
                              Ver precio de competencia →
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Widget>
      </div>

      {/* ── PRESUPUESTOS ────────────────────────────────────────── */}
      {budgetStats.total > 0 && (
        <Widget className="p-5">
          <SectionLabel>Presupuestos generados</SectionLabel>

          {/* KPIs fila */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-black/3 rounded-xl p-4">
              <p className="text-xs text-[#86868b] mb-1">Total generados</p>
              <p className="text-2xl font-semibold text-[#1d1d1f]">{budgetStats.total}</p>
              <p className="text-xs text-[#86868b] mt-1">{fmtMoney(budgetStats.totalMonto)}</p>
            </div>
            <div className="bg-[#f0fff4] rounded-xl p-4">
              <p className="text-xs text-[#34c759] font-medium mb-1">Concretados</p>
              <p className="text-2xl font-semibold text-[#34c759]">{budgetStats.concretados}</p>
              <p className="text-xs text-[#86868b] mt-1">{fmtMoney(budgetStats.montoConcretado)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium mb-1">Pendientes</p>
              <p className="text-2xl font-semibold text-amber-600">{budgetStats.pendientes}</p>
              <p className="text-xs text-[#86868b] mt-1">sin confirmar</p>
            </div>
            <div className="bg-[#f0f7ff] rounded-xl p-4">
              <p className="text-xs text-[#007AFF] font-medium mb-1">Tasa de conversión</p>
              <p className="text-2xl font-semibold text-[#007AFF]">{budgetStats.conversionRate}%</p>
              <p className="text-xs text-[#86868b] mt-1">presupuestos → ventas</p>
            </div>
          </div>

          {/* Tabla por cliente */}
          <p className="text-xs font-semibold text-[#86868b] uppercase tracking-[0.2em] mb-3">Por cliente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#86868b] border-b border-black/5">
                  {['Cliente', 'Presupuestos', 'Concretados', 'Conversión', 'Monto total', 'Monto concretado'].map(h => (
                    <th key={h} className={`pb-2 font-medium ${h === 'Cliente' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {budgetStats.clientList.map(c => {
                  const rate = c.total > 0 ? Math.round(c.concretados / c.total * 100) : 0
                  return (
                    <tr key={c.name}>
                      <td className="py-2.5 font-medium text-[#1d1d1f]">{c.name}</td>
                      <td className="py-2.5 text-right text-[#86868b]">{c.total}</td>
                      <td className="py-2.5 text-right font-semibold text-[#34c759]">{c.concretados}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rate >= 50 ? 'bg-[#f0fff4] text-[#34c759]' : rate > 0 ? 'bg-amber-50 text-amber-600' : 'bg-black/5 text-[#86868b]'}`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[#1d1d1f]">{fmtMoney(c.monto)}</td>
                      <td className="py-2.5 text-right font-semibold text-[#34c759]">{fmtMoney(c.montoConcretado)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Widget>
      )}

      {/* ── STOCK CRÍTICO (al final) ─────────────────────────────── */}
      {criticalStock.length > 0 && (
        <Widget className="p-5">
          <SectionLabel>Stock crítico — menos de 14 días de existencia</SectionLabel>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {criticalStock.map(p => (
              <div key={p.id} className="bg-[#fff2f2] border border-[#ff3b30]/10 rounded-xl p-3">
                <p className="text-sm font-medium text-[#1d1d1f]">{p.name}</p>
                <p className="text-sm font-semibold text-[#ff3b30] mt-0.5">{p.daysLeft} días</p>
                <p className="text-xs text-[#86868b] mt-0.5">Stock: {p.current_stock} · {p.dailySold} uds/día</p>
              </div>
            ))}
          </div>
        </Widget>
      )}

    </div>
  )
}
