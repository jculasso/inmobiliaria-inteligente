# Modelo de datos — Núcleo + Módulo Tablero Comercial

> Extraído de los datos reales del prototipo `tablero_vacker_offline.html` (datos 2026 migrados del Excel, 14/07/2026) y alineado con la sección 11 de la arquitectura. Este documento es la referencia para las migraciones Prisma del núcleo y del módulo Tablero.
>
> **Todas las tablas de negocio llevan `tenant_id` y están protegidas por RLS.** Convención de nombres: `snake_case`.

---

## Parte A · Núcleo de plataforma

Estas tablas son compartidas por todos los módulos.

### `tenant` (inmobiliaria)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | Ej. "Vacker Negocios Inmobiliarios" |
| slug | text unique | Identificador URL-friendly |
| plan | text | `basico` \| `profesional` \| `enterprise` (futuro) |
| estado | text | `activo` \| `suspendido` |
| config | jsonb | Marca, preferencias |
| created_at / updated_at | timestamptz | |

### `usuario`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | Coincide con el `user id` de Supabase Auth |
| tenant_id | uuid FK → tenant | **RLS** |
| nombre | text | |
| email | text | Único por tenant |
| estado | text | `activo` \| `inactivo` (equivale a `Activo/Inactivo` del prototipo) |
| created_at / updated_at | timestamptz | |

### `rol` y asignación
Roles fijos del sistema: `vendedor`, `team_leader`, `direccion`, `admin_tenant`, `admin_plataforma`.

**`usuario_rol`** (un usuario puede tener uno o más roles dentro de su tenant)
| Campo | Tipo | Notas |
|---|---|---|
| usuario_id | uuid FK → usuario | |
| rol | text | Uno de los roles fijos |
| tenant_id | uuid FK → tenant | **RLS** |
| PK | (usuario_id, rol) | |

### Estructura de equipos
El prototipo modela equipos con el campo `lider` (un vendedor puede tener un Team Leader). Se representa como auto-referencia en `usuario`:

| Campo | Tipo | Notas |
|---|---|---|
| lider_id | uuid FK → usuario (nullable) | El Team Leader del que depende. Vacío = sin equipo |

> **Regla de scope (del prototipo):** `direccion`/CEO ve todo el tenant; `team_leader` ve su propia cartera + la de los usuarios cuyo `lider_id` es él; `vendedor` ve solo lo propio. Esto se implementa en RLS + capa de servicio.

---

## Parte B · Módulo Tablero Comercial

### `operacion`
Cubre **ventas y alquileres** (misma forma en el prototipo, diferenciadas por `tipo`). Una operación puede tener **1 o 2 puntas** (lados: comprador/inquilino y vendedor/propietario), cada una atribuida a un agente, con su comisión.

**Modelo relacional recomendado** (normaliza las "puntas" del prototipo, que estaban como `punta_vend`/`punta_comp` en texto):

**`operacion`**
| Campo | Tipo | Notas / origen prototipo |
|---|---|---|
| id | uuid PK | (prototipo usa `OP-1001`… → guardar como `codigo`) |
| codigo | text | Código legible: `OP-1001` |
| tenant_id | uuid FK → tenant | **RLS** |
| tipo | text | `venta` \| `alquiler` |
| direccion | text | Dirección del inmueble |
| precio | numeric(14,2) | Precio de la operación |
| moneda | text | `USD` (default) |
| cant_puntas | int | 1 o 2 |
| com_total | numeric(14,2) | Comisión total (suma de puntas) |
| estado | text | `escriturada` \| `senada` \| `reservada` \| `boleto` (venta); para alquiler: `firmado` \| `reservado` \| `pendiente` |
| fecha_reserva | date | nullable |
| fecha_firma | date | nullable (fecha de escritura/firma de contrato) |
| mes | int | Derivable de fecha_firma/reserva; se guarda para reporting |
| anio | int | Íd. |
| obs | text | nullable |
| created_at / updated_at | timestamptz | |

**`operacion_punta`** (1 o 2 filas por operación)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| operacion_id | uuid FK → operacion | |
| tenant_id | uuid FK → tenant | **RLS** |
| lado | text | `vendedora` (propietario/locador) \| `compradora` (comprador/inquilino) — mapea `punta_vend` / `punta_comp` |
| usuario_id | uuid FK → usuario | El agente que trabajó esa punta |
| comision | numeric(14,2) | `com_vend` / `com_comp` según el lado |

> **Alternativa rápida (denormalizada, igual al prototipo):** mantener en `operacion` los campos `punta_vend_id`, `punta_comp_id`, `com_vend`, `com_comp`. Es más fácil de migrar 1:1 desde el Excel/HTML, pero complica los reportes por agente. **Recomendado:** empezar normalizado (`operacion_punta`); si se prioriza velocidad de migración, arrancar denormalizado y normalizar en un segundo paso. El agente debe elegir explícitamente y dejarlo asentado.

### `objetivo`
Objetivos anuales por vendedor (del modal "Nuevo vendedor": objetivo de comisión bruta anual; el prototipo también contempla objetivo de volumen y de puntas).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK → tenant | **RLS** |
| usuario_id | uuid FK → usuario | |
| anio | int | |
| obj_comision | numeric(14,2) | Objetivo comisión bruta anual (USD) |
| obj_volumen | numeric(14,2) | Objetivo de volumen (USD) |
| obj_puntas | int | Objetivo de cantidad de puntas |
| PK lógica | (tenant_id, usuario_id, anio) | |

---

## Parte C · Métricas y KPIs (lógica de negocio del Tablero)

Estas reglas vienen del prototipo y deben vivir en la **capa de servicio del backend**, no en el frontend:

- **Volumen** = `precio × cant_puntas`, contando **solo operaciones en estado `escriturada`** del año seleccionado.
- **Puntas** = suma de `cant_puntas` de las operaciones escrituradas (una operación aporta 1 o 2).
- **Comisión total** = suma de comisiones de las puntas del agente/equipo.
- **Ticket promedio** = `volumen / puntas`.
- **Ranking de vendedores**: ordenado por volumen (con puntas, comisión total y ticket como columnas).
- **KPIs de cabecera**: volumen anual, puntas, comisión, pendiente de cobro (operaciones señadas), alquileres firmados en el año.
- **Seguimiento de objetivos**: comparar comisión/volumen/puntas reales vs `objetivo` del año.
- **Filtros**: por año y por mes.

**Scope por rol** (aplicado antes de calcular): CEO/dirección = todo el tenant; team_leader = su equipo (él + sus vendedores); vendedor = solo sus operaciones.

---

## Parte D · RLS (esbozo)

Cada tabla de negocio activa RLS y aplica una policy base por tenant, más el scope por rol en la capa de servicio:

```sql
-- Ejemplo conceptual para operacion
ALTER TABLE operacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON operacion
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

El `app.tenant_id` se setea por request a partir del JWT (claim de tenant). **Test obligatorio:** un usuario del tenant A no puede leer ni escribir filas del tenant B, verificado en la suite automatizada.

---

## Parte E · Datos de migración disponibles

- El prototipo trae datos reales 2026 (operaciones de venta y alquiler, vendedores) embebidos en `tablero_vacker_offline.html` y en el Excel original (`2adb2234-...xlsx` en la base de conocimiento).
- Para la carga inicial (seed) del entorno de Vacker, extraer esos arrays (`ventas`, `alquileres`, `vendedores`) y mapearlos a las tablas de arriba mediante un script de seed idempotente.
