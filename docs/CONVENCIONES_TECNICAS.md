# Convenciones técnicas

> Reglas que ya nos costaron una vez y no conviene volver a descubrir.
> Complementa a `CLAUDE.md` (el qué y el porqué del proyecto) y al documento de
> arquitectura (las decisiones grandes). Esto es el **cómo**, al nivel del día a día.
>
> Criterio para que algo entre acá: si romperlo produce un bug que ya ocurrió, o
> si la razón de una decisión no se deduce leyendo el código. Lo que ya está
> protegido por un test se menciona **con el nombre del test**, porque el test
> es la regla y esto es solo el mapa.

---

## 1. Aislamiento entre inmobiliarias (RLS)

Para **cada tabla de negocio nueva**, sin excepción:

1. **Crear la migración** con `prisma migrate dev --create-only` y editar el
   `migration.sql` a mano para agregar al final:
   ```sql
   ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON <t>
     USING      (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
     WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
   ```
2. **Revocar antes de otorgar**: `REVOKE ALL ON <t> FROM anon, authenticated;` y
   recién después los `GRANT` mínimos. Supabase le da TRUNCATE/TRIGGER/REFERENCES
   a `anon` y `authenticated` en cada tabla nueva, y **TRUNCATE ignora RLS**.
3. **Todas las queries de negocio van por `TenantPrismaService.withTenant`**
   (`apps/api/src/prisma/tenant-prisma.service.ts`). Nunca `PrismaService` directo:
   corre como `postgres`, que tiene BYPASSRLS. `PrismaService` es solo para
   migraciones, seed y el panel de plataforma (que es cross-tenant a propósito).

**El test que lo fija:** `apps/api/test/isolation.e2e-spec.ts`. Corre contra la
base real dentro de una transacción con `ROLLBACK`, así que no deja residuo. Se
saltea solo si no hay `DIRECT_URL`.

**Ese patrón sirve para más que el test.** Para reproducir un bug contra datos
reales sin tocarlos: abrir transacción, hacer lo que haga falta, `ROLLBACK`. Es
como se validó la migración de `codigo_num` antes de mergearla.

---

## 2. Vista y permiso son dos preguntas distintas

En `apps/api/src/modules/tablero/scope.util.ts` hay **dos** funciones y la
separación es deliberada:

- **`scopeDeVista(ctx, tx, verTodo)`** — qué se muestra. El default es lo propio
  para todos; el check "Ver todo" expande al máximo del rol. Los admins ven todo
  siempre (no tienen puntas propias: arrancarlos en "lo mío" sería una pantalla
  vacía).
- **`scopeDePermiso(ctx, tx)`** — qué puede tocar. **Siempre** el máximo del rol,
  sin mirar el check de la pantalla.

Cómo se traduce eso a lo que ve cada uno (confirmado con el usuario el 29/07/2026):

| Rol | Al entrar ve | Con "Ver todo" | ¿Le aparece el check? |
|---|---|---|---|
| **Vendedor** | solo lo suyo | — | No: ya está en su alcance máximo |
| **Team leader** | solo lo suyo | él + sus vendedores | Sí |
| **Dirección (CEO)** | **solo lo suyo** | toda la inmobiliaria | Sí |
| **Admin** (tenant o plataforma) | **toda la inmobiliaria** | — | No: ya ve todo |

La asimetría entre dirección y admin es deliberada. El admin no tiene puntas
propias, así que abrirle en "lo mío" sería una pantalla vacía. El CEO sí las
tiene —en Vacker es además vendedor, con sus propias operaciones que seguir— y
abrir en lo suyo es lo que le sirve.

Fueron una sola función hasta el 28/07/2026. Al invertir el default del check se
invirtieron las dos a la vez y un CEO mirando "lo mío" dejaba de poder abrir la
operación de cualquier otro.

`verTodo` llega por query param, o sea que lo controla el cliente: **nunca puede
agrandar el alcance más allá del rol**. Lo fija `scope.util.spec.ts`.

**Una venta puede tener una punta tuya y otra ajena.** La ajena no se muestra —ni
el nombre ni su comisión— pero la operación sí aparece, porque una punta es tuya.

El enmascarado usa **el mismo alcance con el que se filtró la lista** (el de la
vista). Así la comisión de la columna suma siempre lo mismo que el tablero, que
es la única forma de que los dos números se puedan comparar.

