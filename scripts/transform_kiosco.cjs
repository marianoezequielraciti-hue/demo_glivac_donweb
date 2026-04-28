/**
 * transform_kiosco.js
 * Transforma el export del sistema anterior al formato de Supabase (Kiosco).
 * Uso: node scripts/transform_kiosco.js
 * Output: scripts/kiosco_supabase.sql  (pegar en Supabase SQL Editor)
 */

const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const KIOSCO_STORE_ID = 'bfda1f71-a7dd-4acb-aa06-6474b0c3380a'
const INPUT_FILE = path.join(__dirname, '..', 'kiosco_export_2026-04-12.sql')
const OUTPUT_FILE = path.join(__dirname, 'kiosco_supabase.sql')

// ── Utilidades ────────────────────────────────────────────────────
function mapPaymentMethod(method) {
  if (!method) return 'efectivo'
  const m = method.toLowerCase()
  if (m.includes('débito') || m.includes('debito') || m.includes('crédito') || m.includes('credito') || m.includes('tarjeta')) return 'tarjeta'
  if (m.includes('transferencia') || m.includes('transfer')) return 'transferencia'
  if (m.includes('qr') || m.includes('mercado') || m.includes('mp')) return 'qr'
  return 'efectivo'
}

function escStr(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''").trim()}'`
}

function escNum(n) {
  const v = parseFloat(n)
  return isNaN(v) ? '0' : String(v)
}

// ── Parser de VALUES de INSERT ─────────────────────────────────────
// Parsea la cadena VALUES (v1, v2, ...), (v1, v2, ...) respetando strings y paréntesis anidados.
function parseInsertValues(valuesStr) {
  const rows = []
  let i = 0, len = valuesStr.length

  while (i < len) {
    // Buscar inicio de fila
    while (i < len && valuesStr[i] !== '(') i++
    if (i >= len) break
    i++ // saltar '('

    const row = []
    let current = ''

    while (i < len) {
      const ch = valuesStr[i]
      if (ch === "'") {
        // String literal
        i++
        while (i < len) {
          if (valuesStr[i] === "'" && valuesStr[i+1] === "'") {
            current += "'"
            i += 2
          } else if (valuesStr[i] === "'") {
            i++
            break
          } else {
            current += valuesStr[i++]
          }
        }
      } else if (ch === ',' ) {
        row.push(current.trim() === 'NULL' ? null : current.trim())
        current = ''
        i++
      } else if (ch === ')') {
        row.push(current.trim() === 'NULL' ? null : current.trim())
        rows.push(row)
        i++
        // saltar coma y espacios entre filas
        while (i < len && (valuesStr[i] === ',' || valuesStr[i] === '\n' || valuesStr[i] === '\r' || valuesStr[i] === ' ')) i++
        break
      } else {
        current += ch
        i++
      }
    }
  }
  return rows
}

function extractSection(sql, tableName) {
  const insertRegex = new RegExp(`INSERT INTO ${tableName} \\([^)]+\\) VALUES\\s*([\\s\\S]*?);`, 'i')
  const match = sql.match(insertRegex)
  if (!match) return []
  return parseInsertValues(match[1])
}

function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function writeChunkedSql({ tableName, columns, rows, chunkSize, generatedAt }) {
  const chunks = chunkArray(rows, chunkSize)
  if (!chunks.length) return
  const title = tableName.charAt(0).toUpperCase() + tableName.slice(1)
  chunks.forEach((chunk, index) => {
    const part = index + 1
    const header = [
      '-- ============================================================',
      `-- IMPORTACIÓN KIOSCO → SUPABASE · ${title} (parte ${part}/${chunks.length})`,
      `-- Generado: ${generatedAt}`,
      `-- Filas importadas: ${chunk.length}`,
      '-- ============================================================',
      'BEGIN;',
      `INSERT INTO ${tableName} (${columns}) VALUES`,
      chunk.join(',\n'),
      'ON CONFLICT (id) DO NOTHING;',
      'COMMIT;',
      '',
    ]
    const filename = path.join(__dirname, `kiosco_supabase_${tableName}_part${part}.sql`)
    fs.writeFileSync(filename, header.join('\n'))
  })
  console.log(`  Generado ${chunks.length} archivo(s) para ${tableName}`)
}

// ── Main ──────────────────────────────────────────────────────────
console.log('Leyendo archivo...')
const sql = fs.readFileSync(INPUT_FILE, 'utf8')

// PRODUCTOS
console.log('Parseando productos...')
const productRows = extractSection(sql, 'products')
console.log(`  ${productRows.length} productos encontrados`)

// Mapa: old_id -> { new_id, purchase_price }
const productMap = new Map()
const productInserts = []
let productNum = 1

for (const row of productRows) {
  const [old_id, name, group_name, brand, purchase_price, sale_price, stock, min_stock, barcode, sales_count, created_date] = row
  if (!old_id || !name) continue

  const new_id = randomUUID()
  productMap.set(old_id, { new_id, purchase_price: parseFloat(purchase_price) || 0 })

  // Limpiar barcode (algunos tienen el nombre en vez del código)
  const cleanBarcode = barcode && /^\d+$/.test(barcode) ? barcode : null

  productInserts.push(
    `  (${escStr(new_id)}, ${escStr(name)}, ${escNum(purchase_price)}, ${escNum(sale_price)}, ${escNum(stock)}, ${escNum(min_stock)}, ${cleanBarcode ? escStr(cleanBarcode) : 'NULL'}, true, ${escStr(KIOSCO_STORE_ID)}, ${escStr(created_date || new Date().toISOString())})`
  )
  productNum++
}

// VENTAS
console.log('Parseando ventas...')
const saleRows = extractSection(sql, 'sales')
console.log(`  ${saleRows.length} ventas encontradas`)

