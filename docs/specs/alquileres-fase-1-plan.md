# Módulo «Alquileres» — fase 1: plan técnico

> Baja a capas y entregas la especificación `alquileres-fase-1.md`. La spec
> dice **qué**; esto dice **en qué orden y dónde**. Cada número entre
> corchetes, [R9], es una regla de la spec, y es el que lleva el nombre de su
> test.

## 1. Decisiones de diseño

| Tema                        | Decisión                                                                                                     | Por qué                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propiedades                 | **Tabla propia** `alq_propiedad`, no el modelo `Propiedad`                                                   | `Propiedad` es el espejo de Tokko: exige `tokkoId` y se pisa en cada importación. Una unidad alquilada puede no estar en Tokko. Si está, se guarda el `tokkoId` como dato opcional para vincular después.                                                                                                                                                                             |
| Prefijo                     | Todas las tablas del módulo empiezan con `alq_`                                                              | Se reconocen de un vistazo en la base y en `aislamiento.e2e-spec.ts`.                                                                                                                                                                                                                                                                                                                 |
| Índices                     | Tabla **sin** `tenant_id`: `indice_valor`                                                                    | El ICL y el IPC son datos públicos, iguales para todas las inmobiliarias. Cargarlos una vez por tenant sería triplicar la descarga y arriesgar que dos inmobiliarias indexen con valores distintos. Lleva RLS con una policy de **solo lectura para todos** y escritura solo del servicio; `rls-habilitada.e2e-spec.ts` la tiene que aceptar como excepción explícita, con su motivo. |
| Cuenta corriente            | **No es una tabla**: se calcula de conceptos e imputaciones                                                  | Una tabla de saldos se desincroniza; dos fuentes de la misma verdad terminan diciendo dos cosas. El saldo de un concepto es su importe menos lo imputado; el de una persona, la suma por moneda [R18].                                                                                                                                                                                |
| Idempotencia [R10]          | **Índice único parcial** en `alq_concepto (contrato_id, persona_id, tipo, periodo)` para los tipos generados | Que generar dos veces no duplique lo garantiza la base, no un `if` que alguien puede saltear.                                                                                                                                                                                                                                                                                         |
| Anulación [R19]             | Columnas `anulado_en`, `anulado_por`, `motivo_anulacion`; **sin endpoint DELETE**                            | Lo que movió plata no desaparece.                                                                                                                                                                                                                                                                                                                                                     |
| Dinero                      | `Decimal(14,2)` + `moneda` (`ARS` \| `USD`) en cada fila con importe                                         | Convención del proyecto: nada de floats para plata.                                                                                                                                                                                                                                                                                                                                   |
| Cálculos                    | Funciones **puras** en `packages/domain` (`alquileres/`)                                                     | Indexación, prorrateo, punitorio, imputación y liquidación se testean en memoria, sin base, y los usa el front para las vistas previas. Es el patrón de `valuacion.ts`.                                                                                                                                                                                                               |
| PDFs                        | `@react-pdf/renderer` del lado de la API, como el informe del Tasador                                        | Ya está resuelto ahí: fuentes, color de la inmobiliaria y medición del texto.                                                                                                                                                                                                                                                                                                         |
| Firma [R33–35]              | Interfaz `ProveedorFirma` + `FirmaManual` (fase 1) + `FirmaSimulada` (tests)                                 | El patrón de la capa de autenticación: el módulo no conoce al proveedor.                                                                                                                                                                                                                                                                                                              |
| Índices automáticos [R8]    | Tarea diaria por el endpoint `/tareas` con `CRON_SECRET`, como el reporte semanal                            | El cron de GitHub se atrasa horas, pero para un índice diario no importa y ya está montado.                                                                                                                                                                                                                                                                                           |
| Generación del período [R9] | **Botón**, no cron                                                                                           | Es un acto administrativo que alguien tiene que mirar: si una indexación está pendiente, el período avisa [R11]. Automatizarlo es para después.                                                                                                                                                                                                                                       |

## 2. Modelo de datos (borrador)

