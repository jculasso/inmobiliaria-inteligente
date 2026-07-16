# Prompts iniciales para Claude Code — Fase 1

Prompts listos para copiar y pegar, uno por paso. Corré cada uno en una sesión nueva, con el modelo indicado. Antes de ejecutar, dejá que Claude Code te muestre su plan y revisalo.

Todos asumen que el repo ya tiene `CLAUDE.md`, `docs/Arquitectura_Inmobiliaria_Inteligente.md`, `docs/MODELO_DATOS_TABLERO.md` y `docs/prototipos/`.

---

## Paso 1 — Fundaciones · modelo: **Opus 4.8**

```
Leé CLAUDE.md y docs/Arquitectura_Inmobiliaria_Inteligente.md (sección 19).

Objetivo de esta sesión: montar las FUNDACIONES del monorepo. No implementes lógica de negocio todavía.

Entregables:
1. Monorepo con pnpm + Turborepo (pnpm-workspace.yaml, turbo.json).
2. packages/config: tsconfig base, ESLint, Prettier compartidos.
3. packages/ui: design system inicial con los tokens de marca Vacker del CLAUDE.md (colores, radius, tipografía Montserrat) sobre Tailwind + Radix. Exponé un par de componentes base (Button, Card, Badge con estados Activo/En desarrollo/Próximamente).
4. apps/api: proyecto NestJS mínimo que levanta y responde GET /health.
5. apps/web: proyecto Next.js (App Router, TS) mínimo que levanta.
6. packages/types: paquete para tipos y schemas Zod compartidos (vacío por ahora).
7. CI en .github/workflows: lint + typecheck + test en cada push/PR.
8. .env.example documentado. .gitignore correcto (nunca .env).

Definición de hecho: todo compila, `pnpm typecheck` y `pnpm test` pasan (aunque los tests sean mínimos), lint verde. Al final mostrame el diff y cómo levantar api y web localmente. No incluyas secretos.
```

---

## Paso 2 — Núcleo backend (tenant, RLS, auth, RBAC) · modelo: **Opus 4.8**

```
Leé CLAUDE.md, docs/Arquitectura_Inmobiliaria_Inteligente.md (secc. 9 y 19) y docs/MODELO_DATOS_TABLERO.md (Parte A y D).

Objetivo: el NÚCLEO multi-tenant del backend. Este es el paso más delicado; priorizá corrección sobre velocidad.

Entregables en apps/api:
1. Prisma configurado contra PostgreSQL (Supabase) vía DATABASE_URL (de env).
2. Migraciones del núcleo: tenant, usuario, usuario_rol, con lider_id (auto-referencia en usuario) según el modelo de datos.
3. Row-Level Security ACTIVADA en todas las tablas de negocio, con policy de aislamiento por tenant_id. El tenant_id se toma del JWT por request (app.tenant_id).
4. Integración con Supabase Auth DETRÁS de una abstracción propia (AuthProvider interface), para poder migrar a Keycloak/Auth0 luego sin tocar los módulos.
5. Guard de RBAC con los roles: vendedor, team_leader, direccion, admin_tenant, admin_plataforma. Decorador @Roles() en endpoints.
6. Contrato OpenAPI sirviéndose (Swagger) con los endpoints del núcleo.
7. TEST AUTOMATIZADO DE AISLAMIENTO: crear dos tenants con datos y probar que un usuario del tenant A no puede leer ni escribir filas del tenant B (ni por API ni por query directa con RLS). Este test debe pasar.

Definición de hecho: migraciones aplicables, typecheck + todos los tests en verde (incluido el de aislamiento), OpenAPI accesible, env nuevas en .env.example. Mostrame el diff y el resultado del test de aislamiento.
```

---

## Paso 3 — Módulo Tablero (API + KPIs) · modelo: **Opus 4.8** (diseño) → **Sonnet 5** (CRUD)