Se probó primero con el alcance del ROL y estaba mal: el CEO —que además es
vendedor— destildaba "Ver todo" para mirar sus números y veía la comisión
completa de una venta compartida, o sea que su tabla contradecía a su propio
tablero. **Lo que se muestra tiene que sumar lo mismo que lo que se calculó.**

`cantPuntas` conserva el número real: cuántas puntas tuvo la venta no es
confidencial, el nombre sí. Y `comTotal` se recalcula **solo si se ocultó algo**,
porque los alquileres no tienen puntas y recalcularlos los dejaría en cero. Lo
fijan `operaciones.service.spec.ts` y `kpis.calc.spec.ts`.

---

## 3. Quién escribe en el Tablero

Alta, edición y borrado de operaciones son de **dirección y admin del tenant**.
El vendedor y el team leader leen —lo necesitan para sus KPIs, ranking y
objetivos— pero no escriben.

La pantalla de **Vendedores** (equipo + objetivos) es de dirección y admin: ver y
gestionar coinciden a propósito, así que no tiene modo lectura.

**Esta regla ya se dio vuelta una vez**: hasta el 28/07/2026 el vendedor cargaba
sus propias operaciones y estaba documentado como intencional. Por eso hay tests
que leen la metadata de `@Roles` —`operaciones.roles.spec.ts` y
`vendedores.roles.spec.ts`—: si alguien vuelve a agregar `vendedor` a un POST
creyendo que restaura algo roto, CI se pone en rojo y lo obliga a leer el porqué.

---

## 4. El middleware y todo lo que se pide sin sesión

Cualquier archivo que el navegador pida **antes de haber entrado** tiene que
quedar fuera del matcher o en `PUBLIC_PATHS`: `manifest.webmanifest`, `sw.js`,
`/icons/*`, `/offline`, `flyer-comercial.pdf`.

**Pasó tres veces**: los íconos daban redirect al login, `/offline` cacheaba la
pantalla de login, y el flyer comercial —que se le manda a prospectos sin
cuenta— devolvía 307.

Lo fija **`apps/web/middleware.test.ts`** en 12 casos. Al sumar un archivo así,
sumalo también ahí.

---

## 5. PWA: lo que no hay que romper

- **El service worker cachea SOLO estáticos.** Nunca respuestas de la API ni
  páginas con datos: la caché es **por dispositivo, no por usuario**, y en un
  celular compartido eso expondría a una persona frente a otra.
- **Al tocar el service worker, subir `VERSION`** en `apps/web/public/sw.js`, o
  los clientes se quedan con la caché vieja.
- **Instalada no hay barra del navegador**: toda pestaña que se abra con
  `window.open` necesita su propia salida. La del PDF dejaba al usuario encerrado
  hasta que se le puso "← Volver".
- **El ícono es el de la plataforma**, no el de una inmobiliaria: se instala
  desde una URL y la usan varios clientes. El logo del tenant va en la cabecera.

---

## 6. iOS agranda la pantalla con campos de menos de 16px

Es la causa del "baile": al enfocar un `input` con letra menor a 16px, iOS Safari
hace zoom, la ventana visible se achica y la página entera se puede arrastrar de
costado. Medido en un iPhone 14 Pro Max: layout de 430px contra 377px visibles —
factor 430/377 = 16/14, exacto.

La regla vive en `apps/web/app/globals.css` con `!important` (tiene que ganarle a
`text-sm` de Tailwind) y hasta 640px. La fija `apps/web/estilos-globales.test.ts`.

**Cualquier pantalla nueva la hereda. No bajar de 16px en campos móviles.**

---

## 7. Ordenar por número cuando el dato es texto

El código de operación es texto libre (`OP-1001`, `ALQ-999`). Ordenar texto **no**
da orden numérico: `OP-1001` queda antes que `OP-999` porque se compara carácter
por carácter.

Por eso existe `operacion.codigo_num`, una columna `GENERATED ALWAYS` que calcula
Postgres. **Nunca escribirla desde la aplicación** — la base rechaza el insert.

La misma regla está implementada dos veces a propósito: en SQL para ordenar en la
base, y en `numeroDeCodigo` (`@vacker/types`) para ordenar en el navegador cuando
la lista vino completa. **Tienen que dar lo mismo**; si se separan, el orden
cambia según dónde se calculó. Lo fija `orden-operaciones.test.ts`.

