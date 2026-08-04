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

---

## 12. El importador de Tokko da de baja lo que no viaja en el archivo

La API de propiedades de Tokko es de **solo lectura**. Para escribir hay un
importador: `POST /property_importer/` con `{url, callback_url}`. Tokko va a
buscar el archivo y responde con seis listas, una de ellas **`disabled_list`**:
"propiedades quitadas del archivo de importación".

Ahí está el peligro: **el feed se interpreta como el inventario completo.**
Mandar las 5 propiedades que gestionamos daría de baja las otras 384 que la
inmobiliaria tiene publicadas. Lo confirmó Tokko por escrito.

Por eso:

- **El feed se arma leyendo Tokko en el momento de mandarlo**, nunca desde
  nuestra tabla `propiedad`. Tenemos importadas 25 de 389: generarlo desde la
  base daría de baja 364.
- Las que no gestionamos viajan igual, como entrada mínima
  (`reference_code` + su `updated_at` actual) para que caigan en
  `not_updated_list` y no en `disabled_list`.
- **Nada de esto se prueba contra la cuenta real.** Hace falta el ambiente de
  prueba, que se pide al ejecutivo de cuenta de Tokko.

Dato contraintuitivo, verificado el 30/07/2026 contra las 389 propiedades: la
fecha de última modificación viene en el campo **`deleted_at`**, no en un
`updated_at` (que no existe en la respuesta). Ninguna está en null y se mueve
en vivo. Apoyarse en un campo con ese nombre es frágil: si Tokko lo corrige o
empieza a usarlo para bajas reales, la lógica se rompe **en silencio**. Va con
una verificación que falle fuerte si aparece nulo o con fecha futura.

---

## 13. El color de marca no puede pintar la urgencia

Cada inmobiliaria define su `colorPrimario`, y `tenant-style.ts` lo aplica
pisando `--color-brand-red`. Eso está bien para botones, pestañas activas y
links: es la marca.

**No está bien para la severidad.** Jorgito Propiedades tiene marca azul
(`#0B5FA5`), y las alertas críticas del Protocolo salían **azules**: nada
resaltaba y el reporte de la dirección parecía estar todo en orden. Con una
marca verde, una alerta crítica se vería verde.

Por eso existe **`--color-danger`**, que ninguna inmobiliaria pisa. La regla:

| Para qué | Token |
|---|---|
| Botón primario, pestaña activa, link | `brand-red` |
| Alerta urgente, vencido, atrasado | **`danger`** |
| Advertencia, en curso | `warning` |
| Completo, al día | `success` |

Antes de usar `brand-red` en algo, preguntarse: **¿esto sería igual de correcto
si la inmobiliaria fuera verde?** Si la respuesta es no, va `danger`.

Reportado el 30/07/2026 por el usuario mirando el reporte semanal: "pone todo
verde en las semanas". No estaba todo verde — lo rojo estaba azul.

---

## 14. Los PDF: el nombre del archivo y la tipografía

Dos cosas que se descubren tarde, mirando un PDF ya generado.

### El nombre solo llega por nuestro botón "Descargar"

Los informes se generan con un `POST` autenticado, así que el navegador nunca
navega a una URL del archivo: recibe los bytes y se arma una **URL `blob:`**,
que es **opaca — no lleva nombre**.

Si el usuario guarda desde el visor de PDF del navegador (el ícono de disquete
que está DENTRO del iframe), el archivo sale como `98b7e19d-6834-….pdf`. Ese
visor solo ve el `blob:`.

El nombre real llega **únicamente** por el enlace `<a download="...">` que
`abrir-pdf.ts` pone en la cabecera de la pestaña. Por eso ese botón está en
estilo primario y tiene que seguir estándolo. La cabecera `Content-Disposition`
que arma `pdf-response.ts` sirve para que el front sepa cómo llamar al archivo,
no para que el visor lo respete.

Reportado el 30/07/2026: llegó un PDF llamado con un UUID.