```
alq_persona         id, tenant_id, tipo (fisica|juridica), nombre, documento, cuit?,
                    email?, telefono?, domicilio?, obs?
alq_propiedad       id, tenant_id, direccion, unidad?, ciudad, tipo, tokko_id?, obs?
alq_contrato        id, tenant_id, codigo, propiedad_id, tipo (vivienda|comercial),
                    moneda, inicio, fin, fecha_firma?, dia_vencimiento,
                    ajuste (indexado|escalonado), indice?, periodicidad_meses?,
                    honorarios_pct, gastos_adm_pct, iva_pct, punitorio_diario_pct,
                    pago_garantizado, deposito_importe?, deposito_moneda?,
                    deposito_devolucion?, estado, rescindido_el?, obs?
alq_contrato_parte  contrato_id, persona_id, papel (propietario|inquilino|garante),
                    porcentaje?            -- solo propietarios [R4]
alq_tramo           contrato_id, numero, desde, hasta, importe?, indice_base?,
                    indice_requerido?, importe_propuesto?, confirmado_el?, confirmado_por?
alq_concepto        id, tenant_id, contrato_id?, persona_id, tipo, sentido
                    (a_cobrar|a_pagar), moneda, periodo (YYYY-MM)?, vencimiento,
                    importe, adelantado_por_inmobiliaria, liquidacion_id?,
                    origen_id?, descripcion?, anulado_*
alq_cobro           id, tenant_id, persona_id, fecha, moneda, importe, medio, obs?, anulado_*
alq_imputacion      cobro_id, concepto_id, importe
alq_liquidacion     id, tenant_id, persona_id, periodo, moneda, neto, fecha, anulado_*
alq_documento       id, tenant_id, contrato_id, archivo (storage), estado_firma,
                    proveedor?, envio_externo_id?
alq_firmante        documento_id, persona_id, estado
alq_firma_evento    documento_id, fecha, estado_anterior, estado_nuevo, origen
indice_valor        indice, fecha (o período), valor, fuente      -- sin tenant_id
```

Todas las tablas con `tenant_id` llevan RLS, `REVOKE`/`GRANT` y su línea en
`aislamiento.e2e-spec.ts`. `alq_contrato_parte`, `alq_tramo`, `alq_imputacion`,
`alq_firmante` y `alq_firma_evento` llevan **también** `tenant_id`, aunque se
pueda deducir del padre: la policy RLS tiene que poder filtrar la tabla sola.

## 3. Entregas

Cada una es un PR que se puede mergear y desplegar sin romper nada, porque el
módulo está **apagado** hasta la última.

| #   | Entrega                                                                                                                                                                                                                                                                                            | Reglas         | Capas                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------- |
| 1   | **Fundaciones**: `alquileres` en `MODULO_KEYS`, rol `administracion` (en `RolSchema`, `RolAsignableSchema` y en el formulario que preserva roles), constante `ROLES_ADMINISTRACION_ALQUILERES`, migración de **todas** las tablas con RLS, tests de aislamiento, tarjeta en la Home y página vacía | §3, licencia   | types · migración · API · web |
| 2   | **Personas y propiedades**: alta, edición, búsqueda                                                                                                                                                                                                                                                | —              | API · web                     |
| 3   | **Contratos**: alta en pasos (partes → condiciones → tramos), validaciones, ficha, estados, rescisión                                                                                                                                                                                              | 1–4            | domain · API · web            |
| 4   | **Índices e indexación asistida**: importador BCRA (ICL) e INDEC (IPC), tarea diaria, bandeja «a indexar» con propuesta y confirmación                                                                                                                                                             | 5–8            | domain · API · tareas · web   |
| 5   | **Generación del período** y conceptos sueltos (expensas, impuestos, servicios, reparaciones)                                                                                                                                                                                                      | 9–14           | domain · API · web            |
| 6   | **Cobros**: registro, imputación, punitorio, saldo a favor, anulación, recibo PDF, cuenta corriente y estado de cuenta                                                                                                                                                                             | 15–19, 23, 24  | domain · API · PDF · web      |
| 7   | **Liquidaciones** al propietario, con PDF                                                                                                                                                                                                                                                          | 20–22          | domain · API · PDF · web      |
| 8   | **Tablero del módulo** con drill-down                                                                                                                                                                                                                                                              | 26–32, 36      | API · web                     |
| 9   | **Firma prevista**: documento, estados, firmantes, eventos, adaptador manual                                                                                                                                                                                                                       | 33–35          | API · web                     |
| 10  | **Migración de Vacker**: importador desde planillas, saldos iniciales, cotejo de los 5 contratos contra Gexion, datos de demo en Alteva, encendido del módulo                                                                                                                                      | 25, aceptación | API · script · web            |

