# CLAUDE.md — Inmobiliaria Inteligente 2.0 (Vacker)

> Este archivo es el brief permanente del proyecto. Claude Code lo lee en cada sesión.
> **Regla de oro:** ante cualquier duda de stack, alcance o convención, este archivo y `/docs/Arquitectura_Inmobiliaria_Inteligente.md` (sección 19) mandan. No reinventes decisiones ya cerradas.

---

## 1. Qué estamos construyendo

Plataforma SaaS **multi-tenant** para inmobiliarias. Un sistema único, modular, accesible desde web y (más adelante) apps móviles. Se comercializa a múltiples inmobiliarias (tenants); cada una opera aislada.

Estado actual: existen prototipos HTML/React validados (`/docs/prototipos`). Ahora se construye la versión **productiva** empezando por el backend y el módulo Tablero Comercial.

**Este NO es un rewrite del prototipo.** Los HTML son referencia de UX y de lógica de negocio, no la base de código. La versión productiva se construye limpia según la arquitectura.

---

## 2. Principios innegociables (desde el primer commit)

1. **Multi-tenant real.** Toda entidad de negocio lleva `tenant_id`. Sin excepción. Aunque hoy exista un solo tenant (Vacker).
2. **Row-Level Security (RLS) en PostgreSQL.** El aislamiento entre tenants se garantiza en la base de datos, no solo en la aplicación. Debe existir un test automatizado que verifique que un tenant no puede leer datos de otro.
3. **RBAC sensible al tenant.** Roles: `vendedor`, `team_leader`, `direccion`, `admin_tenant` (+ `admin_plataforma` fuera del tenant). Los permisos se evalúan siempre en el contexto del tenant del usuario.
4. **API-first.** Toda la funcionalidad se expone vía API REST documentada con OpenAPI. Web y móvil son clientes de la misma API. Nada de lógica de negocio en el frontend.
5. **TypeScript en todo el stack.**
6. **Secretos fuera del código.** Solo variables de entorno. Nunca commitear llaves.

---

## 3. Stack cerrado (Fase 1)

| Capa | Tecnología | Notas |
|---|---|---|
| Monorepo | pnpm + Turborepo | `apps/` y `packages/` |
| Backend / API | **NestJS** (TypeScript), monolito modular | Módulos con fronteras claras |
| ORM / migraciones | Prisma | Migraciones versionadas en el repo |
| Base de datos | **PostgreSQL** (vía Supabase) + **RLS** | Supabase free al inicio |
| Auth / Identidad | **Supabase Auth** (OIDC/JWT) | Detrás de una capa de abstracción propia para poder migrar a Keycloak/Auth0 luego |
| Storage | Supabase Storage (S3-compatible) | PDFs, fotos, adjuntos |
| Frontend web | **Next.js** (App Router) + TypeScript, PWA | Reutiliza patrones del prototipo React |
| Design system | Tailwind + Radix, tokens de marca Vacker | Ver §6 |
| Validación | Zod (compartido back/front vía `packages/`) | Contratos tipados |
| Tests | Vitest (unit) + Supertest (API) + Playwright (e2e) | |
| CI/CD | GitHub Actions | Lint + typecheck + test en cada PR |
| Hosting web | Vercel (free) | |
| Hosting API | Render (free) | Ojo: se duerme por inactividad |

**No usar** (decisiones ya tomadas): Railway/Fly.io para hosting (sin free tier real hoy), AWS/Terraform (se difiere a fase de escala), Redis/colas (se difiere), microservicios (monolito modular por ahora).

---

## 4. Estructura del monorepo

```
/
├─ CLAUDE.md                  ← este archivo
├─ docs/
│  ├─ Arquitectura_Inmobiliaria_Inteligente.md   ← norte + plan Fase 1 (secc. 19)
│  ├─ MODELO_DATOS_TABLERO.md                     ← entidades y campos
│  └─ prototipos/             ← HTML de referencia (NO son código productivo)
│     ├─ home_inmobiliaria_inteligente.html
│     ├─ tablero_vacker_offline.html
│     └─ tasador_vacker.html
├─ apps/
│  ├─ api/                    ← NestJS (backend)
│  └─ web/                    ← Next.js (Home + Tablero)
├─ packages/
│  ├─ types/                  ← tipos y schemas Zod compartidos
│  ├─ config/                 ← tsconfig, eslint, prettier compartidos
│  └─ ui/                     ← design system (tokens Vacker + componentes)
├─ .github/workflows/         ← CI
└─ turbo.json / pnpm-workspace.yaml
```

