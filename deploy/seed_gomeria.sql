-- ============================================================
-- SEED GOMERIA — Pegar completo en phpMyAdmin → SQL
-- Password: Gomeria (hasheada con bcrypt cost=12)
-- Idempotente: INSERT IGNORE no falla si ya existe
-- ============================================================

-- 1. Store (tenant de Gomeria)
INSERT IGNORE INTO stores (id, name, type, active, created_at)
VALUES ('59784827-538c-4f40-b8f5-8c751ddb82ce', 'Gomeria', 'local', 1, NOW());

-- 2. Usuario (login por username "Gomeria")
INSERT IGNORE INTO users (id, email, encrypted_password, created_at, updated_at)
VALUES ('4ffaba9c-6c36-40fc-8fc2-bdd046ae9cf0', 'gomeria@glivac.internal', '$2a$12$N25bVocu2qAW4VkPvUZFoueS8eKvP0Yie6rxdCEB9yngjliKxGTCi', NOW(), NOW());

-- 3. Perfil: vincula usuario ↔ store con rol manager
INSERT IGNORE INTO user_profiles (id, email, role, username, store_id, created_at)
VALUES ('4ffaba9c-6c36-40fc-8fc2-bdd046ae9cf0', 'gomeria@glivac.internal', 'manager', 'Gomeria', '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW());

-- 4. Productos de muestra vinculados al store de Gomeria
INSERT IGNORE INTO products (id, name, category, unit, purchase_price, sale_price, current_stock, min_stock, allow_negative_stock, active, store_id, created_at, updated_at)
VALUES
  ('2cf6c372-e6b2-426c-b9fc-1f8fdd0e6ad7', 'Neumático Rodado 15',     'Neumáticos', 'unidad', 30000, 45000, 10,  2, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW()),
  ('4842bc5b-afea-4256-94a8-1edbf630405f', 'Neumático Rodado 17',     'Neumáticos', 'unidad', 38000, 56000,  8,  2, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW()),
  ('aa26596c-640f-4c5d-855d-c42df61d2256', 'Cámara Rodado 15',        'Cámaras',    'unidad',  5500,  8500, 20,  4, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW()),
  ('ddbb6987-2e6c-4e8b-9f48-1322c787a01c', 'Parche Vulcanizado Grande','Reparación', 'unidad',   700,  1200, 50, 10, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW()),
  ('e296ffed-57fb-44b2-87ab-4a7073671e3f', 'Válvula TR-4',            'Accesorios', 'unidad',   150,   350,100, 20, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW()),
  ('4de9e73a-738b-4ffa-a3eb-1778258202a0', 'Líquido Sellador 500ml',  'Accesorios', 'unidad',  2200,  3500, 15,  3, 0, 1, '59784827-538c-4f40-b8f5-8c751ddb82ce', NOW(), NOW());

-- ── Verificación — debe devolver 1 fila ───────────────────────────────────
SELECT u.email, p.username, p.role, s.name AS store_name, s.id AS store_id
FROM users u
JOIN user_profiles p ON p.id = u.id
JOIN stores s ON s.id = p.store_id
WHERE p.username = 'Gomeria';