### Un carácter que no está en Montserrat arrastra una segunda tipografía

react-pdf incrusta **Helvetica por cada carácter** que no encuentre en la
familia registrada. **Montserrat no tiene `✓` (U+2713) ni `→` (U+2192)**, entre
otros símbolos. Un solo ✓ en la tira de semanas metía Helvetica-Bold dentro de
un informe de marca.

En pantalla el ✓ funciona —ahí manda el navegador— pero en el PDF no. Cuando
haga falta un símbolo, revisar que exista en la fuente o usar un número.

Lo fija **`fuentesUsadasEnPdf`** (`common/texto-pdf.ts`), con un test por
informe. Mira lo que el PDF **dibuja**, no lo que declara: react-pdf emite un
`/F1 Tf` seleccionando Helvetica hasta para un texto vacío, y contar eso sería
denunciar un problema que no existe.

Ese mismo archivo tiene **`textoDePdf`**, que devuelve el texto legible: el
texto de un PDF no viaja como texto (la fuente va recortada y lo que se escribe
son ids de glifo), así que sin esto solo se podía verificar que el archivo se
generara, no qué decía.

---

## 15. La trampa para robots se revisa ANTES de validar

El formulario del sitio comercial lleva un campo oculto llamado `sitio`. Una
persona no lo ve y nunca lo completa; un robot que rellena todo lo que
encuentra, sí. Es la señal más barata que hay para descartar spam.

La primera versión lo tenía al revés: el campo estaba en el esquema de Zod con
`max(0)`, así que un `sitio` con contenido **fallaba la validación** y el
endpoint devolvía 400 antes de llegar a la línea que revisa la trampa. El
chequeo era código muerto y el robot se llevaba, justamente, la confirmación de
que lo habíamos detectado.

**El orden importa y es este:** leer el cuerpo → si la trampa vino llena,
devolver `200 {ok:true}` sin enviar nada → recién entonces validar. Al robot hay
que dejarlo convencido de que la consulta entró.

Lo fija `apps/sitio/app/api/contacto/route.test.ts`. El test no mira el código
de respuesta: mira que **no se haya llamado a `fetch`**. Un 200 se puede
devolver por accidente; un mail no enviado es la prueba real.

---

## 16. Compilar con `next dev` levantado deja el sitio sin estilos

`next build` y `next dev` escriben los dos en `.next`. Compilar mientras el
servidor de desarrollo está corriendo le pisa los archivos: **la página sigue
respondiendo con 200, pero la hoja de estilos da 404.**

El síntoma no se parece a la causa. Lo que se ve es el HTML crudo del
navegador — enlaces azules subrayados, todo en Times New Roman, el logo suelto
ocupando la pantalla entera. Parece que se rompió el diseño, o que una imagen
quedó gigante. Pasó **tres veces el 01/08/2026** y las tres veces el primer
diagnóstico fue el equivocado.

**Cómo reconocerlo en un comando**, antes de tocar una línea de CSS:

```bash
curl -s localhost:3300/ | grep -oE '/_next/static/css/[^"?]*' | head -1
# y pedir esa ruta: si da 404, es esto y no el diseño
```

**Cómo se arregló.** `apps/sitio/next.config.ts` toma el directorio de una
variable:

```ts
distDir: process.env.NEXT_DIST_DIR ?? '.next'
```

`test:e2e` compila con `NEXT_DIST_DIR=.next-e2e`, así que los tests de
navegador ya no tocan lo que está usando quien tiene el sitio abierto. En
Vercel la variable no existe y se compila en `.next`, como siempre.

Separar el directorio arrastra dos cosas que no son obvias, y las dos ya están
resueltas:

- **`tsconfig.json` lleva las DOS rutas** en `include` (`.next/types` y
  `.next-e2e/types`). Next agrega la del build que corre, y si solo estuviera
  una, cada compilación reescribiría el archivo y el árbol quedaría sucio. Con
  las dos escritas, se estabiliza y ningún build lo vuelve a tocar.
