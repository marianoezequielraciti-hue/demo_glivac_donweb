import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const ALLOWED_TABLES = new Set([
  'stores', 'user_profiles', 'products', 'clients', 'sales', 'budgets',
  'expenses', 'client_account_entries', 'purchases', 'fiados',
  'shift_logs', 'open_shifts',
]);

// JSON columns per table (need JSON.stringify before insert/update)
const JSON_COLS = {
  sales:     ['items'],
  budgets:   ['items'],
  purchases: ['items'],
};

function jsonCols(table) { return JSON_COLS[table] || []; }

// mysql2 devuelve columnas JSON como string — parsear explícitamente
function parseJsonCols(table, row) {
  if (!row) return row;
  for (const col of jsonCols(table)) {
    if (typeof row[col] === 'string') {
      try { row[col] = JSON.parse(row[col]); } catch {}
    }
  }
  return row;
}

function parseJsonRows(table, rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => parseJsonCols(table, r));
}

// ── Query param → SQL WHERE builder ───────────────────────────────────────
// Supported suffixes: __eq (default), __gte, __lte, __gt, __lt, __in, __ilike, __is, __neq
function buildWhere(query, params = []) {
  const conditions = [];
  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'upsert']);

  for (const [key, rawVal] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;
    const lastDunder = key.lastIndexOf('__');
    let col, op;
    if (lastDunder === -1) { col = key; op = 'eq'; }
    else { col = key.slice(0, lastDunder); op = key.slice(lastDunder + 2); }

    // Sanitize column name (only word chars and dots)
    if (!/^[\w.]+$/.test(col)) continue;

    const val = rawVal === 'null' ? null : rawVal;

    switch (op) {
      case 'eq':    conditions.push(`\`${col}\` = ?`);                params.push(val); break;
      case 'neq':   conditions.push(`\`${col}\` != ?`);               params.push(val); break;
      case 'gte':   conditions.push(`\`${col}\` >= ?`);               params.push(val); break;
      case 'lte':   conditions.push(`\`${col}\` <= ?`);               params.push(val); break;
      case 'gt':    conditions.push(`\`${col}\` > ?`);                params.push(val); break;
      case 'lt':    conditions.push(`\`${col}\` < ?`);                params.push(val); break;
      case 'ilike': conditions.push(`\`${col}\` LIKE ?`);             params.push(val); break;
      case 'is':
        if (val === null) conditions.push(`\`${col}\` IS NULL`);
        else { conditions.push(`\`${col}\` = ?`); params.push(val); }
        break;
      case 'in': {
        const vals = String(val).split(',').map(v => v.trim());
        conditions.push(`\`${col}\` IN (${vals.map(() => '?').join(',')})`);
        params.push(...vals);
        break;
      }
    }
  }

  return conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
}

function buildOrder(orderParam) {
  if (!orderParam) return '';
  const col = orderParam.startsWith('-') ? orderParam.slice(1) : orderParam;
  if (!/^[\w]+$/.test(col)) return '';
  const dir = orderParam.startsWith('-') ? 'DESC' : 'ASC';
  return ` ORDER BY \`${col}\` ${dir}`;
}

function prepareRow(table, row) {
  const out = { ...row };
  for (const col of jsonCols(table)) {
    if (out[col] !== undefined && typeof out[col] !== 'string') {
      out[col] = JSON.stringify(out[col]);
    }
  }
  return out;
}

// ── GET /api/:table ────────────────────────────────────────────────────────
router.get('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(404).json({ error: 'Tabla no encontrada' });

  const params = [];
  const where  = buildWhere(req.query, params);
  const order  = buildOrder(req.query.order);
  const limit  = req.query.limit ? ` LIMIT ${parseInt(req.query.limit)}` : '';
  const offset = req.query.offset ? ` OFFSET ${parseInt(req.query.offset)}` : '';

  try {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\`` + where + order + limit + offset, params);
    res.json(parseJsonRows(table, rows));
  } catch (err) {
    console.error(`GET ${table}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/:table ───────────────────────────────────────────────────────
router.post('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(404).json({ error: 'Tabla no encontrada' });

  const isUpsert = req.query.upsert === '1';
  const rows     = Array.isArray(req.body) ? req.body : [req.body];

  try {
    const ids = [];
    for (const rawRow of rows) {
      const row = prepareRow(table, rawRow);
      if (!row.id) row.id = uuid();
      ids.push(row.id);

      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map(() => '?').join(', ');
      const colList      = cols.map(c => `\`${c}\``).join(', ');

      let sql;
      if (isUpsert) {
        const updates = cols.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
        sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
      } else {
        sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`;
      }

      await pool.query(sql, vals);
    }

    // Devolver fila insertada solo si es inserción simple (no batch masivo)
    if (ids.length === 1) {
      const [[fresh]] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [ids[0]]);
      return res.status(201).json(parseJsonCols(table, fresh) || { id: ids[0] });
    }

    res.status(201).json({ inserted: ids.length });
  } catch (err) {
    console.error(`POST ${table}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/:table ──────────────────────────────────────────────────────
router.patch('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(404).json({ error: 'Tabla no encontrada' });

  const row    = prepareRow(table, req.body);
  const params = [];
  const where  = buildWhere(req.query, params);

  if (!where) return res.status(400).json({ error: 'Se requiere al menos un filtro para UPDATE' });

  const setCols   = Object.keys(row);
  const setVals   = Object.values(row);
  const setClause = setCols.map(c => `\`${c}\` = ?`).join(', ');

  try {
    await pool.query(`UPDATE \`${table}\` SET ${setClause} WHERE 1=1` + where.replace(' WHERE ', ' AND '), [...setVals, ...params]);
    res.json({ ok: true });
  } catch (err) {
    console.error(`PATCH ${table}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/:table ─────────────────────────────────────────────────────
router.delete('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(404).json({ error: 'Tabla no encontrada' });

  const params = [];
  const where  = buildWhere(req.query, params);
  if (!where) return res.status(400).json({ error: 'Se requiere al menos un filtro para DELETE' });

  try {
    await pool.query(`DELETE FROM \`${table}\`` + where, params);
    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE ${table}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
