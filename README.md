# Glivac Demo

README tecnico del sistema actual.

## 1. Resumen ejecutivo

Este proyecto es una aplicacion web de gestion comercial para **Glivac Demo**, construida con:

- `React 18` + `Vite`
- `React Router`
- `@tanstack/react-query`
- `Tailwind CSS`
- `Supabase` como backend, auth y base de datos
- `Vercel Functions` para operaciones administrativas seguras
- `XLSX` para importacion/exportacion
- Integraciones opcionales con IA:
  - `Anthropic` para escaneo de facturas
  - `Google Gemini` para insights en reportes

El sistema ya no es solo un POS simple: hoy contempla inventario, compras, ventas, gastos, fiados, reportes, usuarios/roles y operacion multi-negocio mediante `store_id`.

## Demo-ready

Para una demo nueva, la base recomendada desde ahora es:

1. Ejecutar [supabase/demo_bootstrap.sql](/Users/matiasvazquez/Documents/Glivac-demo/supabase/demo_bootstrap.sql:1) en Supabase.
2. Configurar variables cliente y servidor usando [.env.example](/Users/matiasvazquez/Documents/Glivac-demo/.env.example:1).
3. Deployar en Vercel con el rewrite SPA y las rutas `/api` habilitadas desde [vercel.json](/Users/matiasvazquez/Documents/Glivac-demo/vercel.json:1).
4. Crear usuarios demo desde `Config`, que ahora usa una API serverless en lugar de exponer permisos admin en el frontend.

## 2. Estado actual del sistema

El repo muestra una evolucion en etapas:

1. Se creo una base inicial simple con `products`, `sales`, `expenses`, `purchases` y `user_profiles`.
2. Luego se agregaron roles, correcciones de RLS y capacidades administrativas.
3. Despues se incorporo soporte multi-negocio con tabla `stores` y columna `store_id`.
4. Finalmente se sumaron `fiados`, `shift_logs`, importaciones masivas y reportes avanzados.

Importante: la ruta recomendada para una base nueva ya no usa migraciones incrementales. Ahora el punto de entrada es [supabase/demo_bootstrap.sql](/Users/matiasvazquez/Documents/Glivac-demo/supabase/demo_bootstrap.sql:1).

## 3. Alcance funcional

### Modulos principales

- `Dashboard`
  - KPIs rapidos de ventas, ingresos, ganancia y stock bajo.
  - Vista reducida para empleados y vista ampliada para admins.

- `Punto de venta`
  - Apertura de turno.
  - Venta con carrito.
  - Multiples medios de pago: `efectivo`, `transferencia`, `qr`, `tarjeta`, `fiado`.
  - Descuento de stock al vender.
  - Cierre de turno con arqueo.
  - Guarda resumen de cierre en `shift_logs`.

- `Productos`
  - Alta, baja, edicion.
  - Validacion de barcode.
  - Importacion/exportacion Excel.
  - Control de stock minimo.
  - Fecha de vencimiento.
  - Soporte por negocio (`store_id`).
  - Promociones sugeridas persistidas en `localStorage`.

- `Compras`
  - Registro manual o importado desde Excel.
  - Incrementa stock.
  - Actualiza precio de compra del producto.
  - Muestra proximos vencimientos desde items comprados.

- `Ventas`
  - Historial tabular.
  - Filtro simple por texto.
  - Exportacion a Excel.

- `Gastos`
  - Alta, edicion y eliminacion.
  - Clasificacion por categoria y tipo.
  - Visible principalmente para admins.

- `Fiados`
  - Registro automatico desde POS cuando el medio de pago es `fiado`.
  - Seguimiento de pendientes y pagos.
  - Marcado de cobro con medio de pago.

- `Reportes`
  - KPIs financieros.
  - Series por dia, hora, metodo de pago, rotacion, canasta, stock critico, rendimiento por cajero.
  - Filtro global o por negocio.
  - Generacion opcional de insights con Gemini.
  - Puede sugerir promociones que se guardan en `localStorage`.

- `Scanner`
  - Sube una imagen de factura/remito.
  - Usa Anthropic para extraer items.
  - Permite exportar esos items a Excel para luego importarlos en compras.

- `Configuracion`
  - Invitacion de usuarios.
  - Cambio de roles.
  - Backup multi-hoja a Excel.
  - Borrado masivo de datos operativos.

## 4. Arquitectura tecnica

### Frontend

- SPA en `React`.
- Router principal en [src/App.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/App.jsx).
- Bootstrap en [src/main.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/main.jsx).
- Layout comun en [src/components/Layout.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/components/Layout.jsx).
- Proteccion de acceso en [src/components/ProtectedRoute.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/components/ProtectedRoute.jsx).

### Estado y datos

- `React Query` se usa para lecturas/caches de tablas Supabase.
- Mutaciones manuales en cada pagina.
- No hay una capa de servicios centralizada: cada modulo consulta Supabase directamente.