// Mapa: old_sale_id -> { new_id, ... }
const saleMap = new Map()
for (const row of saleRows) {
  const [old_id] = row
  saleMap.set(old_id, { new_id: randomUUID(), row })
}

// SALE ITEMS
console.log('Parseando items de venta...')
const itemRows = extractSection(sql, 'sale_items')
console.log(`  ${itemRows.length} items encontrados`)

// Agrupar items por sale_id
const itemsBySale = new Map()
for (const row of itemRows) {
  const [sale_old_id, product_old_id, product_name, quantity, unit_price, subtotal] = row
  if (!sale_old_id) continue
  if (!itemsBySale.has(sale_old_id)) itemsBySale.set(sale_old_id, [])
  itemsBySale.get(sale_old_id).push({
    product_old_id,
    product_name,
    quantity: parseInt(quantity) || 1,
    unit_price: parseFloat(unit_price) || 0,
  })
}

// Construir inserts de ventas
const saleInserts = []
let saleCounter = 1

for (const [old_id, { new_id, row }] of saleMap) {
  const [, total, payment_method, , , is_credit, credit_customer, created_date] = row

  const items = itemsBySale.get(old_id) || []
  const itemsJson = items.map(item => {
    const prod = productMap.get(item.product_old_id)
    const new_product_id = prod?.new_id || null
    const purchase_price = prod?.purchase_price || 0
    return JSON.stringify({
      product_id: new_product_id,
      product_name: (item.product_name || '').trim(),
      quantity: item.quantity,
      unit_price: item.unit_price,
      purchase_price,
    })
  })

  const itemsJsonStr = `'[${itemsJson.join(',')}]'`
  const method = mapPaymentMethod(payment_method)
  const saleNumber = `K-${String(saleCounter).padStart(5, '0')}`
  const cashier = credit_customer ? credit_customer : 'Importado'
  const dateStr = created_date || new Date().toISOString()

  saleInserts.push(
    `  (${escStr(new_id)}, ${escNum(total)}, ${escStr(method)}, ${escStr(cashier)}, ${escStr(KIOSCO_STORE_ID)}, ${itemsJsonStr}::jsonb, ${escStr(dateStr)}, ${escStr(saleNumber)})`
  )
  saleCounter++
}

// ── Generar SQL final ─────────────────────────────────────────────
const generatedAt = new Date().toISOString()
console.log('Generando SQL...')

const output = `-- ============================================================
-- IMPORTACIÓN KIOSCO → SUPABASE
-- Generado: ${generatedAt}
-- Productos: ${productInserts.length}
-- Ventas: ${saleInserts.length}
-- Store ID: ${KIOSCO_STORE_ID}
-- ============================================================
-- INSTRUCCIONES:
-- 1. Abrí el SQL Editor de Supabase
-- 2. Pegá este archivo completo y ejecutá (si superás el límite, usá los archivos por partes).
-- 3. Verificá con: SELECT COUNT(*) FROM products WHERE store_id = '${KIOSCO_STORE_ID}';
--                  SELECT COUNT(*) FROM sales WHERE store_id = '${KIOSCO_STORE_ID}';
-- ============================================================

BEGIN;

-- ── PRODUCTOS ─────────────────────────────────────────────────────
INSERT INTO products (id, name, purchase_price, sale_price, current_stock, min_stock, barcode, active, store_id, created_at)
VALUES
${productInserts.join(',\n')}
ON CONFLICT (id) DO NOTHING;

-- ── VENTAS ────────────────────────────────────────────────────────
INSERT INTO sales (id, total, payment_method, cashier, store_id, items, created_at, sale_number)
VALUES
${saleInserts.join(',\n')}
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verificación rápida:
SELECT 'productos' as tabla, COUNT(*) FROM products WHERE store_id = '${KIOSCO_STORE_ID}'
UNION ALL
SELECT 'ventas', COUNT(*) FROM sales WHERE store_id = '${KIOSCO_STORE_ID}';
`

fs.writeFileSync(OUTPUT_FILE, output, 'utf8')
console.log(`
✓ Listo! Archivo generado: ${OUTPUT_FILE}`)
console.log(`  Productos: ${productInserts.length}`)
console.log(`  Ventas: ${saleInserts.length}`)

const productColumns = 'id, name, purchase_price, sale_price, current_stock, min_stock, barcode, active, store_id, created_at'
const saleColumns = 'id, total, payment_method, cashier, store_id, items, created_at, sale_number'
writeChunkedSql({ tableName: 'products', columns: productColumns, rows: productInserts, chunkSize: 120, generatedAt })
writeChunkedSql({ tableName: 'sales', columns: saleColumns, rows: saleInserts, chunkSize: 200, generatedAt })

const verifySql = `-- ============================================================
-- Verificación de importación
-- Generado: ${generatedAt}
-- ============================================================
SELECT 'productos' as tabla, COUNT(*) FROM products WHERE store_id = '${KIOSCO_STORE_ID}';
SELECT 'ventas' as tabla, COUNT(*) FROM sales WHERE store_id = '${KIOSCO_STORE_ID}';
`
const verifyPath = path.join(__dirname, 'kiosco_supabase_verify.sql')
fs.writeFileSync(verifyPath, verifySql, 'utf8')
console.log(`
✓ Scripts fragmentados generados en scripts/kiosco_supabase_*_part*.sql`)
console.log(`✓ Archivo de verificación: ${verifyPath}`)
console.log(`
Ejecutá primero los scripts de productos (kiosco_supabase_products_part*.sql) y luego los de ventas (kiosco_supabase_sales_part*.sql). Cuando termines, corré ${verifyPath.replace(/\\/g, '/')}.`)