- **`apps/sitio/next-env.d.ts` no se rastrea.** Ese sí apunta a un solo
  directorio —el del último build— así que rastrearlo garantizaba un archivo
  modificado después de cada corrida de tests. Es un archivo generado que dice
  en su propio encabezado que no se edita, y `typecheck` pasa sin él.

`apps/web` todavía no tiene esta separación. Si algún día pasa lo mismo ahí, la
solución es la misma.

---

## 17. El aislamiento se prueba por la ruta real, y corre en CI

El test de aislamiento se escribió el 16/07/2026, junto con el núcleo
multi-tenant. Estuvo en el repositorio **sin ejecutarse en CI durante los
dieciocho días siguientes**, incluida la salida a producción con quince
vendedores: el job de calidad no escribe `.env`, y sin `DIRECT_URL` la suite se
salteaba sola. Once comprobaciones en verde que nunca habían corrido. Lo
descubrió una auditoría, no un merge roto.

**Una protección que no se ejecuta no protege.** Por eso ahora hay un job
propio y bloqueante (`Aislamiento multi-tenant`) que levanta un Postgres
descartable, crea los roles `anon` y `authenticated` —que en Supabase vienen de
fábrica y en un Postgres pelado no existen—, aplica las migraciones y pone
PgBouncer en modo transaction delante.

### Por qué el pooler y por qué Prisma

La versión vieja se conectaba con el cliente `pg` crudo al puerto 5432 y
**reimplementaba a mano** el `set_config` de la aplicación. Eso verifica que las
policies estén bien escritas; no verifica el mecanismo que corre en producción.
Si alguien rompía `TenantPrismaService`, el test seguía en verde.

El test de hoy importa `TenantPrismaService` de `src/` y se conecta por el
pooler. **No hay una copia del `set_config` en el test**: si cambia lo que corre
en producción, cambia el test o falla.

### Las tres trampas que hacen que un test de aislamiento mienta

Las tres aparecieron construyéndolo, y las tres darían verde sin probar nada:

1. **Un INSERT rechazado no prueba RLS por sí solo.** Puede haber fallado por
   una columna faltante, una clave foránea rota o un índice único. Por eso cada
   rechazo lleva su control: **la misma fila entrando desde su propio tenant**.
   Si el control no pasa, el rechazo no significaba nada.
2. **La fila intrusa tiene que ser válida en todo salvo el tenant.** Regenerar
   todos los identificadores rompe las claves foráneas. Se regenera solo la
   clave primaria y el discriminante de los índices únicos; las foráneas siguen
   apuntando a filas reales de la víctima.
3. **`tenant` no tiene columna `tenant_id`.** Se identifica por su propio `id`,
   y una consulta genérica falla ahí por columna inexistente — un error que se
   lee como si el aislamiento hubiera bloqueado algo.

### Qué hacer al agregar una tabla

Dos cosas:

1. En la migración: `ENABLE ROW LEVEL SECURITY`, su policy `tenant_isolation` y
   el `GRANT` a `authenticated`. Sin el `GRANT`, las consultas fallan por
   permisos y el error se confunde con un problema de aislamiento.
2. Sumarla a `TABLAS` en `apps/api/test/aislamiento.fixtures.ts`.

**No hace falta acordarse de ninguna de las dos**, y ese es el punto: si falta
la primera, falla la guardia nombrando la tabla; si falta la segunda, falla la
comprobación que compara el esquema contra esa lista. Las dos rompen el merge.

### Verificado rompiéndolo

El 3/08/2026 se comprobó que la guardia muerde: en una rama descartable se quitó
la bajada de rol de `TenantPrismaService` y se agregó una tabla sin RLS.
Resultado: **53 casos en rojo**, incluido el de concurrencia, y la guardia
nombrando la tabla abierta. Un test de seguridad que nunca se vio fallar es una
suposición, no una prueba.

---

## 18. Que `withTenant` aísle no significa que el código lo use