### Auth y permisos

- Proveedor de auth en [src/hooks/useAuth.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/hooks/useAuth.jsx).
- Login por email/password contra `supabase.auth.signInWithPassword`.
- Rol resuelto desde `user_profiles`.
- Cache local de rol, nombre visible y sucursal.
- Fallback administrativo por variable `VITE_SUPABASE_ADMIN_EMAILS`.

### Multi-negocio

- Filtro de sucursal en [src/hooks/useStoreFilter.js](/Users/matiasvazquez/Documents/Glivac-demo/src/hooks/useStoreFilter.js).
- Guardia para altas/ABM en [src/hooks/useStoreGuard.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/hooks/useStoreGuard.jsx).
- Logica general:
  - Empleado: opera solo sobre su `store_id`.
  - Admin: puede ver todo o seleccionar negocio.

## 5. Estructura del repo

```text
.
├── src/
│   ├── components/        UI compartida y componentes del POS
│   ├── hooks/             auth, filtros de store, reportes
│   ├── lib/               cliente Supabase, Excel, promociones
│   ├── pages/             modulos funcionales / pantallas
│   ├── App.jsx            router principal
│   └── main.jsx           entrypoint
├── supabase/              schema base + fixes/migraciones manuales
├── scripts/               SQL y utilidades para importacion del kiosco
├── generate_sales_sql.mjs utilitario de generacion SQL
├── vercel.json            rewrite para SPA
└── netlify.toml           build + redirect para SPA
```

## 6. Base de datos

### 6.1 Bootstrap vigente

El archivo [supabase/demo_bootstrap.sql](/Users/matiasvazquez/Documents/Glivac-demo/supabase/demo_bootstrap.sql:1) crea desde cero:

- `app_roles`
- `stores`
- `user_profiles`
- `products`
- `sales`
- `expenses`
- `purchases`
- `fiados`
- `shift_logs`
- `open_shifts`

Tambien crea:

- indices
- helper functions para auth y permisos
- RLS limpia
- catálogo de roles de demo

### 6.2 Roles de demo

La base nueva queda preparada con estos roles:

- `owner`
- `admin`
- `manager`
- `cashier`
- `inventory`
- `analyst`
- `employee`

`owner` y `admin` son roles globales. El resto son roles asociados a un `store_id`.

### 6.3 SQL legacy

Los scripts anteriores quedaron movidos a [supabase/legacy](/Users/matiasvazquez/Documents/Glivac-demo/supabase/legacy:1) solo como referencia histórica.
No son necesarios para una instalación nueva.

### 6.4 Modelo funcional real

Tablas principales:

- `products`
  - Catalogo por negocio.
  - Stock, precios, barcode, vencimiento.

- `sales`
  - Cabecera de venta.
  - `items` se guarda como `jsonb`.

- `purchases`
  - Cabecera de compra.
  - `items` se guarda como `jsonb`.

- `expenses`
  - Gasto manual o asociado a compra.

- `fiados`
  - Credito a clientes.

- `user_profiles`
  - Rol, email, nombre visible y negocio asignado.

- `stores`
  - Negocios activos.

- `shift_logs`
  - Cierres de caja/turno.
  - Referenciado por frontend, pero no encontre su DDL principal en `supabase/`.

## 7. Setup recomendado

### 7.1 Variables de entorno

