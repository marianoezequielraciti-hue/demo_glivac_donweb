import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportToXlsx, SALE_COLUMNS } from '@/lib/xlsxUtils'
import { formatDateTimeART, fmtMoney } from '@/components/argentina'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const PaymentBadge = ({ method }) => {
  const styles = {
    efectivo: 'bg-green-100 text-green-800',
    transferencia: 'bg-blue-100 text-zinc-800',
    qr: 'bg-purple-100 text-purple-800',
    tarjeta: 'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[method] || 'bg-gray-100 text-gray-800'}`}>
      {method || 'sin dato'}
    </span>
  )
}

export default function Sales() {
  const { user, isAdmin, storeId } = useAuth()
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', storeId],
    queryFn: async () => {
      let q = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(500)
      if (storeId) q = q.eq('store_id', storeId)
      const { data } = await q
      return data || []
    },
    enabled: !!user,
  })
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return sales
    return sales.filter(s =>
      (s.sale_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.cashier || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.payment_method || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [sales, search])

  const handleExport = () => {
    exportToXlsx(
      filtered.map(s => ({
        ...s,
        items_summary: (s.items || []).map(i => `${i.product_name || 'Sin nombre'} ×${i.quantity}`).join(' | ')
      })),
      SALE_COLUMNS,
      `ventas_${new Date().toISOString().split('T')[0]}`,
      'Ventas',
      {
        title: 'Glivac — Historial de Ventas',
        subtitle: `Exportado el ${new Date().toLocaleDateString('es-AR')}`,
        totals: { total: filtered.reduce((sum, v) => sum + (v.total || 0), 0) }
      }
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Ventas</p>
          <h1 className="text-3xl font-bold">Historial de Ventas</h1>
          <p className="text-gray-500">Registro completo de transacciones</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-semibold"
        >
          Exportar Excel
        </button>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          placeholder="Buscar por número de venta o cajero..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-72 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        />
        <div className="text-sm text-gray-500">Mostrando {filtered.length} registros</div>
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-zinc-400 border-b border-zinc-100">
              <th className="px-4 py-3">N° Venta</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cajero</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Método</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Cargando ventas...</td>
              </tr>
            )}
            {!isLoading && !filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No hay ventas registradas.</td>
              </tr>
            )}
            {!isLoading && filtered.map(sale => {
              const displayItems = (sale.items || []).slice(0, 2).map(i => `${i.product_name || 'Sin nombre'} ×${i.quantity}`)
              const more = (sale.items || []).length - displayItems.length
              return (
                <tr key={sale.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{sale.sale_number || 'Sin número'}</td>
                  <td className="px-4 py-3">{formatDateTimeART(sale.created_at)}</td>
                  <td className="px-4 py-3">{sale.cashier || '-'}</td>
                  <td className="px-4 py-3">
                    {displayItems.join(', ')}{more > 0 ? ` +${more} más` : ''}
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmtMoney(sale.total)}</td>
                  <td className="px-4 py-3"><PaymentBadge method={sale.payment_method} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
