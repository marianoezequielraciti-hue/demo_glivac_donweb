import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  formatDateTimeART,
  fmtMoney,
  startOfDayART,
  startOfWeekART,
  startOfMonthART,
} from '@/components/argentina'
import { useAuth } from '@/hooks/useAuth'

const PAYMENT_BADGES = {
  efectivo:  'bg-emerald-100 text-emerald-800',
  transferencia: 'bg-sky-100 text-sky-800',
  qr: 'bg-purple-100 text-purple-800',
  tarjeta: 'bg-orange-100 text-orange-800',
}

const badgeClass = (method) => PAYMENT_BADGES[method] || 'bg-gray-100 text-gray-800'

export default function Dashboard() {
  const { user, isAdmin, storeId, storeName } = useAuth()

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', storeId],
    queryFn: async () => {
      let q = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(500)
      if (storeId) q = q.eq('store_id', storeId)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      let q = supabase.from('products').select('*')
      if (storeId) q = q.eq('store_id', storeId)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', storeId],
    queryFn: async () => {
      let q = supabase.from('expenses').select('*').order('date', { ascending: false }).limit(500)
      if (storeId) q = q.eq('store_id', storeId)
      const { data } = await q
      return data || []
    },
    enabled: !!user && isAdmin,
  })

  const today = startOfDayART()
  const weekStart = startOfWeekART()
  const monthStart = startOfMonthART()

  const todaySales = useMemo(() => sales.filter(s => new Date(s.created_at) >= today), [sales, today])
  const weekSales = useMemo(() => sales.filter(s => new Date(s.created_at) >= weekStart), [sales, weekStart])
  const monthSales = useMemo(() => sales.filter(s => new Date(s.created_at) >= monthStart), [sales, monthStart])
  const monthExpenses = useMemo(() => expenses.filter(e => new Date(e.date) >= monthStart), [expenses, monthStart])

  const todayRevenue = todaySales.reduce((acc, s) => acc + (s.total || 0), 0)
  const weekRevenue = weekSales.reduce((acc, s) => acc + (s.total || 0), 0)
  const monthRevenue = monthSales.reduce((acc, s) => acc + (s.total || 0), 0)
  const monthExpTotal = monthExpenses.reduce((acc, e) => acc + (e.amount || 0), 0)

  const calcProfit = (salesArr) =>
    salesArr.reduce((sum, sale) =>
      sum + (sale.items || []).reduce((s, item) =>
        s + ((item.unit_price - (item.purchase_price || 0)) * item.quantity), 0), 0)

  const todayProfit = calcProfit(todaySales)
  const monthProfit = calcProfit(monthSales)
  const netProfit = monthProfit - monthExpTotal

  const lowStockProducts = products.filter(p => p.active && p.current_stock <= p.min_stock)
  const recentSales = sales.slice(0, 5)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{storeName || 'Fiambrerías Vale'}</p>
          <h1 className="text-3xl font-bold">Panel de control</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-gray-500">Ventas Hoy</p>
          <p className="text-3xl font-bold mt-2">{todaySales.length}</p>
          <p className="text-sm text-gray-500">{isAdmin ? fmtMoney(todayRevenue) : '—'}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-gray-500">Ingresos Hoy</p>
          <p className="text-3xl font-bold mt-2">{isAdmin ? fmtMoney(todayRevenue) : '•••'}</p>
          <p className="text-xs text-gray-500 mt-1">Ganancia: {isAdmin ? fmtMoney(todayProfit) : '•••'}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-gray-500">Mes Actual</p>
          <p className="text-3xl font-bold mt-2">{isAdmin ? fmtMoney(monthRevenue) : '•••'}</p>
          <p className="text-xs text-gray-500 mt-1">Semana: {isAdmin ? fmtMoney(weekRevenue) : '•••'}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-gray-500">Stock Bajo</p>
          <p className={`text-3xl font-bold mt-2 ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{lowStockProducts.length}</p>
          {lowStockProducts.length > 0 && <p className="text-xs text-amber-600">Revisar inventario</p>}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold text-gray-500">Ganancia Mensual</p>
            <p className={`text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtMoney(netProfit)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Incluye {fmtMoney(monthExpTotal)} en gastos</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-semibold text-gray-500">Productos con stock bajo</p>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm mt-3 text-gray-500">Todo en rango</p>
            ) : (
              <ul className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {lowStockProducts.map(product => (
                  <li key={product.id} className="flex items-center justify-between text-sm">
                    <span>{product.name}</span>
                    <span className="text-xs text-gray-500">{product.current_stock}/{product.min_stock}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!isAdmin && lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-700">Productos con stock bajo</p>
          <ul className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {lowStockProducts.map(product => (
              <li key={product.id} className="flex items-center justify-between text-sm">
                <span>{product.name}</span>
                <span className="text-xs text-gray-500">{product.current_stock}/{product.min_stock}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ventas recientes</h2>
          <p className="text-sm text-gray-500">Últimos 5 registros</p>
        </div>
        {recentSales.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4">Sin ventas aún.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="pb-2">Ticket</th>
                  <th className="pb-2">Hora</th>
                  <th className="pb-2">Cajero</th>
                  {isAdmin && <th className="pb-2">Total</th>}
                  <th className="pb-2">Pago</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id} className="border-t border-gray-100">
                    <td className="py-2 font-medium text-gray-700">{sale.sale_number}</td>
                    <td className="py-2 text-gray-500">{formatDateTimeART(sale.created_at)}</td>
                    <td className="py-2 text-gray-600">{sale.cashier}</td>
                    {isAdmin && <td className="py-2 font-semibold">{fmtMoney(sale.total)}</td>}
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(sale.payment_method)}`}>
                        {sale.payment_method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
