---
name: plan-tecnico
description: Baja una especificación a un plan de implementación ordenado por capa — tipos compartidos, migración con RLS, módulo de API, web, tests y cierre. Incluye las trampas de arquitectura de este repo (fuente única, queries que no escalan con las filas). Usar después de especificar y antes de codificar.
---

# Plan técnico

La spec dice **qué**. Esto dice **en qué orden y en qué capa**, que en este
repo casi siempre es el mismo orden — y saltearlo tiene consecuencias
conocidas.

## El orden, y por qué es ese

### 1. `packages/types` — primero, siempre

Schemas Zod y constantes que comparten los dos lados.

**Una constante, una sola vez.** `ROLES_PUBLICACION` se escribió dos veces —una
en el front, otra en el `@Roles` de la API— y las listas se separaron: la API
devolvía 403 y el borde de error lo mostraba como "no pudimos conectar con el
servidor". Ahora vive en `packages/types` y hay un test que verifica que el
`@Roles` del controller es exactamente esa lista.

Va primero porque API y web dependen de él: si lo dejás para el final, escribís
la lista dos veces sin darte cuenta.

Si sumás un rol, revisá también `RolAsignableSchema` y el formulario que
preserva roles al editar un usuario — `publicador` quedó sin poder asignarse y
además se descartaba en silencio.

### 2. Migración de Prisma

Tabla nueva = `tenant_id` + **RLS** + `REVOKE`/`GRANT`. No es opcional: el
aislamiento entre inmobiliarias es la promesa central del producto.

- Validala contra la base real dentro de `BEGIN … ROLLBACK` antes de aplicarla
  (skill `sql-produccion`).
- Sumala a `apps/api/test/isolation.e2e-spec.ts`. **Sin esa línea el
  aislamiento no está verificado**, por más que la policy exista: el test solo
  cubre las tablas que alguien se acordó de agregar.
- Ojo con las columnas `GENERATED ALWAYS` — `operacion.codigo_num` es una, y
  rompe cualquier `insert … select *`.

### 3. Módulo de API

Anatomía, tal como está en `apps/api/src/modules/publicacion/`:

```
<modulo>.module.ts       registra el módulo
<modulo>.controller.ts   @Modulo('<key>') + @Roles(...) + validación Zod
<modulo>.service.ts      queries por TenantPrismaService.withTenant
<modulo>.service.spec.ts
<modulo>.roles.spec.ts   que los @Roles sean la constante compartida
```

**Nunca `PrismaService` directo** para datos con aislamiento.

Cada endpoint valida entrada con Zod y verifica rol + tenant **antes** de tocar
datos.

### 4. Web

- Página en `apps/web/app/<modulo>/`.
- El gate de UI en `apps/web/lib/rbac.ts`, **espejo literal** del `@Roles` del
  controller. Ocultar el botón no es seguridad: quien manda es la API. Pero
  ofrecer una acción que la API va a rechazar con 403 es peor que no ofrecerla.
- Si el navegador va a pedir algo **sin sesión** (íconos, manifest, un PDF
  público): a `PUBLIC_PATHS` **y** a `middleware.test.ts`. Se olvidó tres veces.

### 5. Tests, uno por regla numerada de la spec

El número de la regla en el nombre del test. Si una regla quedó sin test, o
sobra la regla o falta el test.

### 6. Cierre

Definición de hecho (`CLAUDE.md` §7): typecheck, tests en verde, OpenAPI
actualizado si cambió la API, sin secretos, env vars nuevas en `.env.example`.
Después, `ship`.

## La trampa de performance de este proyecto

**La API está en Oregon y la base en São Paulo.** Cada ida y vuelta cuesta, y
se nota apenas hay volumen: importar 25 propiedades con 2 queries por fila
excedió el timeout de 15 segundos de la transacción. Con 10 andaba.

Regla: **el número de queries no puede crecer con el número de filas.** Traé
todo lo que necesites en una consulta y resolvé en memoria.

Y el test que lo protege no mide tiempo —eso es flaky— sino **cuenta queries**
para N=5 y N=25 y verifica que sea el mismo número.

Lo mismo vale para las listas: cuando una pase las 300 filas, toca paginar de
verdad y calcular los KPIs como agregados SQL, no en el cliente.

## Antes de empezar a escribir

Cerrá el plan con dos cosas:

1. **Cuál es el paso más riesgoso** y cómo vas a saber temprano si salió mal.
2. **Qué se puede verificar en el navegador** y qué no (skill `verificar-ui`).
   Lo que no se puede ver ahí necesita un test que lo cubra, porque nadie lo va
   a mirar.
