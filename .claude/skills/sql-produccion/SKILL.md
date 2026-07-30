---
name: sql-produccion
description: Ejecuta un SQL masivo (DELETE/UPDATE de muchas filas) contra la base de producción siguiendo el procedimiento obligatorio — contar inmobiliarias, mostrar, copiar a respaldo, verificar, borrar en transacción. Usar SIEMPRE que se vayan a modificar o borrar datos de negocio en producción.
---

# SQL masivo en producción

La base es **Supabase free: no hay backups automáticos.** Lo que se borra sin
copia previa, se perdió. Este procedimiento existe porque el 28/07/2026 una
purga se llevó puestas 30 tasaciones de un segundo tenant que nadie recordaba
que existía; se recuperaron **solo** porque la copia estaba hecha.

El detalle y el porqué están en `docs/CONVENCIONES_TECNICAS.md` §10.

## La regla que se viola sola

Desde el editor SQL de Supabase se corre como `postgres`, que **pasa por encima
de RLS**. Un `delete` sin `where tenant_id = …` alcanza a **todas** las
inmobiliarias, no solo a la que tenés en la cabeza.

En la base conviven al menos dos: **Vacker** (cliente real) y **Sanso
Propiedades** (la demo). Nunca asumas que hay una sola — verificalo.

## Procedimiento

Seguí los seis pasos en orden. No saltees el 3 aunque el borrado parezca
trivial.

### 1. Contar las inmobiliarias

```sql
select id, nombre from tenant order by nombre;
```

Decí en voz alta cuáles van a quedar afectadas y cuáles no. Si el SQL no lleva
`where tenant_id = …`, justificá explícitamente por qué.

### 2. Mostrar qué se va a tocar, agrupado

Antes de escribir el `delete`/`update`, escribí el `select` equivalente
agrupado por tenant:

```sql
select t.nombre, count(*)
from <tabla> x join tenant t on t.id = x.tenant_id
where <las mismas condiciones del borrado>
group by t.nombre order by t.nombre;
```

Mostrale los números al usuario y **esperá confirmación** antes de seguir.

### 3. Copiar al esquema `respaldo`

Nunca a `public`: Supabase expone `public` por su API REST, así que una copia
ahí queda accesible desde afuera.

```sql
create schema if not exists respaldo;
create table respaldo.<tabla>_<AAAAMMDD> as
select * from <tabla> where <las mismas condiciones>;
```

### 4. Verificar la copia

```sql
select count(*) from respaldo.<tabla>_<AAAAMMDD>;
```

Tiene que coincidir con el paso 2. Si no coincide, **parar**.

### 5. Borrar dentro de una transacción

```sql
begin;
delete from <tabla> where <condiciones>;
-- verificá el conteo acá adentro
select count(*) from <tabla> where <condiciones>;  -- debe dar 0
commit;
```

Si algo no cuadra: `rollback;`.

### 6. Verificar después

Volvé a correr el `select` del paso 2 y confirmá el estado final.

## Al restaurar desde `respaldo`

**`insert … select *` falla en `operacion`.** La columna `codigo_num` es
`GENERATED ALWAYS ... STORED` y Postgres no acepta que se le inserte un valor.
Hay que enumerar las columnas:

```sql
insert into operacion (id, tenant_id, codigo, /* … todas menos codigo_num … */)
select id, tenant_id, codigo, /* … */ from respaldo.operacion_20260728;
```

## Validar una migración antes de aplicarla

Convención del proyecto: probá el SQL contra la base real dentro de
`BEGIN … ROLLBACK` para que corra de verdad pero no deje nada.

```bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
```

Conectate con `DIRECT_URL` (no el pooler) desde `apps/api`, envolviendo el
script en `begin; … rollback;`.

## Lo que NO se hace nunca

- **Cambiar el email de un usuario directo en la base.** Vive en la tabla
  `usuario` **y** en Supabase Auth: tocarlo de un solo lado lo deja sin poder
  entrar.
- **Escribir en producción desde los tests e2e.** CI usa variables de entorno
  falsas a propósito.
- **`drop schema respaldo cascade;`** mientras haya datos de cliente ahí.
