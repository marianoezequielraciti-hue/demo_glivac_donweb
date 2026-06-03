/**
 * Seed del tenant "Pescaderia"
 *
 * Uso: node deploy/seed_pescaderia.js
 *
 * Requiere variables de entorno: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * (Las mismas del archivo .env o deploy/9_env_production.env)
 *
 * Idempotente: si el usuario "Pescaderia" ya existe, el script termina sin error.
 */

import 'dotenv/config';
import { createPool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const pool = createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'glivac',
  decimalNumbers: true,
});

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Idempotencia: salir si el usuario ya existe ─────────────────────────
    const [[{ count }]] = await conn.query(
      "SELECT COUNT(*) as count FROM user_profiles WHERE username = 'Pescaderia'"
    );
    if (count > 0) {
      console.log('✓ El tenant Pescaderia ya existe. No se realizaron cambios.');
      await conn.rollback();
      return;
    }

    // ── 1. Store (tenant) ───────────────────────────────────────────────────
    const storeId = uuid();
    await conn.query(
      'INSERT INTO stores (id, name, type, active, created_at) VALUES (?, ?, ?, ?, NOW())',
      [storeId, 'Pescaderia', 'local', 1]
    );
    console.log(`✓ Store creado: ${storeId}`);

    // ── 2. Usuario ──────────────────────────────────────────────────────────
    const userId       = uuid();
    const passwordHash = await bcrypt.hash('Pescaderia', 12);
    const internalEmail = 'pescaderia@glivac.internal';

    await conn.query(
      'INSERT INTO users (id, email, encrypted_password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [userId, internalEmail, passwordHash]
    );
    console.log(`✓ Usuario creado: ${userId}`);

    // ── 3. Perfil (vincula usuario ↔ store) ─────────────────────────────────
    await conn.query(
      'INSERT INTO user_profiles (id, email, role, username, store_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, internalEmail, 'manager', 'Pescaderia', storeId]
    );
    console.log('✓ Perfil creado con rol=manager');

    // ── 4. Productos de muestra ─────────────────────────────────────────────
    const productos = [
      {
        name: 'Merluza x kg',
        category: 'Pescados',
        unit: 'kg',
        purchase_price: 1800,
        sale_price: 3200,
        current_stock: 30,
        min_stock: 5,
      },
      {
        name: 'Salmón x kg',
        category: 'Pescados',
        unit: 'kg',
        purchase_price: 5000,
        sale_price: 8500,
        current_stock: 15,
        min_stock: 3,
      },
      {
        name: 'Atún x kg',
        category: 'Pescados',
        unit: 'kg',
        purchase_price: 2500,
        sale_price: 4200,
        current_stock: 20,
        min_stock: 4,
      },
      {
        name: 'Camarón x kg',
        category: 'Mariscos',
        unit: 'kg',
        purchase_price: 4500,
        sale_price: 7500,
        current_stock: 10,
        min_stock: 2,
      },
      {
        name: 'Pulpo x kg',
        category: 'Mariscos',
        unit: 'kg',
        purchase_price: 3800,
        sale_price: 6500,
        current_stock: 8,
        min_stock: 2,
      },
      {
        name: 'Mejillones x kg',
        category: 'Mariscos',
        unit: 'kg',
        purchase_price: 1200,
        sale_price: 2200,
        current_stock: 25,
        min_stock: 5,
      },
      {
        name: 'Calamar x kg',
        category: 'Mariscos',
        unit: 'kg',
        purchase_price: 2000,
        sale_price: 3500,
        current_stock: 12,
        min_stock: 3,
      },
      {
        name: 'Filete de Brótola x kg',
        category: 'Filetes',
        unit: 'kg',
        purchase_price: 2200,
        sale_price: 3800,
        current_stock: 18,
        min_stock: 4,
      },
      {
        name: 'Filete de Lenguado x kg',
        category: 'Filetes',
        unit: 'kg',
        purchase_price: 3000,
        sale_price: 5200,
        current_stock: 12,
        min_stock: 3,
      },
      {
        name: 'Limón x unidad',
        category: 'Complementos',
        unit: 'unidad',
        purchase_price: 80,
        sale_price: 150,
        current_stock: 100,
        min_stock: 20,
      },
    ];

    for (const p of productos) {
      await conn.query(
        `INSERT INTO products
           (id, name, category, unit, purchase_price, sale_price,
            current_stock, min_stock, allow_negative_stock, active, store_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, NOW(), NOW())`,
        [uuid(), p.name, p.category, p.unit, p.purchase_price, p.sale_price,
         p.current_stock, p.min_stock, storeId]
      );
    }
    console.log(`✓ ${productos.length} productos creados`);

    await conn.commit();

    console.log('\n══════════════════════════════════════════════');
    console.log('  Tenant Pescaderia inicializado correctamente');
    console.log('  Login:     Pescaderia');
    console.log('  Password:  Pescaderia');
    console.log(`  Store ID:  ${storeId}`);
    console.log('══════════════════════════════════════════════\n');
  } catch (err) {
    await conn.rollback();
    console.error('✗ Error en el seed — rollback aplicado:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
