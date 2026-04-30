# GLIVAC — Deploy en Hostinger (Node.js + MySQL)

## Arquitectura

```
Hostinger Node.js App
  ├── Express server (server.js) — Puerto 3000
  │     ├── /api/auth/*   → autenticación JWT propia
  │     ├── /api/*        → CRUD MySQL
  │     └── /*            → SPA Vite (dist/)
  └── MySQL Hostinger
        └── base de datos glivac
```

---

## PASO 1 — Crear la base de datos MySQL

En hPanel → **Bases de datos** → **Administrar** → phpMyAdmin:

1. Seleccioná la base de datos del proyecto (o creá una nueva)
2. Ir a pestaña **SQL**
3. Copiar y ejecutar todo el contenido de `deploy/mysql_schema.sql`
4. Verificar que se crearon las tablas: stores, users, user_profiles, products, etc.

---

## PASO 2 — Crear la App Node.js en Hostinger

En hPanel → **Sitios web** → **Agregar sitio web** → **App web Node.js**:

| Campo | Valor |
|---|---|
| Dominio | `glivac.online` |
| Node.js version | `20.x` |
| Repository | `marianoezequielraciti-hue/demo_glivac_donweb` |
| Branch | `main` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |

---

## PASO 3 — Configurar variables de entorno

En la App Node.js → **Variables de entorno**, agregar:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=<usuario mysql de hostinger>
DB_PASSWORD=<password mysql>
DB_NAME=<nombre base de datos>
JWT_SECRET=<generar con openssl rand -base64 64>
NODE_ENV=production
PORT=3000
```

> **Importante**: Las variables VITE_* no son necesarias en esta arquitectura
> porque la app ya no usa Supabase Cloud.

---

## PASO 4 — Primer deploy

En la App Node.js → **Deploy** (o se dispara automáticamente al conectar el repo).

Hostinger ejecuta:
1. `npm ci` — instala dependencias
2. `npm run build` — compila el frontend con Vite → genera `dist/`
3. `npm start` → arranca `server.js` (Express)

---

## PASO 5 — Crear el primer usuario admin

Conectarse a phpMyAdmin y ejecutar:

```sql
-- 1. Insertar el usuario (contraseña hasheada con bcrypt rounds=12)
-- Generar el hash en: https://bcrypt-generator.com (rounds: 12)
-- O ejecutar en Node local: node -e "const b=require('bcryptjs');console.log(b.hashSync('TU_PASSWORD',12))"

INSERT INTO users (id, email, encrypted_password)
VALUES (
  UUID(),
  'tu@email.com',
  '$2a$12$HASH_GENERADO_AQUI'
);

-- 2. Insertar el perfil admin
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM users
WHERE email = 'tu@email.com';
```

> **Tip**: En la terminal local podés generar el hash con:
> ```bash
> node -e "const b=require('bcryptjs'); console.log(b.hashSync('TU_PASSWORD', 12))"
> ```

---

## PASO 6 — Verificación

| Check | URL |
|---|---|
| App cargando | `https://glivac.online` |
| Login funcionando | Ingresar con el usuario creado en paso 5 |
| API respondiendo | `https://glivac.online/api/stores` (devuelve 401 sin token — correcto) |

---

## Mantenimiento

```bash
# Actualizar la app con nuevo código
# En Hostinger: App Node.js → Deploy (o push al repo dispara auto-deploy)

# Ver logs
# En hPanel → App Node.js → Logs
```
