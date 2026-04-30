# GLIVAC — Migración DonWeb: Instrucciones paso a paso

## Arquitectura final

```
Internet → Nginx (443 HTTPS) ──┬── /dist (Vite SPA estática)
                                ├── /auth/v1/  → Kong :8000 → GoTrue (Auth)
                                └── /rest/v1/  → Kong :8000 → PostgREST (DB API)
                                                      ↓
                                               PostgreSQL :5432
```

---

## PASO 1 — Preparar el servidor DonWeb

```bash
# Conectarse por SSH
ssh root@IP_DEL_SERVIDOR_DONWEB

# Subir y ejecutar el script de setup
curl -O https://raw.githubusercontent.com/marianoezequielraciti-hue/demo_glivac_donweb/main/deploy/1_setup_server.sh
bash 1_setup_server.sh
```

---

## PASO 2 — Configurar Supabase self-hosted

```bash
# Crear estructura de directorios
mkdir -p /opt/glivac/supabase
mkdir -p /opt/glivac/secrets
cd /opt/glivac/supabase

# Copiar archivos del repo
cp /ruta/deploy/2_supabase_docker_compose.yml docker-compose.yml
cp /ruta/deploy/5_kong.yml kong.yml
cp /ruta/deploy/6_init_database.sql init.sql
cp /ruta/deploy/3_supabase.env .env
```

---

## PASO 3 — Generar claves JWT

```bash
# Generar JWT_SECRET y claves anon/service_role
bash /ruta/deploy/4_generate_jwt_keys.sh

# Copiar los valores generados al .env de Supabase
nano /opt/glivac/supabase/.env
# Completar: JWT_SECRET, POSTGRES_PASSWORD, ANON_KEY, SERVICE_ROLE_KEY, etc.
```

---

## PASO 4 — Levantar Supabase

```bash
cd /opt/glivac/supabase

# Reemplazar ${SUPABASE_ANON_KEY} y ${SUPABASE_SERVICE_ROLE_KEY} en kong.yml
# con los valores reales del .env antes de arrancar
sed -i "s/\${SUPABASE_ANON_KEY}/$(grep ANON_KEY .env | cut -d= -f2)/" kong.yml
sed -i "s/\${SUPABASE_SERVICE_ROLE_KEY}/$(grep SERVICE_ROLE_KEY .env | cut -d= -f2)/" kong.yml

# Arrancar todos los servicios
docker compose up -d

# Verificar que todos los contenedores estén healthy
docker compose ps

# Verificar que el schema se creó correctamente
docker compose exec db psql -U postgres -c "\dt"
# Debería listar: stores, products, sales, budgets, etc.
```

---

## PASO 5 — Configurar .env.production del frontend

```bash
mkdir -p /opt/glivac/secrets

# Crear el archivo con las variables (ver archivo 9_env_production.env)
nano /opt/glivac/secrets/.env.production

# Pegar el contenido y completar:
# VITE_SUPABASE_URL=https://glivac.online
# VITE_SUPABASE_ANON_KEY=<valor generado en paso 3>
```

---

## PASO 6 — Build y deploy del frontend

```bash
# Crear directorio de la app
mkdir -p /opt/glivac/app

# Ejecutar deploy
bash /ruta/deploy/8_deploy_app.sh
```

---

## PASO 7 — Configurar Nginx

```bash
# Copiar config de Nginx
cp /ruta/deploy/7_nginx_glivac.conf /etc/nginx/sites-available/glivac.online

# Activar el sitio
ln -sf /etc/nginx/sites-available/glivac.online /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis
nginx -t

# Obtener certificado SSL (el DNS de glivac.online ya debe apuntar al servidor)
certbot --nginx -d glivac.online -d www.glivac.online \
  --email admin@glivac.online \
  --agree-tos \
  --non-interactive

# Recargar Nginx con SSL
systemctl reload nginx
```

---

## PASO 8 — Registrar el primer usuario admin

```bash
# La app NO tiene registro público habilitado por defecto.
# Crear el primer admin directamente en PostgreSQL:

docker compose -f /opt/glivac/supabase/docker-compose.yml exec db \
  psql -U postgres -c "
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      role, aud, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'admin@glivac.online',
      crypt('TU_PASSWORD_AQUI', gen_salt('bf')),
      now(), 'authenticated', 'authenticated', now(), now()
    );
  "

# Luego en user_profiles:
docker compose -f /opt/glivac/supabase/docker-compose.yml exec db \
  psql -U postgres -c "
    INSERT INTO user_profiles (id, email, role)
    SELECT id, email, 'admin'
    FROM auth.users
    WHERE email = 'admin@glivac.online'
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  "
```

---

## PASO 9 — Migrar datos de Supabase Cloud (si hay datos en producción)

```bash
# En tu máquina local, exportar datos de Supabase Cloud:
# (Requiere psql y las credenciales de Supabase Cloud)

pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --data-only \
  --table=stores \
  --table=products \
  --table=sales \
  --table=expenses \
  --table=purchases \
  --table=fiados \
  --table=clients \
  --table=budgets \
  --table=client_account_entries \
  --table=shift_logs \
  -f glivac_data_export.sql

# Subir al servidor DonWeb
scp glivac_data_export.sql root@IP_SERVIDOR:/opt/glivac/

# En el servidor, importar los datos
docker compose -f /opt/glivac/supabase/docker-compose.yml exec -T db \
  psql -U postgres < /opt/glivac/glivac_data_export.sql
```

---

## PASO 10 — Mantenimiento y actualizaciones

```bash
# Actualizar la app con nuevo código del repo
bash /opt/glivac/app/deploy/8_deploy_app.sh

# Ver logs de Supabase
docker compose -f /opt/glivac/supabase/docker-compose.yml logs -f

# Reiniciar Supabase completo
docker compose -f /opt/glivac/supabase/docker-compose.yml restart

# Renovación automática de SSL (Certbot la configura automáticamente via cron)
# Verificar: systemctl status certbot.timer
```

---

## Verificación final

| Check | Comando |
|---|---|
| Nginx corriendo | `systemctl status nginx` |
| Docker containers activos | `docker compose ps` |
| SSL válido | `curl -I https://glivac.online` |
| Auth funcionando | `curl https://glivac.online/auth/v1/health` |
| REST API funcionando | `curl -H "apikey: TU_ANON_KEY" https://glivac.online/rest/v1/stores` |
| App cargando | Abrir `https://glivac.online` en el navegador |

---

## DNS (configurar en DonWeb antes del paso 7)

| Tipo | Nombre | Valor |
|---|---|---|
| A | @ | IP_DEL_SERVIDOR |
| A | www | IP_DEL_SERVIDOR |

La propagación DNS puede tardar hasta 48hs. Podés verificar con: `dig glivac.online`
