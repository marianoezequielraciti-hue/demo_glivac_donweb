-- ============================================================
-- SEED PESCADERIA — Pegar completo en phpMyAdmin → SQL
-- Password: Pescaderia (hasheada con bcrypt cost=12)
-- Idempotente: INSERT IGNORE no falla si ya existe
-- ============================================================

-- 1. Store (tenant de Pescaderia)
INSERT IGNORE INTO stores (id, name, type, active, created_at)
VALUES ('a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', 'Pescaderia', 'local', 1, NOW());

-- 2. Usuario (login por username "Pescaderia")
INSERT IGNORE INTO users (id, email, encrypted_password, created_at, updated_at)
VALUES ('f0e1d2c3-0002-4b5a-8967-a8b9c0d1e2f3', 'pescaderia@glivac.internal', '$2a$12$b9dfCZ3XJWDA5HKq8V6qIOqf4GyarnZzihG/dD4phn.TVzNnZjWqa', NOW(), NOW());

-- 3. Perfil: vincula usuario ↔ store con rol manager
INSERT IGNORE INTO user_profiles (id, email, role, username, store_id, created_at)
VALUES ('f0e1d2c3-0002-4b5a-8967-a8b9c0d1e2f3', 'pescaderia@glivac.internal', 'manager', 'Pescaderia', 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW());

-- 4. Productos de muestra vinculados al store de Pescaderia
INSERT IGNORE INTO products (id, name, category, unit, purchase_price, sale_price, current_stock, min_stock, allow_negative_stock, active, store_id, created_at, updated_at)
VALUES
  ('454eb7c0-8bed-412a-9aad-1ae51fd3e515', 'Merluza x kg',             'Pescados',     'kg',      1800,  3200, 30,  5, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('085e5c52-186c-489a-b6a2-ef136161c1ea', 'Salmón x kg',              'Pescados',     'kg',      5000,  8500, 15,  3, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('28cc8bd4-4d34-4618-b27d-3dae02a80efc', 'Atún x kg',                'Pescados',     'kg',      2500,  4200, 20,  4, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('742c2599-0c8f-48fe-9d3e-46a09ed49cf1', 'Camarón x kg',             'Mariscos',     'kg',      4500,  7500, 10,  2, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('60829bc8-0c33-4840-89bf-03bd79bcb1ae', 'Pulpo x kg',               'Mariscos',     'kg',      3800,  6500,  8,  2, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('79e058a5-197e-4e01-9dc8-cbb71368ef95', 'Mejillones x kg',          'Mariscos',     'kg',      1200,  2200, 25,  5, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('3ef2dc4e-0c3f-4c52-a302-97d9e0429144', 'Calamar x kg',             'Mariscos',     'kg',      2000,  3500, 12,  3, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('a01b2e6c-a527-493e-a8ce-d8a1996865fd', 'Filete de Brótola x kg',  'Filetes',      'kg',      2200,  3800, 18,  4, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('bb316b09-41d1-41e4-9723-7f9bbfdb0294', 'Filete de Lenguado x kg', 'Filetes',      'kg',      3000,  5200, 12,  3, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW()),
  ('2673725b-33f0-44b2-945d-a64683cfdea1', 'Limón x unidad',           'Complementos', 'unidad',    80,   150,100, 20, 0, 1, 'a1b2c3d4-0001-4e5f-a6b7-c8d9e0f1a2b3', NOW(), NOW());

-- ── Verificación — debe devolver 1 fila ───────────────────────────────────
SELECT u.email, p.username, p.role, s.name AS store_name, s.id AS store_id
FROM users u
JOIN user_profiles p ON p.id = u.id
JOIN stores s ON s.id = p.store_id
WHERE p.username = 'Pescaderia';