Módulos del backend (`apps/api/src/modules/`): `core` (tenants, usuarios, roles, auth), `tablero` (operaciones, vendedores, objetivos, KPIs). Futuros: `tasador`, `todo`.

---

## 5. Orden de trabajo (Fase 1)

Seguir la secuencia de la **sección 19.3** de la arquitectura. Resumen:

1. **Fundaciones** — monorepo, design system con tokens Vacker, CI/CD, entornos dev/prod.
2. **Núcleo backend** — modelo de datos con `tenant_id` + RLS; auth (Supabase); RBAC (4 roles); OpenAPI base; **test de aislamiento entre tenants**.
3. **Módulo Tablero (API)** — operaciones, vendedores, objetivos; endpoints de KPIs, ranking, seguimiento de objetivos.
4. **Home autenticada** — login + visibilidad de módulos por rol (shell de entrada).
5. **Tablero web con datos reales** — migrar el prototipo a consumir la API.
6. Endurecer PWA → luego app React Native. Después: Tasador, luego To Do List.

No adelantar módulos. Cerrar cada paso con su "definición de hecho" (§7) antes de avanzar.

---

## 6. Marca y design system (tokens Vacker)

```
--red:    #C1121F   (primario)
--red-d:  #8F0D18   (primario oscuro)
--ink:    #1D1D1F   (texto)
--muted:  #6B6B6B   (texto secundario)
--line:   #E6E6E6   (bordes)
--bg:     #F4F5F7   (fondo)
--green:  #1E9E5A   (éxito / activo)
--amber:  #B7791F   (en desarrollo / advertencia)
--radius: 16px
Tipografía: Montserrat (web). Fallback: system-ui.
```

Estados de UI ya definidos en el prototipo de la Home: badge `Activo` (verde), `En desarrollo` (ámbar), `Próximamente` (gris).

---

## 7. Definición de hecho (aplica a cada paso)

Un paso está "hecho" solo si:
- Compila y pasa `typecheck` sin errores.
- Tiene tests y **todos pasan** (incluido, en el núcleo, el test de aislamiento multi-tenant).
- La API nueva está reflejada en el contrato OpenAPI.
- No hay secretos en el código; las env vars nuevas están documentadas en `.env.example`.
- Pasa lint y formato.
- El PR describe qué se hizo y cómo probarlo.

Nunca marcar un paso como completo con tests en rojo o implementación parcial.

---

## 8. Convenciones

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`…).
- **Branches:** `feat/<modulo>-<detalle>`; PR a `main`; `main` siempre desplegable.
- **Nombres:** entidades y campos de BD en `snake_case`; código TS en `camelCase`; tipos en `PascalCase`.
- **Errores de API:** formato consistente `{ error: { code, message, details? } }`.
- **Fechas:** ISO 8601 (`YYYY-MM-DD`), UTC en almacenamiento.
- **Moneda:** montos como enteros o decimales con moneda explícita (`USD`). No floats para dinero si se puede evitar (usar `numeric`/`decimal`).
- Cada endpoint valida entrada con Zod y verifica rol + tenant antes de tocar datos.

---

## 9. Cómo pedirme trabajo (modelos)

- **Opus 4.8** → arranque de cada módulo, esquema de datos + RLS, auth/RBAC, decisiones estructurales, debugging difícil.
- **Sonnet 5** → implementación de tareas ya especificadas (CRUD, endpoints, componentes, tests).
- **Haiku 4.5** → ediciones triviales.

Regla práctica: **lo estructural con Opus, el volumen con Sonnet.**

---

## 10. Lo que aporta el humano (no lo resuelve el agente)

- Crear el proyecto en Supabase y pasar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- Crear el repo en GitHub y conectar Render (API) y Vercel (web).
- Decisiones de producto/negocio (reglas de comisión, objetivos, alcance funcional).
