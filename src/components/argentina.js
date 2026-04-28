export const nowART = () => new Date()

export const startOfDayART = (date = new Date()) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const startOfWeekART = (date = new Date()) => {
  const d = startOfDayART(date)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const result = new Date(d)
  result.setDate(d.getDate() - diff)
  return result
}

export const startOfMonthART = (date = new Date()) => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export const startOfYearART = (date = new Date()) => {
  const d = new Date(date)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export const formatDateTimeART = (dateStr) => {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export const formatDateOnlyART = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = String(dateStr).split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export const fmtMoney = (n) => {
  const formatted = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
  return `$ ${formatted}`
}
