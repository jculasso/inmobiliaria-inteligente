---
name: e2e
description: Escribe o corrige una prueba de extremo a extremo con Playwright en este repo — dónde va, cómo medir sin obtener falsos negativos, qué ya está cubierto, y por qué ninguna prueba puede tocar la base de producción. Usar al agregar cobertura de navegador o al tocar `apps/web/e2e/`.
---

# Pruebas de extremo a extremo

Un navegador de verdad, sobre la app compilada. Complementan a `verificar-ui`:
esa skill es para **mirar** un cambio ahora; ésta es para **dejarlo amarrado**.

## La regla que no se negocia

**Ninguna prueba de extremo a extremo toca la base de producción.**

Ahí vive Vacker, un cliente real, en el plan gratis de Supabase — que **no tiene
backups automáticos**. Una prueba que cree o borre filas contra esa base no
tiene vuelta atrás.

Por eso CI arma un `.env` con **valores de mentira** antes de correrlas
(`ci.yml`, paso "Variables de entorno de prueba"). Eso no es una simplificación
temporal: es la garantía. Mientras las credenciales sean falsas, la prueba **no
puede** alcanzar los datos reales aunque alguien escriba mal un test.

Si un cambio necesita credenciales de verdad en CI para pasar, el problema es el
cambio, no el CI.

## Qué corre hoy

| | |
|---|---|
| Dónde | `apps/web/e2e/` |
| Cómo | `pnpm --filter @vacker/web test:e2e` |
| Contra qué | la app **compilada** (`next start`, puerto 3210), no `dev` — el middleware y el cacheo se comportan distinto |
| Navegadores | `chromium` y `mobile` (iPhone 14 Pro Max, motor WebKit) |
| Cuántas | 10 pruebas en 2 archivos |

WebKit no es un lujo: **el "baile" lateral era un comportamiento propio de
Safari**. Probarlo solo en Chrome no habría servido de nada.

## Lo que ya está cubierto — no lo repitas

**`acceso.spec.ts`** — la Home muestra el formulario; una ruta de módulo sin
sesión vuelve a la Home **recordando el destino**; `/admin` no rebota porque
tiene su propia pantalla; y los archivos que el navegador pide sin estar
logueado se sirven: `manifest.webmanifest`, `sw.js`, los íconos, `/offline` y el
flyer comercial.

Esa última tanda existe porque **ya se rompió tres veces**. Si sumás un archivo
público, sumalo también acá (y a `PUBLIC_PATHS`, ver `CONVENCIONES_TECNICAS.md`
§4).

**`sin-arrastre-lateral.spec.ts`** — que ninguna pantalla se pueda arrastrar de
costado, y que ningún campo mida menos de 16px en el teléfono.

## Cómo medir un desborde, y cómo NO

`document.documentElement.scrollWidth - window.innerWidth` **miente**: ese valor
viene recortado cuando algo del árbol tiene `overflow` oculto. Da 0 mientras una
tarjeta se sale de la pantalla.

La forma correcta ya está escrita en `sin-arrastre-lateral.spec.ts`: recorrer
los elementos y quedarse con los que tienen el borde derecho más allá del ancho,
**descartando los que viven dentro de un panel deslizable** —ahí pasarse es lo
esperable—. Copiá ese patrón, no inventes uno nuevo.

Y usá **`expect.poll`**, no una medición suelta: varias pantallas hacen una
navegación del cliente al montar, y medir justo ahí tira "execution context
destroyed".

## Lo que todavía NO se puede probar: todo lo que está detrás del login

Hoy **ninguna prueba entra a la aplicación**. El reporte, el protocolo, el
tablero: nada tiene cobertura de extremo a extremo.

No es un olvido — es que **falta una base que no sea la de producción**. Antes
de escribir la primera prueba con sesión hace falta decidir dónde corre:

1. Un proyecto de Supabase aparte, solo para pruebas, o
2. Postgres local + Supabase local.

### La mina que hay que ver antes de pisarla

Existe `pnpm --filter @vacker/api seed:test-user`, y es útil — **pero hace
`upsert` sobre el tenant `vacker`**. Corrido con el `DATABASE_URL` de
producción, **crea o modifica un usuario dentro del cliente real**.

Nunca se ejecuta apuntando a producción. Y el día que haya base de pruebas, el
seed tiene que crear su propio tenant, no reusar el de Vacker.

Mientras tanto, el camino API + base **sí está cubierto** por los tests de la
API — incluido el de aislamiento entre inmobiliarias, que es el que sostiene la
promesa del producto.

## Al agregar una prueba

1. **¿Se puede sin sesión?** Si sí, va ahora. Si no, va cuando exista la base de
   pruebas — no la fuerces contra producción.
2. **¿Es de teléfono?** `test.skip(info.project.name !== 'mobile', '…')`.
3. **Nombre en castellano y en indicativo**, diciendo qué se garantiza:
   *"el manifest y el service worker se sirven, o la app no se puede instalar"*.
   El nombre tiene que explicar **por qué importa**, no solo qué mira.
4. **Comprobá que falla** sin el arreglo. Una prueba que pasa en los dos casos
   no está probando nada.
5. Corré la tanda entera antes de publicar: son 10 y tardan poco.
