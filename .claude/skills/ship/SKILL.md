---
name: ship
description: Lleva un cambio ya hecho desde el working tree hasta main — rama, verificación local, commit convencional, PR, espera de CI y merge con rebase. Usar cuando el trabajo esté terminado y haya que publicarlo.
---

# Publicar un cambio

De working tree sucio a `main` verde. `main` siempre tiene que quedar
desplegable: Vercel y Render despliegan desde ahí.

Todo comando de Node necesita el PATH de nvm en **cada** llamada a Bash:

```bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
```

## 1. Rama

Nunca commitees a `main` directo.

```bash
git checkout -b feat/<modulo>-<detalle>
```

Prefijo según el cambio: `feat/`, `fix/`, `chore/`, `test/`, `docs/`.

## 2. Verificar en local antes de gastar CI

Los tres que corre CI, en el mismo orden:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Si tocaste algo del front que se ve en pantalla, verificalo en el navegador
además de los tests — la skill `verificar-ui` explica cómo.

**La definición de hecho (CLAUDE.md §7) no es negociable**: compila, tests en
verde, OpenAPI actualizado si cambió la API, sin secretos en el código, env
vars nuevas documentadas en `.env.example`.

## 3. Commit

Conventional Commits, en español, explicando **el porqué** y no solo el qué —
el mensaje es lo que va a leer alguien dentro de seis meses.

```
fix(admin): la tarjeta de la clave de Tokko quedaba abajo de 20 usuarios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 4. PR

```bash
git push -u origin HEAD
gh pr create --fill
```

El cuerpo tiene que decir **qué se hizo y cómo probarlo** — no un resumen del
diff, que ya se ve solo. Cerrá con:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 5. Esperar CI — de verdad

CI corre **dos** jobs y los dos tienen que dar verde:

| Job | Qué hace |
|---|---|
| `Lint · Typecheck · Test` | los tres del paso 2 |
| `End to end` | build de web + Playwright en Chromium y WebKit |

```bash
gh pr checks --watch
```

**Esperá a que reporte.** Ya se mergearon tres PRs antes de que CI dijera nada
(#115, #122, #121); salieron bien de casualidad y hubo que quedarse mirando el
run sobre `main` para confirmarlo. Mergear a ciegas convierte `main` en un
lugar donde no se sabe qué hay.

Si el e2e falla de forma intermitente, mirá el reporte de Playwright que CI
guarda como artefacto antes de asumir que es flakiness.

## 6. Merge y volver

```bash
gh pr merge --rebase --delete-branch
git checkout main && git pull
```

Rebase, no merge commit: el historial se lee lineal.

## 7. Si el cambio incluye una migración de Prisma

Render corre `prisma migrate deploy` al desplegar, así que la migración se
aplica sola al mergear. Antes de llegar acá tenía que estar validada contra la
base real dentro de `BEGIN … ROLLBACK` — ver la skill `sql-produccion`.

Toda tabla de negocio nueva lleva **RLS** más su `REVOKE`/`GRANT`, y se suma a
`isolation.e2e-spec.ts`. Si no está en ese test, el aislamiento no está
verificado por más que la policy exista.