**Trampa al restaurar desde un respaldo:** `insert into operacion select * from …`
falla, porque la copia incluye `codigo_num`. Hay que enumerar las columnas salvo
esa.

---

## 8. Enums vacíos en filas viejas

Filas anteriores a la lógica `value || null` del front pueden tener enums
opcionales guardados como **cadena vacía** en vez de `null`. Los schemas de
lectura los declaran `.nullish()`, que acepta `null` pero **no `''`** → la
validación Zod de toda la respuesta falla y la pantalla se cae con "no tiene el
formato esperado".

**Se normaliza `'' → null` en `toDto`.** No hace falta migrar datos: al
re-guardar, el write path manda `null` y se corrige solo.

**Para diagnosticarlo rápido:** ese mensaje es la validación de `apiFetch`, e
incluye `[campo: msg]` del primer problema. Se mira en los logs de **Vercel**, no
de Render: el fetch Vercel→Render es servidor a servidor, invisible al navegador.
Las `HttpException` de la API no se loguean en Render, por eso "no se ve nada".

---

## 9. La foto de perfil se escribe desde dos lados

El panel de plataforma y el Tablero cambian la misma foto. Las reglas —bucket,
tope de 5MB, cómo se arma la ruta— viven en `apps/api/src/common/avatar.ts` y las
comparten los dos caminos.

La ruta es determinística por usuario (`tenantId/usuarioId.ext`): volver a subir
sobreescribe, no deja huérfanos. **Un usuario, una foto**, no dos que se
contradicen según por dónde se subió.

---

## 10. Antes de cualquier SQL masivo en producción

1. **Contar las inmobiliarias**: `select id, nombre from tenant;`. Desde el editor
   SQL se corre como `postgres`, que pasa por encima de RLS — un `delete` sin
   `where tenant_id = …` alcanza a **todas**.
2. **Mostrar primero** qué se va a tocar, agrupado.
3. **Copiar antes de borrar** al esquema `respaldo` (nunca a `public`: Supabase
   expone `public` por su API).
4. **Verificar** los conteos de la copia.
5. **Borrar dentro de `begin; … commit;`** y verificar después.

El 28/07/2026 una purga se llevó puestas 30 tasaciones de un segundo tenant que
nadie recordaba que existía. Se recuperaron **solo** porque el paso 3 estaba
hecho.

---

## 11. Auditorías: cada cuánto y por qué esa frecuencia

Acordado con el usuario el 29/07/2026. Las tres están agendadas como tareas
automáticas; esto documenta **el criterio**, que es lo que hay que revisar si
alguna deja de aportar.

| Auditoría | Frecuencia | Disparador que vale más que la fecha |
|---|---|---|
| **Seguridad** | Mensual (día 5) | **Antes de dar de alta cada inmobiliaria nueva** |
| **Código** | Bimestral (día 12) | **Al cerrar cada módulo** |
| **Performance** | Trimestral (día 19) | **Cuando una lista pase las 300 filas** |

**Seguridad va mensual porque el aislamiento entre inmobiliarias es la promesa
central del producto.** Un bug ahí no es un error, es existencial. CI lo
verifica en cada PR, pero solo sobre las tablas que alguien se acordó de agregar
a `isolation.e2e-spec.ts`: lo que se escapa es siempre lo nuevo. Con un solo
cliente real una fuga es teórica; con dos, no — por eso el disparador por alta
de inmobiliaria pesa más que el calendario.

**Código va bimestral porque la calidad se degrada despacio.** Mensual
encontraría lo mismo dos veces seguidas y se volvería trámite. El momento en que
los patrones más divergen es al cerrar un módulo, no el día 12.

**Performance está atada al volumen, no al calendario.** Hasta que se haga la
migración de infraestructura, una auditoría de performance va a decir siempre lo
mismo —que la API corre lejos de la base—, y repetirlo gasta atención. Lo que sí
cambia es el tamaño: el tope de 500 filas y los KPIs en memoria alcanzan hasta
cierto punto. La tarea agendada **mide primero y se detiene** si el volumen no
creció.

**Las tres reportan, no arreglan.** Un informe que además aplica cambios obliga a
revisar código y hallazgos al mismo tiempo, que es cuando se aprueba de más.
