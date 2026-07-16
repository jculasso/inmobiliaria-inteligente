# Guía de arranque a CODE — Inmobiliaria Inteligente 2.0

Guía paso a paso para pasar del prototipo a la versión productiva usando Claude Code. Pensada para hacerse una sola vez, en orden. Tiempo estimado de la parte manual (cuentas): ~30–45 min.

---

## 0. Antes de abrir Claude Code — lo que tenés que preparar vos

El agente escribe el código, pero no puede crear cuentas ni tener tus llaves. Preparar esto primero evita frenarse a mitad de camino.

### 0.1 Cuentas (todas tienen free tier)
1. **GitHub** — crear un repositorio vacío y privado: `inmobiliaria-inteligente`.
2. **Supabase** — crear un proyecto (elegí región cercana, ej. São Paulo). Guardá de *Project Settings → API* y *Database*:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secreta, no la expongas en el front)
   - `DATABASE_URL` (connection string de Postgres, con contraseña)
3. **Vercel** — cuenta conectada a tu GitHub (para desplegar la web más adelante).
4. **Render** — cuenta conectada a tu GitHub (para desplegar la API más adelante).

> Nota sobre el free tier de Supabase: el proyecto se **pausa tras ~1 semana sin actividad**. Mientras desarrollás activo no molesta; si lo dejás quieto, entrá al dashboard o corré una consulta para reactivarlo. Cuando entre el primer cliente pago, se pasa a Supabase Pro.

### 0.2 Herramientas locales
- Node.js LTS y **pnpm** (`npm i -g pnpm`).
- Git configurado.
- Claude Code instalado.
- Editor (VS Code o el que uses).

### 0.3 Los documentos del kit
Tené a mano estos archivos (los generamos juntos) para copiarlos al repo:
- `CLAUDE.md`
- `docs/Arquitectura_Inmobiliaria_Inteligente.md`
- `docs/MODELO_DATOS_TABLERO.md`
- `docs/prototipos/` → los 3 HTML (home, tablero, tasador)
- `PROMPTS_INICIALES_CODE.md` (para copiar/pegar los prompts)

---

## 1. Inicializar el repo (5 min, manual)

```bash
git clone git@github.com:<tu-usuario>/inmobiliaria-inteligente.git
cd inmobiliaria-inteligente

# Copiá los documentos del kit:
mkdir -p docs/prototipos
cp <ruta>/CLAUDE.md ./CLAUDE.md
cp <ruta>/Arquitectura_Inmobiliaria_Inteligente.md docs/
cp <ruta>/MODELO_DATOS_TABLERO.md docs/
cp <ruta>/home_inmobiliaria_inteligente.html docs/prototipos/
cp <ruta>/tablero_vacker_offline.html docs/prototipos/
cp <ruta>/tasador_vacker.html docs/prototipos/

git add . && git commit -m "chore: bootstrap docs y CLAUDE.md" && git push
```

Con esto, cuando abras Claude Code en esta carpeta, ya tiene todo el contexto (lee `CLAUDE.md` automáticamente).

---

## 2. Cómo trabajar con Claude Code (workflow)

**El patrón que funciona:** un paso de la Fase 1 = una sesión enfocada = un PR. No le pidas "construí todo"; avanzá paso por paso, revisando y commiteando.

Ciclo por cada paso:
1. Abrí Claude Code en la carpeta del repo.
2. Elegí el modelo según la tarea (ver §3) y pegá el prompt correspondiente de `PROMPTS_INICIALES_CODE.md`.
3. Dejá que planifique; **leé el plan antes de que ejecute**. Si algo se desvía del `CLAUDE.md`, corregilo ahí mismo.
4. Que implemente, corra typecheck + tests, y te muestre el diff.
5. Verificá la "definición de hecho" (§7 del `CLAUDE.md`). Si está en rojo, no avances.
6. Commit + push + PR. Recién ahí pasás al siguiente paso.

