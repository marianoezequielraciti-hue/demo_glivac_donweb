import { readFile } from 'fs'
import { writeFile } from 'fs/promises'
import xlsx from 'xlsx'
const buffer = await new Promise((res, rej) => readFile('ventas_2026-03-22.xlsx', (err, data) => err ? rej(err) : res(data)))
const workbook = xlsx.read(buffer, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })
const saleMap = new Map()
const parseDate = (value) => {
  if (!value) return null
  const parts = String(value).split(' ')
  if (parts.length < 2) return null
  const [datePart, timePart] = parts
  const [day, month, year] = datePart.split('/').map(p => p.padStart(2,'0'))
  const [hour, minute] = timePart.split(':').map(p => p.padStart(2,'0'))
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`).toISOString()
}
const toFloat = (val) => {
  const num = parseFloat(String(val || '').toString().replace(/,/g, '.'))
  return Number.isFinite(num) ? num : 0
}
for (const row of rows) {
  const saleNumber = String(row['N° Venta'] || '').trim() || `V-${Date.now()}`
  if (!saleMap.has(saleNumber)) {
    saleMap.set(saleNumber, {
      sale_number: saleNumber,
      cashier: String(row.Cajero || '').trim(),
      payment_method: String(row['Método Pago'] || 'efectivo').trim().toLowerCase(),
      created_at: parseDate(row.Fecha) || new Date().toISOString(),
      total: toFloat(row['Total Venta']),
      items: [],
    })
  }
  const sale = saleMap.get(saleNumber)
  const subtotal = toFloat(row.Subtotal)
  const unitPrice = toFloat(row['Precio Unitario'])
  const purchasePrice = toFloat(row['Precio Costo'])
  sale.items.push({
    product_name: String(row.Producto || 'Sin nombre').trim(),
    quantity: toFloat(row.Cantidad) || 0,
    unit_price: unitPrice,
    purchase_price: purchasePrice,
    subtotal,
  })
}
const lines = []
for (const sale of saleMap.values()) {
  const jsonItems = JSON.stringify(sale.items)
  const escapedItems = jsonItems.replace(/'/g, "''")
  const cashier = sale.cashier.replace(/'/g, "''")
  const paymentMethod = sale.payment_method.replace(/'/g, "''")
  lines.push(`('${sale.sale_number}','${cashier}','${paymentMethod}','${escapedItems}',${sale.total || 0},'${sale.created_at}')`)
}
const sql = `INSERT INTO sales (sale_number, cashier, payment_method, items, total, created_at) VALUES\n${lines.join(',\n')};\n`
await writeFile('ventas_import.sql', sql)
console.log('Created ventas_import.sql with', saleMap.size, 'sales rows')
