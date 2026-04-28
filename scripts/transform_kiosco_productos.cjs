const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const INPUT_FILE = path.join(__dirname, '..', 'kiosco_export_2026-04-12.sql')
const OUTPUT_FILE = path.join(__dirname, 'kiosco_productos_limpio.sql')
const STORE_ID = 'bfda1f71-a7dd-4acb-aa06-6474b0c3380a'

function parseValues(valuesStr) {
  const rows = []
  let i = 0
  let len = valuesStr.length
  while (i < len) {
    while (i < len && valuesStr[i] !== '(') i++;
    if (i >= len) break;
    i++;
    const row = [];
    let buffer = '';
    let inString = false;
    while (i < len) {
      const ch = valuesStr[i];
      if (inString) {
        if (ch === "'" && valuesStr[i + 1] === "'") {
          buffer += "'";
          i += 2;
          continue;
        }
        if (ch === "'") {
          inString = false;
          i++;
          continue;
        }
        buffer += ch;
        i++;
        continue;
      }
      if (ch === "'") {
        inString = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(buffer.trim() === 'NULL' ? null : buffer.trim());
        buffer = '';
        i++;
        continue;
      }
      if (ch === ')') {
        row.push(buffer.trim() === 'NULL' ? null : buffer.trim());
        rows.push(row);
        buffer = '';
        i++;
        break;
      }
      buffer += ch;
      i++;
    }
  }
  return rows;
}

function extractProductRows(sql) {
  const match = sql.match(/INSERT INTO products \([^)]*\) VALUES\s*([\s\S]*);/i);
  if (!match) return [];
  return parseValues(match[1]);
}

function isNumericish(str) {
  if (!str) return false;
  return /^[0-9\s\-]+$/.test(str.trim());
}

function formatString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''").trim()}'`;
}

function formatTimestamp(value) {
  if (!value) return 'NOW()';
  return `'${value.replace(' ', 'T')}'::timestamptz`;
}

const sql = fs.readFileSync(INPUT_FILE, 'utf8');
const rows = extractProductRows(sql);
console.log(`Procesando ${rows.length} productos desde el export`);

const values = rows.map((row) => {
  const [oldId, rawName, groupName, brand, purchasePrice, salePrice, stock, minStock, rawBarcode, salesCount, createdDate] = row;
  if (!rawName && !rawBarcode) return null;
  let name = rawName || '';
  let barcode = rawBarcode || '';
  const nameLooksNumeric = isNumericish(name);
  const barcodeLooksNumeric = isNumericish(barcode);
  if (!barcodeLooksNumeric && nameLooksNumeric) {
    [name, barcode] = [barcode, name];
  }
  if (!barcode) barcode = null;
  if (!name) name = 'Sin nombre';
  const category = groupName && groupName !== 'NULL' ? groupName : 'Otros';
  const currentStock = Number(stock) || 0;
  const minStockVal = Number(minStock) || 0;
  const purchasePriceVal = Number(purchasePrice) || 0;
  const salePriceVal = Number(salePrice) || 0;
  const createdAt = createdDate || new Date().toISOString();
  return [
    formatString(randomUUID()),
    formatString(name),
    formatString(category),
    currentStock,
    minStockVal,
    purchasePriceVal,
    salePriceVal,
    formatString(barcode),
    `'${STORE_ID}'`,
    'true',
    'true',
    formatTimestamp(createdAt),
  ];
}).filter(Boolean);

const header = `-- ============================================================\n-- IMPORTACIÓN LIMPIA DE PRODUCTOS DEL KIOSCO\n-- Generado: ${new Date().toISOString()}\n-- Store ID: ${STORE_ID}\n-- ============================================================\nBEGIN;\nINSERT INTO products (id, name, category, current_stock, min_stock, purchase_price, sale_price, barcode, store_id, active, allow_negative_stock, created_at) VALUES\n`;
const footer = '\nON CONFLICT (store_id, barcode) DO NOTHING;\nCOMMIT;\n';
const payload = values.map(v => `  (${v.join(', ')})`).join(',\n');
fs.writeFileSync(OUTPUT_FILE, `${header}${payload}${footer}`, 'utf8');
console.log(`Archivo generado: ${OUTPUT_FILE} (${values.length} filas)`);
