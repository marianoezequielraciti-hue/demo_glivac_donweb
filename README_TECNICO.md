# README Técnico — Glivac

Documentación del flujo de los módulos **Punto de Venta**, **Fiados** y **Clientes**, y cómo se relacionan entre sí.

---

## Tablas involucradas

| Tabla | Descripción |
|---|---|
| `sales` | Registro de ventas confirmadas |
| `fiados` | Ventas pendientes de cobro (crédito informal) |
| `clients` | Clientes registrados con datos de contacto |
| `budgets` | Presupuestos asociados a clientes |
| `client_account_entries` | Movimientos de cuenta corriente por cliente |
| `products` | Catálogo de productos con stock y precios |
| `stores` | Negocio (Glivac — un único registro) |

---

## Módulo: Punto de Venta (`/pos`)

### Requisito previo
El cajero debe **abrir un turno** indicando el monto inicial en caja. Esto crea un registro en `open_shifts` y guarda el turno en `localStorage` con los campos:
- `cajero` — nombre del usuario
- `montoInicial` — efectivo en caja al inicio
- `storeId` — ID del negocio
- `inicio` — timestamp de apertura

### Flujo: Venta normal

```
1. Cajero escanea código de barras o busca producto
2. Se agrega al carrito (estado local, sin escritura en BD)
3. Se selecciona método de pago: Efectivo / Transferencia / QR / Tarjeta / Fiado
4. Se presiona "Confirmar venta"
5. Se inserta un registro en `sales`:
   - sale_number: "V-{timestamp}"
   - items: array de productos con cantidades y precios
   - total: suma del carrito
   - payment_method: método seleccionado
   - cashier: nombre del cajero (del turno)
   - store_id: ID del negocio (del turno)
6. Se descuenta stock en `products` por cada ítem vendido
7. Se limpia el carrito y se muestra el ticket de venta
```

### Flujo: Venta a Fiado

```
1. Se selecciona método de pago "Fiado"
2. Al confirmar, aparece un modal pidiendo el nombre del cliente
3. Se inserta el registro en `sales` (igual que venta normal)
4. Se inserta un registro en `fiados`:
   - client: nombre del cliente (texto libre)
   - amount: total de la venta
   - paid: false
   - notes: "Venta V-{sale_number}"
   - store_id: ID del negocio
5. Se descuenta stock normalmente
```

> ⚠️ El nombre del cliente en fiados es texto libre — no requiere que el cliente esté registrado en la tabla `clients`.

### Flujo: Generar Presupuesto desde el POS

```
1. Se arman los productos en el carrito (igual que una venta)
2. Se presiona "📄 Generar presupuesto"
3. Se abre un modal con buscador de clientes (consulta tabla `clients`)
4. Se selecciona un cliente registrado
5. Se confirma y se inserta en `budgets`:
   - client_id: ID del cliente seleccionado
   - budget_number: "P-{timestamp}"
   - status: "draft"
   - items: array de productos del carrito
   - subtotal: total del carrito
   - store_id: ID del negocio
6. NO se descuenta stock
7. NO se registra en `sales`
8. El presupuesto queda visible en el módulo Clientes
```

### Cierre de turno

```
1. El cajero presiona "Cerrar turno"
2. Se inserta en `shift_logs`:
   - cajero, inicio, closed_at, opening_amount, closing_amount
   - store_id
3. Se elimina el registro de `open_shifts`
4. Se limpia el localStorage
```

---

## Módulo: Fiados (`/fiados`)

### Lectura de fiados

- Consulta la tabla `fiados` filtrando por `store_id`
- Normaliza las filas para soportar el esquema actual (`client` / `paid`)
- Agrupa los pendientes por nombre de cliente
- Calcula totales: `total pendiente` (paid = false) y `total registrado` (todos)

### Flujo: Cobrar un fiado

```
1. El usuario hace clic en "Cobrar" sobre un fiado pendiente
2. Selecciona método de cobro: Efectivo o Mercado Pago
3. Se confirma y se actualiza en `fiados`:
   - paid: true
   - notes: método de cobro ("efectivo" / "mercadopago")
4. El fiado desaparece de la vista "Pendientes"
5. Pasa a la vista "Pagados"
```

### Flujo: Cobro grupal (varios fiados del mismo cliente)

