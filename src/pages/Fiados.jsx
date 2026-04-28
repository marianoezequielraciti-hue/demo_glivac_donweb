import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatDateTimeART, fmtMoney } from '@/components/argentina'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'
import { ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_CLASS = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado: 'bg-emerald-100 text-emerald-700',
}

const PAY_METHODS = [
  { key: 'efectivo', label: '💵 Efectivo' },
  { key: 'mercadopago', label: '📱 Mercado Pago' },
]

export default function Fiados() {
  const queryClient = useQueryClient()
  const { user, isAdmin, storeId } = useAuth()
  const { stores, selectedStoreId, setSelectedStoreId } = useStoreFilter()
  const effectiveStoreId = selectedStoreId || (isAdmin ? null : storeId)

  const [filter, setFilter] = useState('pendiente')
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // modal: cobrar fiado individual
  const [payModal, setPayModal] = useState(null)
  const [payMethod, setPayMethod] = useState('efectivo')

  // modal: cobrar grupo (total o parcial)
  const [groupModal, setGroupModal] = useState(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [groupPayMethod, setGroupPayMethod] = useState('efectivo')

  const { data: fiados = [], isLoading } = useQuery({
    queryKey: ['fiados', effectiveStoreId],
    queryFn: async () => {
      let q = supabase.from('fiados').select('*').order('created_at', { ascending: false })
      if (effectiveStoreId) q = q.eq('store_id', effectiveStoreId)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  const totalPendiente = useMemo(
    () => fiados.filter(f => f.status === 'pendiente').reduce((s, f) => s + (f.amount || 0), 0),
    [fiados]
  )
  const countPendiente = useMemo(() => fiados.filter(f => f.status === 'pendiente').length, [fiados])

  // Pendientes agrupados por cliente, más viejo primero dentro del grupo
  const pendingGroups = useMemo(() => {
    const map = new Map()
    fiados
      .filter(f => f.status === 'pendiente')
      .forEach(f => {
        if (!map.has(f.customer_name)) map.set(f.customer_name, [])
        map.get(f.customer_name).push(f)
      })
    return [...map.values()]
      .map(items => ({
        name: items[0].customer_name,
        fiados: [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        total: items.reduce((s, f) => s + (f.amount || 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [fiados])

  const flatFiltered = useMemo(
    () => filter === 'todos' ? fiados : fiados.filter(f => f.status === filter),
    [fiados, filter]
  )

  // FIFO: qué fiados se pueden pagar completamente con `amount`
  const getAllocation = (group, amount) => {
    let remaining = amount
    const toPay = []
    for (const f of group.fiados) {
      if (remaining < 0.005) break
      if ((f.amount || 0) <= remaining + 0.005) {
        remaining -= f.amount
        toPay.push(f)
      }
    }
    return { toPay, leftover: Math.max(0, remaining) }
  }

  const markPaidMutation = useMutation({
    mutationFn: async ({ id, method }) => {
      const { error } = await supabase.from('fiados')
        .update({ status: 'pagado', paid_method: method, paid_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiados'] })
      toast.success('Fiado cobrado')
      setPayModal(null)
    },
    onError: () => toast.error('Error al actualizar el fiado'),
  })

  const bulkMarkPaidMutation = useMutation({
    mutationFn: async ({ ids, method }) => {
      const now = new Date().toISOString()
      for (const id of ids) {
        const { error } = await supabase.from('fiados')
          .update({ status: 'pagado', paid_method: method, paid_at: now })
          .eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiados'] })
      toast.success('Cobro registrado')
      setGroupModal(null)
      setPartialAmount('')
    },
    onError: () => toast.error('Error al cobrar'),
  })

  const openGroupModal = (group, prefillTotal = false) => {
    setGroupModal(group)
    setPartialAmount(prefillTotal ? String(group.total) : '')
    setGroupPayMethod('efectivo')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Crédito</p>
          <h1 className="text-3xl font-bold">Fiados</h1>
        </div>
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
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-sm text-amber-600 font-medium">Total pendiente</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{fmtMoney(totalPendiente)}</p>
          <p className="text-xs text-amber-500 mt-1">{countPendiente} {countPendiente === 1 ? 'fiado' : 'fiados'} sin cobrar</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-sm text-gray-500 font-medium">Total registrado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtMoney(fiados.reduce((s, f) => s + (f.amount || 0), 0))}</p>
          <p className="text-xs text-gray-400 mt-1">{fiados.length} {fiados.length === 1 ? 'fiado total' : 'fiados totales'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'pendiente', label: 'Pendientes' },
          { key: 'pagado', label: 'Pagados' },
          { key: 'todos', label: 'Todos' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === key ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PENDIENTES: agrupados por cliente ── */}
      {filter === 'pendiente' && (
        <div className="space-y-3">
          {isLoading && <div className="py-12 text-center text-sm text-gray-400">Cargando fiados...</div>}
          {!isLoading && pendingGroups.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No hay fiados pendientes.</div>
          )}
          {pendingGroups.map(group => {
            const isOpen = expandedGroup === group.name
            return (
              <div key={group.name} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-2 h-10 rounded-full shrink-0 bg-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {group.fiados.length} {group.fiados.length === 1 ? 'fiado' : 'fiados'} · desde {formatDateTimeART(group.fiados[0].created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-lg font-bold text-amber-700">{fmtMoney(group.total)}</p>
                    <button
                      onClick={() => openGroupModal(group, true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Cobrar
                    </button>
                    <button
                      onClick={() => setExpandedGroup(isOpen ? null : group.name)}
                      className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                    {group.fiados.map(fiado => {
                      const isFiadoExpanded = expandedId === fiado.id
                      return (
                        <div key={fiado.id}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">{formatDateTimeART(fiado.created_at)}</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{fmtMoney(fiado.amount)}</p>
                            <button
                              onClick={() => { setPayModal(fiado); setPayMethod('efectivo') }}
                              className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold transition-colors"
                            >
                              Cobrar
                            </button>
                            <button
                              onClick={() => setExpandedId(isFiadoExpanded ? null : fiado.id)}
                              className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-500"
                            >
                              {isFiadoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {isFiadoExpanded && (
                            <div className="px-4 pb-3 bg-white space-y-1">
                              {(fiado.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-gray-600">{item.product_name} <span className="text-gray-400">×{item.quantity}</span></span>
                                  <span className="font-semibold text-gray-800">{fmtMoney(item.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── PAGADOS / TODOS: lista plana ── */}
      {filter !== 'pendiente' && (
        <div className="space-y-2">
          {isLoading && <div className="py-12 text-center text-sm text-gray-400">Cargando fiados...</div>}
          {!isLoading && !flatFiltered.length && (
            <div className="py-12 text-center text-sm text-gray-400">No hay fiados registrados.</div>
          )}
          {flatFiltered.map(fiado => {
            const isExpanded = expandedId === fiado.id
            return (
              <div key={fiado.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-2 h-10 rounded-full shrink-0 ${fiado.status === 'pendiente' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{fiado.customer_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASS[fiado.status]}`}>
                        {fiado.status === 'pendiente' ? 'Pendiente' : 'Pagado'}
                      </span>
                      {fiado.paid_method && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                          {fiado.paid_method === 'mercadopago' ? 'Mercado Pago' : 'Efectivo'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTimeART(fiado.created_at)}
                      {fiado.paid_at && ` · Pagado ${formatDateTimeART(fiado.paid_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-lg font-bold text-gray-900">{fmtMoney(fiado.amount)}</p>
                    {fiado.status === 'pendiente' && (
                      <button
                        onClick={() => { setPayModal(fiado); setPayMethod('efectivo') }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Cobrar
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fiado.id)}
                      className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalle</p>
                    <div className="space-y-1">
                      {(fiado.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.product_name} <span className="text-gray-400">×{item.quantity}</span></span>
                          <span className="font-semibold text-gray-900">{fmtMoney(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal cobro individual ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-xl">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Cobrar fiado</p>
              <h3 className="text-xl font-bold mt-1">{payModal.customer_name}</h3>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{fmtMoney(payModal.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de cobro</p>
              <div className="grid grid-cols-2 gap-2">
                {PAY_METHODS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPayMethod(key)}
                    className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                      payMethod === key ? 'bg-zinc-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => markPaidMutation.mutate({ id: payModal.id, method: payMethod })}
                disabled={markPaidMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cobro de grupo (total o parcial) ── */}
      {groupModal && (() => {
        const amount = parseFloat(partialAmount) || 0
        const { toPay, leftover } = getAllocation(groupModal, amount)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Cobrar fiados</p>
                <h3 className="text-xl font-bold mt-1">{groupModal.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {groupModal.fiados.length} {groupModal.fiados.length === 1 ? 'fiado' : 'fiados'} · Total: {fmtMoney(groupModal.total)}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto a cobrar</label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  />
                </div>
              </div>

              {amount > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-gray-500 uppercase tracking-wider">
                    {toPay.length === 0
                      ? 'Monto insuficiente para cubrir algún fiado'
                      : `Se cobran ${toPay.length} de ${groupModal.fiados.length} ${groupModal.fiados.length === 1 ? 'fiado' : 'fiados'}`}
                  </p>
                  {toPay.map(f => (
                    <div key={f.id} className="flex justify-between text-gray-700">
                      <span>{formatDateTimeART(f.created_at)}</span>
                      <span className="font-semibold text-emerald-600">{fmtMoney(f.amount)}</span>
                    </div>
                  ))}
                  {leftover > 0.005 && (
                    <p className="text-amber-600 font-semibold pt-1 border-t border-gray-200">
                      Sobrante sin aplicar: {fmtMoney(leftover)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Método de cobro</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAY_METHODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setGroupPayMethod(key)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        groupPayMethod === key ? 'bg-zinc-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setGroupModal(null); setPartialAmount('') }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!toPay.length) { toast.error('Monto insuficiente para cubrir algún fiado'); return }
                    bulkMarkPaidMutation.mutate({ ids: toPay.map(f => f.id), method: groupPayMethod })
                  }}
                  disabled={bulkMarkPaidMutation.isPending || !toPay.length}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  Confirmar cobro
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
