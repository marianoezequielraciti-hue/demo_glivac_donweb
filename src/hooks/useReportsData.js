import { useMemo } from 'react'
import { startOfMonthART } from '@/components/argentina'
import { getDaysInMonth, differenceInDays } from 'date-fns'

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function useReportsData(sales, expenses, products, periodConfig) {
  return useMemo(() => {
    const now = new Date()
    let periodStart, periodEnd, prevStart, prevEnd, sameLastYearStart, sameLastYearEnd

    if (periodConfig.type === 'day') {
      const [y, m, d] = periodConfig.date.split('-').map(Number)
      periodStart = new Date(Date.UTC(y, m - 1, d, 3, 0, 0))
      periodEnd = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59))
      prevStart = new Date(Date.UTC(y, m - 1, d - 1, 3, 0, 0))
      prevEnd = new Date(Date.UTC(y, m - 1, d, 2, 59, 59))
      sameLastYearStart = new Date(Date.UTC(y - 1, m - 1, d, 3, 0, 0))
      sameLastYearEnd = new Date(Date.UTC(y - 1, m - 1, d + 1, 2, 59, 59))
    } else if (periodConfig.type === 'month') {
      const y = periodConfig.year
      const m = periodConfig.month
      periodStart = new Date(Date.UTC(y, m, 1, 3, 0, 0))
      periodEnd = new Date(Date.UTC(y, m + 1, 0, 26, 59, 59))
      prevStart = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0))
      prevEnd = new Date(Date.UTC(y, m, 0, 26, 59, 59))
      sameLastYearStart = new Date(Date.UTC(y - 1, m, 1, 3, 0, 0))
      sameLastYearEnd = new Date(Date.UTC(y - 1, m + 1, 0, 26, 59, 59))
    } else if (periodConfig.type === 'week') {
      periodStart = startOfWeekART()
      periodEnd = now
      prevStart = new Date(periodStart.getTime() - 7 * 86400000)
      prevEnd = new Date(periodStart.getTime() - 1)
      sameLastYearStart = new Date(periodStart.getTime() - 365 * 86400000)
      sameLastYearEnd = new Date(periodEnd.getTime() - 365 * 86400000)
    } else {
      periodStart = startOfMonthART()
      periodEnd = now
      const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1
      const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      prevStart = new Date(Date.UTC(py, pm, 1, 3, 0, 0))
      prevEnd = new Date(Date.UTC(py, pm + 1, 0, 26, 59, 59))
      sameLastYearStart = new Date(Date.UTC(now.getFullYear() - 1, now.getMonth(), 1, 3, 0, 0))
      sameLastYearEnd = new Date(Date.UTC(now.getFullYear() - 1, now.getMonth() + 1, 0, 26, 59, 59))
    }

    const inPeriod = sales.filter(s => {
      const d = new Date(s.created_at)
      return d >= periodStart && d <= periodEnd
    })
    const inPrev = sales.filter(s => {
      const d = new Date(s.created_at)
      return d >= prevStart && d <= prevEnd
    })
    const inLastYear = sales.filter(s => {
      const d = new Date(s.created_at)
      return d >= sameLastYearStart && d <= sameLastYearEnd
    })
    const expInPeriod = expenses.filter(e => {
      const d = new Date(e.date)
      return d >= periodStart && d <= periodEnd
    })

    const totalRevenue = inPeriod.reduce((sum, s) => sum + (s.total || 0), 0)
    const prevRevenue = inPrev.reduce((sum, s) => sum + (s.total || 0), 0)
    const sameLastYear = inLastYear.reduce((sum, s) => sum + (s.total || 0), 0)
    const totalExpenses = expInPeriod.reduce((sum, e) => sum + (e.amount || 0), 0)

    const calcProfit = (arr) => arr.reduce((sum, sale) =>
      sum + (sale.items || []).reduce((s, item) =>
        s + ((item.unit_price - (item.purchase_price || 0)) * item.quantity), 0), 0)

    const totalProfit = calcProfit(inPeriod)
    const netProfit = totalProfit - totalExpenses

    const daysInMonth = periodConfig.type === 'day' ? 1 : getDaysInMonth(periodStart)
    const daysElapsed = periodConfig.type === 'day' ? 1 : Math.max(1, differenceInDays(now, periodStart) + 1)
    const dailyAvg = totalRevenue / daysElapsed
    const projected = dailyAvg * daysInMonth
    const avgTicket = inPeriod.length > 0 ? totalRevenue / inPeriod.length : 0

    // Daily chart
    const dailyMap = {}
    inPeriod.forEach(sale => {
      const day = new Date(sale.created_at).toISOString().split('T')[0]
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, profit: 0, count: 0 }
      dailyMap[day].revenue += sale.total || 0
      dailyMap[day].profit += (sale.items || []).reduce((s, item) =>
        s + ((item.unit_price - (item.purchase_price || 0)) * item.quantity), 0)
      dailyMap[day].count++
    })
    const dailyChart = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: date.slice(5),
        Ventas: Math.round(value.revenue),
        Ganancias: Math.round(value.profit),
        Tickets: value.count,
      }))

    // Best day
    const bestDay = dailyChart.reduce((best, d) => d.Ventas > (best?.Ventas || 0) ? d : best, null)

    // Day of week analysis
    const dowMap = {}
    DAY_NAMES.forEach(d => { dowMap[d] = { revenue: 0, count: 0 } })
    inPeriod.forEach(sale => {
      const dow = DAY_NAMES[new Date(sale.created_at).getDay()]
      dowMap[dow].revenue += sale.total || 0
      dowMap[dow].count++
    })
    // Reorder Mon-Sun
    const dowOrder = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const byDayOfWeek = dowOrder.map(d => ({
      day: d,
      Ventas: Math.round(dowMap[d].revenue),
      tickets: dowMap[d].count,
    }))

    // Hourly chart (ART = UTC-3)
    const hourMap = {}
    for (let h = 6; h <= 22; h++) hourMap[h] = { revenue: 0, count: 0 }
    inPeriod.forEach(sale => {
      const utcHour = new Date(sale.created_at).getUTCHours()
      const artHour = ((utcHour - 3) + 24) % 24
      if (artHour >= 6 && artHour <= 22) {
        hourMap[artHour].revenue += sale.total || 0
        hourMap[artHour].count++
      }
    })
    const hourlyChart = Object.entries(hourMap).map(([h, v]) => ({
      hora: `${h}h`,
      Ventas: Math.round(v.revenue),
      tickets: v.count,
    }))

    // Payment method breakdown
    const payMap = {}
    inPeriod.forEach(sale => {
      const m = sale.payment_method || 'sin dato'
      if (!payMap[m]) payMap[m] = { total: 0, count: 0 }
      payMap[m].total += sale.total || 0
      payMap[m].count++
    })
    const paymentChart = Object.entries(payMap)
      .map(([name, v]) => ({ name, value: Math.round(v.total), count: v.count }))
      .sort((a, b) => b.value - a.value)

    // Expense breakdown
    const expByCategory = {}
    expInPeriod.forEach(exp => {
      expByCategory[exp.category] = (expByCategory[exp.category] || 0) + exp.amount
    })
    const expPieChart = Object.entries(expByCategory)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)

    // Product rotation
    const rotMap = {}
    inPeriod.forEach(sale => {
      const seen = new Set()
      ;(sale.items || []).forEach(item => {
        const name = item.product_name || 'Sin nombre'
        if (!rotMap[name]) rotMap[name] = { ticketCount: 0, totalUnits: 0, totalRevenue: 0, product_id: item.product_id }
        if (!seen.has(name)) { rotMap[name].ticketCount++; seen.add(name) }
        rotMap[name].totalUnits += item.quantity
        rotMap[name].totalRevenue += (item.unit_price || 0) * item.quantity
        if (!rotMap[name].product_id && item.product_id) rotMap[name].product_id = item.product_id
      })
    })
    const rotacion = Object.entries(rotMap)
      .map(([product_name, value]) => ({ product_name, ...value }))
      .sort((a, b) => b.ticketCount - a.ticketCount)
      .slice(0, 10)

    // Product canasta
    const pairMap = {}
    inPeriod.forEach(sale => {
      const names = (sale.items || []).map(i => i.product_name).sort()
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = `${names[i]} + ${names[j]}`
          pairMap[key] = (pairMap[key] || 0) + 1
        }
      }
    })
    const canasta = Object.entries(pairMap)
      .filter(([, count]) => count >= 2)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Critical stock
    const soldMap = {}
    inPeriod.forEach(sale => {
      ;(sale.items || []).forEach(item => {
        soldMap[item.product_id] = (soldMap[item.product_id] || 0) + item.quantity
      })
    })
    const criticalStock = products
      .filter(p => p.active)
      .map(p => {
        const sold = soldMap[p.id] || 0
        const dailySold = sold / Math.max(1, daysElapsed)
        const daysLeft = dailySold > 0 ? Math.floor(p.current_stock / dailySold) : 999
        return { ...p, daysLeft, dailySold: Math.round(dailySold * 10) / 10 }
      })
      .filter(p => p.daysLeft < 14)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // Cajero stats
    const cajeroMap = {}
    inPeriod.forEach(sale => {
      const cajero = sale.cashier || 'Sin cajero'
      if (!cajeroMap[cajero]) cajeroMap[cajero] = { count: 0, total: 0, profit: 0 }
      cajeroMap[cajero].count++
      cajeroMap[cajero].total += sale.total || 0
      cajeroMap[cajero].profit += (sale.items || []).reduce(
        (s, item) => s + ((item.unit_price - (item.purchase_price || 0)) * item.quantity), 0)
    })
    const cajeroStats = Object.entries(cajeroMap)
      .map(([name, stats]) => ({ name, ...stats, avgTicket: stats.count > 0 ? stats.total / stats.count : 0 }))
      .sort((a, b) => b.total - a.total)

    // ROI and break-even
    const breakEvenUnits = totalExpenses > 0 && totalRevenue > 0
      ? Math.ceil(totalExpenses / (totalRevenue / Math.max(1, inPeriod.length)))
      : 0

    const tips = []
    if (prevRevenue > 0 && totalRevenue < prevRevenue * 0.8)
      tips.push(`Las ventas cayeron un ${Math.round((1 - totalRevenue / prevRevenue) * 100)}% vs el período anterior.`)
    if (criticalStock.length > 0)
      tips.push(`${criticalStock.length} producto(s) con menos de 14 días de stock.`)
    if (prevRevenue > 0 && totalRevenue > prevRevenue * 1.1)
      tips.push(`Las ventas subieron un ${Math.round((totalRevenue / prevRevenue - 1) * 100)}% vs el período anterior.`)
    if (netProfit < 0)
      tips.push(`La utilidad neta es negativa. Los gastos superan la ganancia bruta.`)

    return {
      totalRevenue, prevRevenue, sameLastYear, totalExpenses, totalProfit,
      netProfit, projected, dailyAvg, daysInMonth, daysElapsed,
      avgTicket, bestDay, breakEvenUnits,
      dailyChart, byDayOfWeek, hourlyChart, paymentChart, expPieChart,
      rotacion, canasta, criticalStock, cajeroStats, tips,
    }
  }, [sales, expenses, products, periodConfig])
}

function startOfWeekART(date = new Date()) {
  const ART_OFFSET_MS = 3 * 60 * 60 * 1000
  const d = new Date(date.getTime() - ART_OFFSET_MS)
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff) + ART_OFFSET_MS)
}