La convención 17 cubre una mitad: `TenantPrismaService.withTenant` aísla, y hay
setenta casos que lo comprueban por la ruta real. La otra mitad no la cubría
nadie. **Nada obligaba a pasar por ahí.**

Un servicio nuevo que consulte con `PrismaService` directo compila, pasa el
typecheck, devuelve datos y se ve correcto en pantalla. Lo único que cambia es
que devuelve los de **todas** las inmobiliarias. No hay error, no hay log, no
hay pantalla rota: es la clase de falla que se descubre cuando un cliente ve el
dato de otro.

Lo que frenaría eso estructuralmente es `FORCE ROW LEVEL SECURITY` — que RLS
aplique incluso al dueño de la tabla. No se puede aplicar hasta tener copias de
seguridad (§20.6 del documento de arquitectura, punto 2). Mientras tanto está
`apps/api/test/acceso-directo.e2e-spec.ts`, que recorre el código y falla si
encuentra un acceso sin contexto.

### Por qué con el compilador y no con grep

Un `grep "prisma\."` da falsos positivos y falsos negativos, y los negativos son
los que importan. **Pasó al escribir este test:** el primer barrido a mano buscó
`prisma: PrismaService` y encontró tres archivos. El análisis con tipos encontró
tres más — la consola de plataforma y `password.service` — que el grep no vio
por un motivo tonto: la propiedad se llama `db`, no `prisma`.

La distinción no se hace por nombre sino por **tipo**. Prisma declara el cliente
transaccional como `Omit<PrismaClient, '$transaction' | '$connect' | …>`:

```
this.prisma.operacion   → receptor PrismaService      → tiene $transaction
tx.operacion            → receptor TransactionClient  → NO tiene
```

Preguntarle al checker por `$transaction` separa los dos casos sin mantener
ninguna lista de nombres. Y como el tipo viaja con la variable, `const db =
this.prisma` y `function f(p: PrismaService)` caen igual: **la indirección no lo
esquiva.** Eso es exactamente lo que un grep no puede hacer.

Se descartó una regla de ESLint porque la config compartida no es *type-aware*
(`packages/config/eslint.config.mjs` usa `tseslint.configs.recommended`, sin
`project`). Habría que encender linting con tipos en todo el monorepo para
resolver un problema de un paquete.

### Lo que NO detecta

Está verificado, no supuesto: se escribieron los tres casos y **pasaron en
verde**. Conviene leerlo antes de confiar en este test más de lo que da.

1. **Un `where` mal armado dentro de `withTenant`.** El camino es correcto y el
   contexto también; lo que filtra mal es la consulta. Otra clase de bug.
2. **Tipo borrado.** `as any`, un parámetro `any`, `(this as any).prisma`. El
   análisis sigue el tipo; si se borra, queda ciego.
3. **Clave dinámica.** `cliente[nombreVariable].findMany()`. Con literal
   (`cliente['operacion']`) sí lo agarra; con variable, no.
4. **Los `.spec.ts` de `src/`**, excluidos a propósito: usan dobles y no se
   despliegan.

### La lista blanca

Se ancla por **archivo + función**, nunca por número de línea: las líneas se
corren con cualquier import que se agregue arriba y la exención terminaría
apuntando a otro lado. Si alguien renombra la función, el test se pone rojo — es
la falla correcta, obliga a mirar. Hay además una comprobación de que ninguna
entrada quedó huérfana, para que la lista no acumule exenciones muertas que
aparentan cobertura.

Hay dos clases de excepción y no valen lo mismo:

- **Cross-tenant por diseño** (`src/admin/*`, el cron de `tareas.service.ts`, el
  `resolvePrincipal` del guard). `withTenant` sería incorrecto: o no hay un
  tenant al que acotarse, o la consulta es justamente la que lo resuelve. Los de
  admin llevan comodín de archivo porque lo son de punta a punta, y todos sus
  endpoints cuelgan de `@Roles('admin_plataforma')`.
