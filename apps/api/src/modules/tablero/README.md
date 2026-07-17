# Módulo Tablero Comercial

API del tablero comercial de Vacker (Fase 1 · Paso 3). Toda la lógica de
negocio vive en la capa de servicio; el frontend solo consume.

## Decisión de modelado: puntas NORMALIZADAS

Se eligió el enfoque **normalizado** con la tabla `operacion_punta` (1 o 2 filas
por venta), en lugar del denormalizado del prototipo (`punta_vend`/`punta_comp`
como texto). Motivo: la lógica del prototipo (`agg()` en
`tablero_vacker_offline.html`) atribuye cada punta a un agente y calcula el
volumen, la comisión y el ranking **por punta**. Normalizar hace que el scope
por rol y el ranking sean un simple filtro por `usuario_id`, sin parsear texto.

### Regla central de KPIs (MODELO Parte C)

Cada punta atribuida aporta el **precio completo** de la operación al volumen y
su **propia comisión**. Es idéntico en modo tenant y en modo acotado:

- **Volumen** = Σ `precio` por cada punta escriturada del alcance
  (equivale a `precio × cant_puntas` a nivel operación).
- **Puntas** = cantidad de puntas del alcance.
- **Comisión** = Σ `comision` de esas puntas.
- **Ticket promedio** = volumen / puntas.
- Solo cuentan operaciones **escrituradas** del año (y mes, si se filtra).

La lógica pura vive en [`kpis/kpis.calc.ts`](kpis/kpis.calc.ts) (sin Prisma,
testeable en memoria); [`kpis/kpis.service.ts`](kpis/kpis.service.ts) trae los
datos y la invoca.

## Scope por rol (aplicado ANTES de calcular)

[`scope.util.ts`](scope.util.ts) — `resolverScope`:

- `direccion` / `admin_tenant` / `admin_plataforma` → **todo el tenant**.
- `team_leader` → **su equipo**: él + los usuarios con `lider_id = él`.
- `vendedor` → **solo lo propio**.

RLS ya acota al tenant en la base; el scope acota *dentro* del tenant filtrando
las puntas por `usuario_id`.

## Ventas vs. alquileres

- **Venta**: `precio` + 1-2 puntas (`operacion_punta`). Estados: `escriturada`,
  `senada` (+ `reservada`/`boleto` previstos).
- **Alquiler**: `valor_mensual` + `com_total` (comisión), **sin puntas** — el
  prototipo no atribuye el alquiler a un agente. Estado `firmado`.

### Notas de negocio (deltas respecto del prototipo)

- **Pendiente de cobro** = comisión de las puntas de operaciones **señadas del
  año** dentro del alcance. El prototipo lo sumaba global (sin año ni rol);
  acá se acota por año y rol, más coherente.
- **Alquileres firmados** es una métrica de **tenant** (no hay agente). Los
  alcances acotados (`team_leader`, `vendedor`) ven 0.
- `anio`/`mes` se derivan de `fecha_firma ?? fecha_reserva` (ver
  [`tablero.util.ts`](tablero.util.ts)), replicando `opAnio`/`opMes`.

## Endpoints

| Método | Ruta | Roles |
|---|---|---|
| GET/POST/PATCH/DELETE | `/tablero/operaciones` | vendedor+ (DELETE: team_leader+) |
| GET/POST/PATCH/DELETE | `/tablero/vendedores` | direccion/admin_tenant (GET: +team_leader) |
| PUT | `/tablero/vendedores/:id/objetivo` | direccion/admin_tenant |
| GET | `/tablero/kpis/resumen \| ranking \| objetivos` | vendedor+ |

Todos validan la entrada con Zod (`ZodValidationPipe`) y verifican rol + tenant.