## 4. Las trampas de este repo, aplicadas acá

- **Una constante, una vez.** `ROLES_ADMINISTRACION_ALQUILERES` vive en
  `packages/types` y la usan el `@Roles` de cada controller, `rbac.ts` de la
  web y la Home. Un `alquileres.roles.spec.ts` verifica que los `@Roles` sean
  exactamente esa lista. **No confundirla con `ROLES_ALQUILERES`**, que es la
  sección de alquileres del Tablero Comercial y no incluye a `administracion`.
- **Las queries no crecen con las filas.** Generar el período para 78
  contratos: traer contratos vigentes, tramos y conceptos del mes en **tres**
  consultas, calcular en memoria y escribir con un `createMany`. Lo mismo al
  registrar un cobro con muchas imputaciones y al liquidar. El test cuenta
  queries con 5 y con 25 contratos y exige el mismo número.
- **El tablero calcula en SQL.** Morosidad y cobranza se agregan con
  `groupBy` en la base, no trayendo todos los conceptos al cliente: esta
  tabla crece 300 filas por mes.
- **El drill-down suma su tarjeta** [R26]: la ventana de detalle reusa el
  criterio de `apps/web/lib/drill.ts`.
- **Nada sin sesión en el navegador**, salvo los PDFs si se mandan por link:
  en la fase 1 se descargan con sesión y se mandan como archivo, así que no
  hay que tocar `PUBLIC_PATHS`.
- **Campos de 16px** en todos los formularios (el alta del contrato tiene
  muchos).
- **Las migraciones no se aplican solas**: Render despliega la API pero no
  corre `prisma migrate deploy`. Cada una se valida contra la base real
  dentro de `BEGIN … ROLLBACK` y se aplica a mano con
  `pnpm --filter @vacker/api prisma:deploy`, **antes** de que el código que la
  usa llegue a producción. Ver la skill `ship`, §7.

## 5. El paso más riesgoso, y cómo enterarse temprano

**Que las cuentas no den igual que en Gexion.** Indexación, prorrateo,
honorarios, punitorios y el neto al propietario son reglas con muchas
variantes. Si recién se descubre en la entrega 10, al cotejar, hay que
rehacer cuatro entregas.

Por eso el cotejo **se adelanta**: antes de la entrega 3, Javier elige con
Vacker los cinco contratos del criterio de aceptación, y con su sesión de
Gexion se relevan sus números de los últimos meses —importe de cada tramo,
honorarios, gastos, neto liquidado—. Esos números entran como **casos de
prueba** de `packages/domain` desde la entrega 3. Cada regla de cálculo nace
probada contra un caso real, no contra lo que entendimos.

El segundo riesgo es la **calidad de los datos migrados** (entrega 10): se
mitiga con un importador que valida todo antes de escribir nada y muestra los
errores fila por fila.

## 6. Qué se ve en el navegador y qué no

| Se verifica en el navegador (`verificar-ui`)         | Necesita test, porque nadie lo va a mirar                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Alta del contrato en pasos, en escritorio y teléfono | Todas las cuentas: indexación, prorrateo, punitorio, imputación, liquidación |
| Bandeja de indexación: propuesta, confirmar          | Idempotencia de la generación [R10]                                          |
| Registrar un cobro y ver el recibo                   | Que una anulación revierta la cuenta corriente [R19]                         |
| Tablero y cada drill-down                            | Aislamiento entre inmobiliarias y 403 por rol y por licencia                 |
| PDFs (recibo, liquidación, estado de cuenta)         | Que el total del PDF sea el saldo de la cuenta corriente [R24]               |
|                                                      | El importador de índices sin pisar ni duplicar [R8]                          |
|                                                      | Que las queries no crezcan con los contratos                                 |