Consejos:
- **Contexto fresco por paso.** Cuando termines un paso, empezá el siguiente en una sesión nueva para no arrastrar ruido.
- **Pedile tests siempre.** Sobre todo el test de aislamiento multi-tenant en el paso del núcleo.
- **Nunca commitees `.env`.** Que genere `.env.example`; las llaves reales las ponés vos localmente y en Render/Vercel.
- Si te ofrece scaffoldear de más (módulos que no tocan todavía), frenalo: seguimos el orden de la sección 19.

---

## 3. Qué modelo usar en cada paso

| Paso | Modelo | Por qué |
|---|---|---|
| 1. Fundaciones (monorepo, DS, CI) | **Opus 4.8** | Decisiones de estructura que condicionan todo |
| 2. Núcleo (tenant, RLS, auth, RBAC) | **Opus 4.8** | Lo más delicado del proyecto |
| 3. Módulo Tablero (API + KPIs) | **Opus 4.8** para el diseño de servicios y cálculos; **Sonnet 5** para el CRUD | Mezcla lógica no trivial + volumen |
| 4. Home autenticada | **Sonnet 5** | Bien especificado |
| 5. Tablero web con datos reales | **Sonnet 5** | Integración guiada por el prototipo |
| Ediciones triviales, renombres | **Haiku 4.5** | Rápido y barato |

Regla: **lo estructural con Opus, el volumen con Sonnet.**

---

## 4. Secuencia de la Fase 1 (qué entrega cada paso)

1. **Fundaciones** — monorepo pnpm+Turborepo, `packages/config`, `packages/ui` con tokens Vacker, `apps/api` (NestJS vacío) y `apps/web` (Next.js vacío) que arrancan, CI en GitHub Actions (lint+typecheck+test).
2. **Núcleo backend** — Prisma + migraciones de las tablas del núcleo (`tenant`, `usuario`, `usuario_rol`), RLS activada, integración con Supabase Auth detrás de una abstracción, guard de RBAC, y **test que prueba el aislamiento entre dos tenants**. OpenAPI sirviéndose.
3. **Módulo Tablero (API)** — tablas `operacion`, `operacion_punta`, `objetivo`; endpoints CRUD + endpoints de KPIs/ranking/objetivos con el scope por rol; seed idempotente con los datos reales del prototipo.
4. **Home autenticada** — login contra Supabase Auth, y la home (3 módulos) mostrando/ocultando módulos según el rol del usuario.
5. **Tablero web con datos reales** — la vista del tablero consumiendo la API (KPIs, ranking, alta/edición de operaciones y vendedores), reemplazando el `localStorage` del prototipo.

Después de Fase 1: endurecer PWA → app React Native → **Tasador** (cuando cierre su MVP) → **To Do List** (OAuth Google Calendar + vista semanal).

---

## 5. Despliegue (cuando el paso lo amerite)

- **Web (Vercel):** conectar el repo, root del proyecto `apps/web`, cargar las env vars públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Deploy automático por push a `main`.
- **API (Render):** nuevo Web Service desde el repo, root `apps/api`, build `pnpm install && pnpm build`, start `node dist/main.js`, cargar `DATABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Recordá que el free se duerme (~1 min de cold start).
- **Migraciones:** correrlas en el pipeline o manualmente contra la BD de Supabase; nunca a mano en producción sin control de versiones.

No hace falta desplegar en los pasos 1–2 (todo local). A partir del 4 conviene tener la web y la API online.

---

## 6. Errores comunes a evitar

- Dejar `tenant_id`/RLS "para después" → es lo más caro de retrofitear. Va en el paso 2, sí o sí.
- Meter lógica de KPIs en el frontend → va en la API (capa de servicio).
- Tratar el prototipo como base de código → es referencia, se construye limpio.
- Commitear llaves de Supabase → solo env vars.
- Saltar la "definición de hecho" con tests en rojo → no avanzar.

---

## 7. Checklist de listo-para-arrancar

- [ ] Repo GitHub creado y clonado
- [ ] Proyecto Supabase creado; 4 llaves guardadas
- [ ] Cuentas Vercel y Render conectadas a GitHub
- [ ] pnpm, Node LTS, Claude Code instalados
- [ ] Documentos del kit copiados al repo y commiteados
- [ ] Primer prompt (paso 1) listo para pegar con Opus 4.8