- **Seguro por corrección, no por diseño** (`me/password.service.ts`). Podría
  usar `withTenant` y se eligió no hacerlo; es seguro porque filtra por el
  `userId` del token verificado. Va anotado por función y sin comodín, para que
  un método nuevo en ese archivo tenga que justificarse solo.

### Verificado rompiéndolo

Rama descartable con un servicio que consultaba directo, uno con
`$queryRawUnsafe` sobre el cliente dueño, uno con `const alias = this.db`, y uno
que lo pasaba como parámetro a una función suelta. **Los seis accesos salieron
en rojo**, cada uno con su archivo, línea, método y regla. Después se probaron
los tres puntos ciegos de arriba y pasaron en verde, que es como se confirma que
el límite documentado es el límite real.

### El contexto forjado: por qué no lo cubre `FORCE`, y qué lo cubre

La primera versión de este test daba el contexto forjado por incerrable. No lo
es del todo, y sobre todo **no es el mismo problema** que resuelve `FORCE ROW
LEVEL SECURITY`. Vale distinguirlos porque es fácil creer que uno tapa al otro:

- **Consulta que no declara tenant** — un `PrismaService` directo. Ve *todas*
  las inmobiliarias. `FORCE` la frena: sin `app.tenant_id`, la policy no deja
  pasar nada.
- **Contexto forjado** — `withTenant(fn, { tenantId: elDeOtro })`. Ve *una*: la
  equivocada. **`FORCE` no la frena ni podría**, porque el contexto es el valor
  por el que RLS filtra. La base hace exactamente lo que se le pide.

Contra el segundo no hay defensa en la base. La defensa es arquitectónica: que
el contexto se derive del token verificado y no se arme a mano. La **regla D**
del test marca la *construcción* de un `TenantContext` o un `AuthPrincipal`, no
su uso — si mirara solo las llamadas a `withTenant`, un contexto forjado en un
servicio y pasado a otro llegaría como parámetro y se vería inocente. Es
exactamente la forma que tiene el cron del reporte semanal, que sí es legítimo.

Hoy solo cuatro lugares de la API pueden fabricar una identidad:

| dónde | de dónde sale |
|---|---|
| `auth.guard.ts` (`canActivate`, `resolvePrincipal`) | del token verificado — es el origen de todos |
| `tablero.util.ts` (`ctxDe`) | proyección del `AuthPrincipal` que dejó el guard |
| `todo.service.ts` (`handleCallback`) | del `state` que el propio servicio firmó |
| `tareas.service.ts` (el cron) | de un tenant recién leído y un usuario de dirección de ESE tenant |

**Los dos últimos son indistinguibles de un forjado** — los cuatro son un objeto
literal. Lo que los hace legítimos es de dónde salen los valores, y eso no se
comprueba estáticamente. Por eso están en la lista blanca con el motivo escrito,
y por eso lo que importa es que la lista sea corta: la regla no vuelve imposible
forjar un contexto, vuelve **visible en el diff** que alguien agregó un quinto
lugar donde se fabrica una identidad.

Se cubre también `AuthPrincipal` y no solo `TenantContext`, porque `ctxDe` deriva
uno del otro: forjar el principal alcanzaría. Hoy no cuesta nada — no hay ningún
sitio que lo arme fuera del guard.

**El sabotaje encontró un agujero en la primera versión de la regla.** El literal
pasado inline —`withTenant(fn, { … })`, o sea la forma más obvia— **no se
detectaba**. El segundo parámetro es `ctx?: TenantContext`, así que su tipo
contextual es la unión `TenantContext | undefined`, y una unión no tiene símbolo
propio: preguntarle el nombre devolvía `undefined`. Hay que abrir la unión y
mirar cada miembro. Las otras tres formas —const anotada, posición de `return`, y
forjar el `AuthPrincipal`— sí caían desde el principio. Si no se hubiera probado
rompiéndolo, la regla habría quedado publicada anunciando que cubre justo el caso
que no cubría.