```
1. El usuario hace clic en "Cobrar" sobre el grupo de un cliente
2. Ingresa un monto (puede ser parcial)
3. El sistema aplica lógica FIFO: cobra los fiados más antiguos primero
4. Solo se marcan como pagados los fiados que el monto cubre completamente
5. Si sobra importe, se muestra el sobrante sin aplicar
```

### Relación con Ventas

- Cada fiado tiene `notes: "Venta V-{sale_number}"` para trazabilidad
- El fiado NO actualiza la venta al cobrarse — son registros independientes

---

## Módulo: Clientes (`/clientes`)

### Gestión de clientes

```
1. Se crea un cliente con: nombre, teléfono, email, DNI/CUIT, dirección, notas
2. Se guarda en `clients` con store_id del negocio
3. El cliente queda disponible para presupuestos y cuenta corriente
```

### Flujo: Crear presupuesto desde Clientes

```
1. Se selecciona un cliente de la lista
2. En el panel "Nuevo presupuesto":
   - Se agregan productos desde el catálogo (`products`)
   - Se puede editar nombre, cantidad y precio de cada ítem
   - Se puede agregar fecha de vencimiento y notas
   - Se selecciona estado: Borrador / Enviado / Aprobado
3. Se guarda en `budgets`:
   - client_id, store_id, budget_number, status, items, subtotal
```

### Flujo: Pasar presupuesto a cuenta corriente

```
1. En "Presupuestos registrados", se presiona "Pasar a cuenta corriente"
2. Se inserta en `client_account_entries`:
   - client_id: ID del cliente
   - budget_id: ID del presupuesto
   - movement_type: "debit" (cargo)
   - amount: subtotal del presupuesto
   - description: "Presupuesto P-{budget_number}"
   - store_id
3. Se actualiza `budgets`:
   - posted_to_account: true
   - status: "approved" (si estaba en "draft")
4. El presupuesto deja de contarse como "activo" en el resumen del cliente
```

### Flujo: Registrar movimiento manual en cuenta corriente

```
1. Se selecciona tipo: Cargo (debit) o Pago (credit)
2. Se ingresa importe y descripción
3. Se inserta en `client_account_entries`
4. El saldo se recalcula:
   - debit suma al saldo
   - credit resta al saldo
```

### Cálculo del saldo

```
Saldo = Σ (debit) - Σ (credit)
```

Un saldo positivo indica que el cliente tiene deuda.

---

## Relaciones entre módulos

```
┌─────────────────────────────────────────────────────────────┐
│                      PUNTO DE VENTA                         │
│                                                             │
│  Venta normal ──────────────────────► sales                 │
│                                       + descuenta stock     │
│                                                             │
│  Venta a fiado ─────────────────────► sales                 │
│                 └───────────────────► fiados (paid=false)   │
│                                       + descuenta stock     │
│                                                             │
│  Generar presupuesto ───────────────► budgets               │
│  (requiere cliente registrado)        sin stock, sin venta  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         FIADOS                              │
│                                                             │
│  Lee ──────────────────────────────► fiados                 │
│  Cobrar ────────────────────────────► fiados (paid=true)    │
│                                                             │
│  ⚠ No tiene relación directa con `clients`                  │
│    El nombre del cliente es texto libre                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                             │
│                                                             │
│  Presupuesto ──────────────────────► budgets                │
│  Pasar a CC ───────────────────────► client_account_entries │
│                      budgets ────────────────────┘          │
│  Movimiento manual ────────────────► client_account_entries │
│                                                             │
│  Saldo cuenta corriente = Σ debit - Σ credit                │
│  Presupuestos activos = budgets donde                       │
│    status IN (draft, sent, approved)                        │
│    AND posted_to_account = false                            │
└─────────────────────────────────────────────────────────────┘

Relación POS → Clientes:
  Un presupuesto generado en el POS (budgets) es visible y
  operable directamente en el módulo Clientes del mismo cliente.

Relación POS → Fiados:
  Una venta con método "fiado" genera automáticamente un
  registro en `fiados`. Al cobrarse en el módulo Fiados,
  la venta original en `sales` NO se modifica.
```

---

## Variables de entorno requeridas

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_ADMIN_EMAILS=admin@ejemplo.com
```

## Stack técnico

- **Frontend**: React + Vite + Tailwind CSS
- **Estado servidor**: TanStack Query (React Query)
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Deploy**: Vercel / Netlify