Basado en [.env.example](/Users/matiasvazquez/Documents/Glivac-demo/.env.example):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_SUPABASE_ADMIN_EMAILS=
```

Variable adicional detectada en reportes:

```env
VITE_GOOGLE_AI_STUDIO_API_KEY=
```

Notas:

- `VITE_ANTHROPIC_API_KEY` es necesaria para `Scanner`.
- `VITE_GOOGLE_AI_STUDIO_API_KEY` es necesaria para insights IA en `Reportes`.
- `VITE_SUPABASE_ADMIN_EMAILS` funciona como fallback de admins por email.
- `SUPABASE_SERVICE_ROLE_KEY` se usa solo en las Vercel Functions para altas y administración de usuarios.

### 7.2 Instalacion local

```bash
npm install
npm run dev
```

### 7.3 Build

```bash
npm run build
```

No hay scripts de test ni lint declarados actualmente en `package.json`.

## 8. Orden sugerido de provisionamiento de Supabase

Para un entorno nuevo, el orden mas razonable hoy seria:

1. Ejecutar `supabase/demo_bootstrap.sql`
2. Configurar variables de entorno cliente y servidor
3. Crear el primer usuario global (`owner` o `admin`) en Supabase Auth y su fila en `user_profiles`
4. Administrar el resto desde la propia demo
6. Ejecutar `scripts/00_fix_barcode_unique_per_store.sql`
7. Ejecutar scripts de asignacion de `store_id` si hay datos historicos
8. Verificar manualmente la existencia de `shift_logs`

Observacion: este orden es una reconstruccion tecnica a partir del repo. No existe hoy una migracion unica, versionada y canonica.

## 9. Importacion/exportacion y utilidades

### Excel

En [src/lib/xlsxUtils.js](/Users/matiasvazquez/Documents/Glivac-demo/src/lib/xlsxUtils.js) estan centralizados:

- export simple a una hoja
- export multi-hoja
- import desde XLSX
- definicion de columnas para productos, ventas, compras, gastos y scanner

### Promociones locales

En [src/lib/promotions.js](/Users/matiasvazquez/Documents/Glivac-demo/src/lib/promotions.js):

- se guardan promociones en `localStorage`
- no se persisten en Supabase
- se comparten entre pantallas via evento del navegador

### Scripts de datos

El directorio `scripts/` contiene SQL de importacion historica del kiosco y utilidades para particionar o transformar dumps.

## 10. Deploy

El proyecto esta preparado para SPA deploy en:

- Vercel mediante [vercel.json](/Users/matiasvazquez/Documents/Glivac-demo/vercel.json)
- Netlify mediante [netlify.toml](/Users/matiasvazquez/Documents/Glivac-demo/netlify.toml)

Ambos configs fuerzan redirect/rewrite a `index.html`.

## 11. Hallazgos tecnicos

### Fortalezas

- La app ya cubre una operacion comercial bastante completa.
- El uso de `React Query` simplifica fetch/cache.
- Supabase permite una base operativa simple para auth + datos.
- Hay buen soporte de exportacion/importacion para operacion diaria.
- La separacion por pantallas es clara y facil de seguir.

### Riesgos y deuda tecnica

- **Bootstrap sin versionado formal**
  - Ahora existe un SQL canonico unico para instalaciones nuevas.
  - Todavia no hay migraciones versionadas para cambios futuros.

- **Frontend y DB con permisos en evolucion**
  - El codigo ya soporta roles demo mas variados.
  - Aun faltaria bajar permisos mas finos al frontend para distinguir mejor cada perfil.

- **Permisos perfectibles**
  - El SQL nuevo unifica RLS y catálogo de roles.
  - Todavia hay margen para llevar más checks de permisos al nivel de features específicas.

- **Logica de negocio en frontend**
  - Stock, cierres, fiados e importaciones dependen de mutaciones desde cliente.
  - No hay RPCs ni capa backend intermedia para operaciones criticas.

- **Sin tests automatizados**
  - No hay cobertura de regresion para ventas, stock, compras o roles.

- **Keys de IA en cliente**
  - El scanner y los insights consumen APIs desde el browser.
  - Eso es rapido para prototipar, pero debil para seguridad y control de costos.

## 12. Recomendaciones prioritarias

1. Mantener `supabase/demo_bootstrap.sql` como unica fuente de verdad inicial.
2. Si el proyecto sigue creciendo, pasar de bootstrap unico a migraciones versionadas.
3. Definir un documento unico de modelo de datos, permisos y perfiles demo.
4. Mover operaciones sensibles a RPCs o funciones SQL controladas:
   - cierre de venta
   - actualizacion de stock
   - cierre de turno
   - cobro de fiados
5. Agregar tests minimos de regresion para:
   - venta descuenta stock
   - compra suma stock
   - fiado crea deuda
   - filtros por `store_id`
   - permisos admin/empleado
6. Separar integraciones IA del frontend publico si van a quedar en produccion.

## 13. Archivos clave para entender el sistema

- [src/App.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/App.jsx)
- [src/hooks/useAuth.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/hooks/useAuth.jsx)
- [src/hooks/useStoreFilter.js](/Users/matiasvazquez/Documents/Glivac-demo/src/hooks/useStoreFilter.js)
- [src/pages/POSv2.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/pages/POSv2.jsx)
- [src/pages/Products.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/pages/Products.jsx)
- [src/pages/Purchases.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/pages/Purchases.jsx)
- [src/pages/Reports.jsx](/Users/matiasvazquez/Documents/Glivac-demo/src/pages/Reports.jsx)
- [src/lib/xlsxUtils.js](/Users/matiasvazquez/Documents/Glivac-demo/src/lib/xlsxUtils.js)
- [supabase/demo_bootstrap.sql](/Users/matiasvazquez/Documents/Glivac-demo/supabase/demo_bootstrap.sql)
- [supabase/README.md](/Users/matiasvazquez/Documents/Glivac-demo/supabase/README.md)

## 14. Conclusion

Lo que hoy tenemos es un sistema funcional y ya bastante avanzado para operacion diaria, pero con una deuda clara en la parte de infraestructura de datos y estandarizacion tecnica.

La aplicacion esta lista para seguir creciendo, pero conviene ordenar cuanto antes:

- migraciones
- permisos
- tabla `shift_logs`
- flujo seguro de operaciones criticas
- documentacion operativa/versionada