```
Leé CLAUDE.md y docs/MODELO_DATOS_TABLERO.md (Partes B, C, E). Referencia visual/lógica: docs/prototipos/tablero_vacker_offline.html.

Objetivo: el módulo Tablero Comercial en el backend (solo API).

Entregables en apps/api/src/modules/tablero:
1. Migraciones: operacion, operacion_punta, objetivo (según el modelo de datos). Elegí explícitamente el enfoque de puntas (normalizado con operacion_punta, recomendado) y dejalo asentado en un comentario/README del módulo.
2. CRUD de operaciones (venta y alquiler) y de vendedores/usuarios comerciales, validado con Zod y protegido por RBAC + tenant.
3. Endpoints de KPIs con la lógica de negocio de la Parte C:
   - Volumen = precio × cant_puntas, solo estado 'escriturada', por año.
   - Puntas, comisión total, ticket promedio.
   - Ranking de vendedores.
   - KPIs de cabecera (volumen, puntas, comisión, pendiente de cobro = señadas, alquileres firmados del año).
   - Seguimiento de objetivos (real vs objetivo del año).
   - Filtros por año y mes.
   Toda esta lógica va en la capa de servicio, NUNCA en el frontend.
4. SCOPE POR ROL aplicado antes de calcular: direccion/CEO = todo el tenant; team_leader = su equipo (él + usuarios con lider_id = él); vendedor = solo lo propio.
5. Seed idempotente que carga los datos reales 2026 del prototipo (arrays ventas, alquileres, vendedores) mapeados al nuevo modelo.
6. Tests de los cálculos de KPIs y del scope por rol.

Definición de hecho: typecheck + tests en verde, endpoints en OpenAPI, seed corre sin duplicar. Mostrame el diff, la salida del seed y un ejemplo de respuesta del ranking.
```

---

## Paso 4 — Home autenticada (shell) · modelo: **Sonnet 5**

```
Leé CLAUDE.md. Referencia: docs/prototipos/home_inmobiliaria_inteligente.html (respetá su diseño y los tokens de marca).

Objetivo: la Home como shell autenticado en apps/web.

Entregables:
1. Login contra Supabase Auth (email/clave para empezar).
2. La home con las tres cards de módulos (Tablero: Activo; Tasador y To Do List: como en el prototipo) usando el design system de packages/ui.
3. Visibilidad de módulos por ROL del usuario logueado (según la matriz de la sección 9 de la arquitectura): mostrar/ocultar u marcar según permisos.
4. Manejo de sesión (protección de rutas, logout).

Definición de hecho: typecheck + tests en verde, login funcional contra Supabase, la home refleja el rol. Mostrame el diff y cómo probarlo localmente.
```

---

## Paso 5 — Tablero web con datos reales · modelo: **Sonnet 5**

```
Leé CLAUDE.md y docs/MODELO_DATOS_TABLERO.md. Referencia de UX: docs/prototipos/tablero_vacker_offline.html.

Objetivo: portar la vista del Tablero a apps/web consumiendo la API real (nada de localStorage).

Entregables:
1. Vistas del tablero: dashboard con KPIs de cabecera, ranking de vendedores (colapsable), operaciones de venta, operaciones de alquiler, vendedores.
2. Alta / edición / baja de operaciones y vendedores contra la API.
3. Filtros por año y mes; el scope por rol lo resuelve la API (el front solo pide y muestra).
4. Estados de carga y error; formato de moneda y números como en el prototipo (es-AR, USD).
5. Cliente de API tipado (usando packages/types + schemas Zod).

Definición de hecho: typecheck + tests en verde, la vista muestra los datos del seed reales vía API, las operaciones CRUD impactan en la BD. Mostrame el diff y una descripción del resultado.
```

---

## Nota de uso

- Si un paso queda a medias, no marques el siguiente: pedí a Claude Code que termine y deje los tests en verde antes de avanzar.
- Cuando arranques el Tasador o el To Do List (post Fase 1), replicá este mismo patrón: un doc de modelo de datos del módulo + un prompt por paso.
- Para el To Do List, sumá al brief la integración OAuth con Google Calendar (lectura/escritura de eventos por usuario) y la vista semanal.
