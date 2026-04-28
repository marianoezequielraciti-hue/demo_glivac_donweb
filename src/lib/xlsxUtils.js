import * as XLSX from 'xlsx'

const C = {
  headerBg: '1E3A8A', headerFg: 'FFFFFF',
  altRow: 'EFF6FF', totalBg: 'DBEAFE', totalFg: '1E3A8A',
  border: 'BFDBFE',
}

const mkBorder = () => {
  const s = { style: 'thin', color: { rgb: C.border } }
  return { top: s, bottom: s, left: s, right: s }
}

const hStyle = () => ({
  font:      { bold: true, color: { rgb: C.headerFg }, name: 'Arial', sz: 11 },
  fill:      { fgColor: { rgb: C.headerBg }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border:    mkBorder(),
})

const cStyle = (ri, opts = {}) => ({
  font:      { name: 'Arial', sz: 10, ...(opts.fontColor ? { color: { rgb: opts.fontColor } } : {}) },
  fill:      opts.bgColor
    ? { fgColor: { rgb: opts.bgColor }, patternType: 'solid' }
    : ri % 2 === 0 ? { fgColor: { rgb: C.altRow }, patternType: 'solid' } : { patternType: 'none' },
  alignment: { vertical: 'center', horizontal: opts.align || 'left' },
  border:    mkBorder(),
})

const tStyle = () => ({
  font:      { bold: true, name: 'Arial', sz: 10, color: { rgb: C.totalFg } },
  fill:      { fgColor: { rgb: C.totalBg }, patternType: 'solid' },
  alignment: { horizontal: 'right', vertical: 'center' },
  border:    mkBorder(),
})

export function exportToXlsx(data, columns, filename, sheetName = 'Datos', opts = {}) {
  const wb = XLSX.utils.book_new()
  const ws = {}
  let row = 1

  if (opts.title) {
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = {
      v: opts.title, t: 's',
      s: { font: { bold: true, sz: 14, name: 'Arial', color: { rgb: C.headerBg } }, alignment: { horizontal: 'left' } },
    }
    ws['!merges'] = [...(ws['!merges'] || []), { s: { r: row-1, c: 0 }, e: { r: row-1, c: columns.length-1 } }]
    row++
  }
  if (opts.subtitle) {
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = {
      v: opts.subtitle, t: 's',
      s: { font: { sz: 10, name: 'Arial', color: { rgb: '6B7280' }, italic: true } },
    }
    ws['!merges'] = [...(ws['!merges'] || []), { s: { r: row-1, c: 0 }, e: { r: row-1, c: columns.length-1 } }]
    row++
  }
  if (opts.title || opts.subtitle) row++

  columns.forEach((col, ci) => {
    ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = { v: col.label, t: 's', s: hStyle() }
  })
  row++

  data.forEach((item, ri) => {
    columns.forEach((col, ci) => {
      let val = item[col.key]
      let t = 's'
      if (col.type === 'number' || col.type === 'currency') { val = parseFloat(val) || 0; t = 'n' }
      else if (col.type === 'date') { val = val ? String(val).split('T')[0] : '' }
      else { val = val != null ? String(val) : '' }
      let bgColor, fontColor
      if (col.colorFn) { const r = col.colorFn(item); bgColor = r?.bg; fontColor = r?.fg }
      ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = {
        v: val, t,
        s: cStyle(ri, { align: col.type === 'currency' || col.type === 'number' ? 'right' : col.align, bgColor, fontColor }),
        z: col.type === 'currency' ? '"$"#,##0.00' : undefined,
      }
    })
    row++
  })

  if (opts.totals) {
    columns.forEach((col, ci) => {
      ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = {
        v: ci === 0 ? 'TOTAL' : (opts.totals[col.key] ?? ''),
        t: typeof opts.totals[col.key] === 'number' ? 'n' : 's',
        s: tStyle(),
        z: col.type === 'currency' ? '"$"#,##0.00' : undefined,
      }
    })
  }

  ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }))
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: columns.length-1 } })
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportMultiSheet(sheets, filename) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ data, columns, sheetName, opts = {} }) => {
    const ws = {}
    let row = 1
    if (opts.title) {
      ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = { v: opts.title, t: 's', s: { font: { bold: true, sz: 13, name: 'Arial', color: { rgb: C.headerBg } } } }
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length-1 } }]
      row = 3
    }
    columns.forEach((col, ci) => { ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = { v: col.label, t: 's', s: hStyle() } })
    row++
    data.forEach((item, ri) => {
      columns.forEach((col, ci) => {
        let val = item[col.key]; let t = 's'
        if (col.type === 'number' || col.type === 'currency') { val = parseFloat(val) || 0; t = 'n' }
        else { val = val != null ? String(val) : '' }
        ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = { v: val, t, s: cStyle(ri, { align: col.type === 'currency' ? 'right' : col.align }), z: col.type === 'currency' ? '"$"#,##0.00' : undefined }
      })
      row++
    })
    if (opts.totals) {
      columns.forEach((col, ci) => {
        ws[XLSX.utils.encode_cell({ r: row-1, c: ci })] = { v: ci === 0 ? 'TOTAL' : (opts.totals[col.key] ?? ''), t: typeof opts.totals[col.key] === 'number' ? 'n' : 's', s: tStyle(), z: col.type === 'currency' ? '"$"#,##0.00' : undefined }
      })
    }
    ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }))
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: columns.length-1 } })
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function importFromXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows.map(row => Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\\s+/g, '_'), v])
        )))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export const PRODUCT_COLUMNS = [
  { key: 'barcode', label: 'Código de Barras', width: 20 },
  { key: 'name', label: 'Nombre', width: 32 },
  { key: 'category', label: 'Categoría', width: 18 },
  { key: 'unit', label: 'Unidad', width: 12 },
  { key: 'current_stock', label: 'Stock Actual', width: 14, type: 'number', align: 'right' },
  { key: 'min_stock', label: 'Stock Mínimo', width: 14, type: 'number', align: 'right' },
  { key: 'purchase_price', label: 'P. Compra ($)', width: 16, type: 'currency', align: 'right' },
  { key: 'sale_price', label: 'P. Venta ($)', width: 16, type: 'currency', align: 'right' },
  { key: 'active', label: 'Activo', width: 10 },
]
export const SALE_COLUMNS = [
  { key: 'sale_number', label: 'N° Venta', width: 16 },
  { key: 'created_at', label: 'Fecha', width: 20, type: 'date' },
  { key: 'cashier', label: 'Cajero', width: 16 },
  { key: 'payment_method', label: 'Método de Pago', width: 18 },
  { key: 'items_summary', label: 'Productos', width: 40 },
  { key: 'total', label: 'Total ($)', width: 16, type: 'currency', align: 'right' },
]
export const PURCHASE_COLUMNS = [
  { key: 'created_at', label: 'Fecha', width: 20, type: 'date' },
  { key: 'supplier', label: 'Proveedor', width: 24 },
  { key: 'invoice_number', label: 'N° Factura', width: 18 },
  { key: 'items_summary', label: 'Productos', width: 40 },
  { key: 'expiration_summary', label: 'Vencimientos', width: 30 },
  { key: 'total', label: 'Total ($)', width: 16, type: 'currency', align: 'right' },
]
export const EXPENSE_COLUMNS = [
  { key: 'date', label: 'Fecha', width: 14, type: 'date' },
  { key: 'description', label: 'Descripción', width: 32 },
  { key: 'category', label: 'Categoría', width: 18 },
  { key: 'expense_type', label: 'Tipo', width: 12 },
  { key: 'amount', label: 'Monto ($)', width: 16, type: 'currency', align: 'right' },
  { key: 'notes', label: 'Notas', width: 28 },
]
export const PURCHASE_IMPORT_COLUMNS = [
  { key: 'barcode', label: 'barcode', width: 20 },
  { key: 'name', label: 'name', width: 32 },
  { key: 'quantity', label: 'quantity', width: 12, type: 'number' },
  { key: 'purchase_price', label: 'purchase_price', width: 18, type: 'currency' },
  { key: 'sale_price', label: 'sale_price', width: 18, type: 'currency' },
  { key: 'expiration_date', label: 'expiration_date', width: 18, type: 'date' },
]
export const SCANNER_COLUMNS = [
  { key: 'barcode', label: 'Código de Barras', width: 20 },
  { key: 'name', label: 'Nombre', width: 32 },
  { key: 'quantity', label: 'Cantidad', width: 12, type: 'number', align: 'right' },
  { key: 'purchase_price', label: 'P. Compra ($)', width: 18, type: 'currency', align: 'right' },
  { key: 'sale_price', label: 'P. Venta ($)', width: 18, type: 'currency', align: 'right' },
  { key: 'match_status', label: 'Estado', width: 16,
    colorFn: (i) => i.match_status === 'Coincide' ? { bg: 'D1FAE5', fg: '065F46' } : { bg: 'FEF3C7', fg: '92400E' },
  },
]
