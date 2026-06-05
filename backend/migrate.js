import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Split a SQL file into individual statements, skipping blanks/comments
function splitStatements(sql) {
  return sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 0);
}

async function runMigration(name, filePath) {
  const sql = readFileSync(filePath, 'utf8');
  const statements = splitStatements(sql);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  await pool.query(
    'INSERT IGNORE INTO schema_migrations (name) VALUES (?)',
    [name]
  );
  console.log(`[migrate] Applied: ${name}`);
}

export async function runMigrations() {
  // Ensure migrations tracker table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [applied] = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  const migrations = [
    { name: 'migration_v2', file: join(ROOT, 'deploy/migration_v2.sql') },
    { name: 'migration_v3', file: join(ROOT, 'deploy/migration_v3.sql') },
    { name: 'migration_v4', file: join(ROOT, 'deploy/migration_v4.sql') },
  ];

  for (const { name, file } of migrations) {
    if (appliedSet.has(name)) continue;
    try {
      await runMigration(name, file);
    } catch (err) {
      // If the migration partially failed due to IF NOT EXISTS safety, still log it
      console.error(`[migrate] Error in ${name}:`, err.message);
      throw err;
    }
  }

  console.log('[migrate] All migrations up to date.');
}
