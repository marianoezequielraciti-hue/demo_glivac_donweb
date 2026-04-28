const fs = require('fs')
const path = require('path')

const INPUT_FILE = path.join(__dirname, 'kiosco_supabase.sql')
const STORE_ID = 'bfda1f71-a7dd-4acb-aa06-6474b0c3380a'

function extractSection(sql, tableName) {
  const marker = `INSERT INTO ${tableName}`
  const insertIdx = sql.indexOf(marker)
  if (insertIdx === -1) return ''
  const valuesIdx = sql.indexOf('VALUES', insertIdx)
  if (valuesIdx === -1) return ''
  const onConflictIdx = sql.indexOf('ON CONFLICT', valuesIdx)
  if (onConflictIdx === -1) return ''
  return sql.slice(valuesIdx + 'VALUES'.length, onConflictIdx)
}

function splitRows(valuesStr) {
  const rows = []
  let buffer = ''
  let depth = 0
  let inString = false
  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i]
    buffer += ch
    if (ch === "'") {
      if (inString && valuesStr[i + 1] === "'") {
        buffer += "'"
        i++
        continue
      }
      inString = !inString
    } else if (!inString) {
      if (ch === '(') {
        depth++
      } else if (ch === ')') {
        depth--
        if (depth === 0) {
          rows.push(buffer.trim())
          buffer = ''
          while (i + 1 < valuesStr.length && [',', '\n', '\r', ' '].includes(valuesStr[i + 1])) {
            i++
          }
        }
      }
    }
  }
  return rows
}

function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function writeChunks({ tableName, columns, rows, chunkSize, generatedAt }) {
  const chunks = chunkArray(rows, chunkSize)
  if (!chunks.length) return
  const title = tableName.charAt(0).toUpperCase() + tableName.slice(1)
  chunks.forEach((chunk, index) => {
    const part = index + 1
    const valuesBlock = chunk.map(row => `  ${row}`).join(',\\n')
    const content = [
      '-- ============================================================',
      `-- IMPORTACIÓN KIOSCO → SUPABASE · ${title} (parte ${part}/${chunks.length})`,
      `-- Generado: ${generatedAt}`,
      `-- Filas importadas: ${chunk.length}`,
      '-- ============================================================',
      'BEGIN;',
      `INSERT INTO ${tableName} (${columns}) VALUES`,
      valuesBlock,
      'ON CONFLICT (id) DO NOTHING;',
      'COMMIT;',
      '',
    ].join('\n')
    const filename = path.join(__dirname, `kiosco_supabase_${tableName}_part${part}.sql`)
    fs.writeFileSync(filename, content)
  })
  console.log(`  Generado ${chunks.length} archivo(s) para ${tableName}`)
}

const sql = fs.readFileSync(INPUT_FILE, 'utf8')
const generatedAt = new Date().toISOString()

const productSection = extractSection(sql, 'products')
const saleSection = extractSection(sql, 'sales')

const productRows = splitRows(productSection)
const saleRows = splitRows(saleSection)
console.log(`Encontrados ${productRows.length} productos y ${saleRows.length} ventas para dividir`)

writeChunks({
  tableName: 'products',
  columns: 'id, name, purchase_price, sale_price, current_stock, min_stock, barcode, active, store_id, created_at',
  rows: productRows,
  chunkSize: 120,
  generatedAt,
})

writeChunks({
  tableName: 'sales',
  columns: 'id, total, payment_method, cashier, store_id, items, created_at, sale_number',
  rows: saleRows,
  chunkSize: 200,
  generatedAt,
})

const verifySql = `-- ============================================================
-- Verificación de importación
-- Generado: ${generatedAt}
-- ============================================================
SELECT 'productos' as tabla, COUNT(*) FROM products WHERE store_id = '${STORE_ID}';
SELECT 'ventas' as tabla, COUNT(*) FROM sales WHERE store_id = '${STORE_ID}';
`
const verifyPath = path.join(__dirname, 'kiosco_supabase_verify.sql')
fs.writeFileSync(verifyPath, verifySql)
console.log(`\n✓ Archivo de verificación: ${verifyPath}`)
console.log('Ejecutá primero los archivos de productos y luego los de ventas. Al final corré el script de verificación.')
