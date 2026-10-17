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

Por eso la web de prueba se compila con **`apps/web/e2e/entorno-de-prueba.env`**
—valores de mentira, commiteados— y no con el `.env` de la raíz, que en la
máquina de desarrollo tiene las credenciales reales. Ese archivo apunta la API y
Supabase al **simulador** (`apps/web/e2e/simulador/`), un proceso local que
levanta Playwright. Y `e2e/global-setup.ts` **se niega a correr** si la web
compilada no apunta al simulador. Eso no es una simplificación temporal: es la
garantía. La prueba **no puede** alcanzar los datos reales aunque alguien
escriba mal un test.

Si un cambio necesita credenciales de verdad en CI para pasar, el problema es el
cambio, no el CI.

## Qué corre hoy

| | |
|---|---|
| Dónde | `apps/web/e2e/` (con sesión: `apps/web/e2e/alquileres/`) |
| Cómo | `pnpm --filter @vacker/web test:e2e` — compila con el entorno de prueba y corre todo |
| Contra qué | la app **compilada** (`next start`, puerto 3210), no `dev` — el middleware y el cacheo se comportan distinto |
| Navegadores | `chromium`; `mobile` (iPhone 14 Pro Max, WebKit) para las sin sesión; `telefono` (iPhone SE a **375×812**, WebKit) para las con sesión |

WebKit no es un lujo: **el "baile" lateral era un comportamiento propio de
Safari**. Probarlo solo en Chrome no habría servido de nada. Y 375 es el ancho
donde las cosas se rompen: los iPhone que trae Playwright miden 393 o 430.

## Cómo funciona una prueba con sesión

Las páginas piden sus datos **desde el servidor de Next** (Server Components),
así que interceptar en el navegador no alcanza: por eso hay un simulador.

- **`simulador/identidad.ts`** — el usuario de prueba y la cookie de sesión que
  escribiría Supabase (`sb-localhost-auth-token`). El JWT es HS256 a propósito:
  el middleware no busca claves, pregunta a `/auth/v1/user`, y eso lo contesta
  el simulador.
- **`simulador/rutas.ts`** — cada ruta de la API que se simula, con el **schema
  Zod de la app**: lo que sale se valida contra él, así un dato de prueba mal
  armado se ve en la salida del simulador y no como «no tiene el formato
  esperado» en la pantalla. Una ruta que nadie simula contesta 404 y queda
  escrita como `SIN SIMULAR`: es la pista para sumarla.
- **`simulador/datos/`** — los datos, con un «hoy» fijo (`HOY`) para que el
  resultado no dependa del día en que corre.
- **`simulador/estado.ts`** — lo que una prueba cambia (cobrar una seña, cerrar
  una reserva) se guarda **por escenario**, que viaja en el token: las pruebas
  en paralelo no se pisan.
- **`alquileres/sesion.ts`** — el `test` con la sesión puesta (y todo pedido
  fuera de localhost cortado), y las comprobaciones de teléfono:
  `revisarEnTelefono` (nada se sale a lo ancho, ningún campo bajo 16px),
  `esTocable` (visible, habilitado, dentro de la pantalla y sin nada encima) y
  `revisarModal` (entra en la pantalla, se desplaza hasta el final, la × cierra).

### La carrera de `useRefrescar`

Los modales que guardan se cierran cuando termina `router.refresh()`. Contra el
simulador, ese refresh a veces no llega a pintarse y el modal queda en
«Guardando…» (alrededor de 1 de cada 10, el 15/10/2026). Mientras eso no se
resuelva, las pruebas que guardan usan **`confirmarYRecargar`**: miran qué se
mandó y recargan para ver cómo quedó. No esperes a que el modal se cierre solo.

## Lo que ya está cubierto — no lo repitas

**`acceso.spec.ts`** — la Home muestra el formulario; una ruta de módulo sin
sesión vuelve a la Home **recordando el destino**; `/admin` no rebota porque
tiene su propia pantalla; y los archivos que el navegador pide sin estar
logueado se sirven: `manifest.webmanifest`, `sw.js`, los íconos, `/offline` y el
flyer comercial.

Esa última tanda existe porque **ya se rompió tres veces**. Si sumás un archivo
público, sumalo también acá (y a `PUBLIC_PATHS`, ver `CONVENCIONES_TECNICAS.md`
§4).

**`sin-arrastre-lateral.spec.ts`** — que ninguna pantalla sin sesión se pueda
arrastrar de costado, y que ningún campo mida menos de 16px en el teléfono.

**`alquileres/`** — los flujos de Alquileres de la entrega A y de reservas, en
escritorio y en el teléfono de 375: el dashboard (período y cierre «al
30/09/2026», la lista de una tarjeta, la cobranza con lo cobrado y lo que
falta, «Cobrado dentro del mes» mes por mes, y el pedido anticipado: una
tarjeta que pide su lista no la vuelve a pedir al tocarla —por eso, para
mirar los pedidos de una prueba, escuchá desde ANTES del `goto`: el
anticipado sale apenas se pinta—), el contrato ya en curso, corregir el
importe de un tramo, el tramo que espera el índice y la vista previa de las
diferencias, las insignias de liquidación parcial y final, las reservas (alta,
seña con recibo, estados, convertir en contrato, «No se presentó a firmar»), el
informe de propietarios con «A descontar en la próxima liquidación», y los
valores nuevos de la configuración.

## Cómo medir un desborde, y cómo NO

`document.documentElement.scrollWidth - window.innerWidth` **miente**: ese valor
viene recortado cuando algo del árbol tiene `overflow` oculto. Da 0 mientras una
tarjeta se sale de la pantalla.

La forma correcta ya está escrita en `sin-arrastre-lateral.spec.ts` (y, para
las pruebas con sesión, en `elementosQueSeSalen` de `alquileres/sesion.ts`):
recorrer los elementos y quedarse con los que tienen el borde derecho más allá
del ancho, **descartando los que viven dentro de un panel deslizable** —ahí
pasarse es lo esperable—. Copiá ese patrón, no inventes uno nuevo.

Y usá **`expect.poll`**, no una medición suelta: varias pantallas hacen una
navegación del cliente al montar, y medir justo ahí tira "execution context
destroyed".

Para comprobar que una medición falla cuando debe, no inyectes un elemento
apenas carga la página: la hidratación de React lo borra y la prueba pasa sin
haber medido nada. Esperá a que la página termine de cargar.

## Lo que todavía NO se puede probar contra una base

El simulador cubre la pantalla, no la API: lo que la API hace con la base
(permisos, RLS, cuentas) **sigue cubierto por los tests de la API** —incluido el
de aislamiento entre inmobiliarias, que es el que sostiene la promesa del
producto—. Una prueba de navegador contra una base de verdad necesitaría:

1. Un proyecto de Supabase aparte, solo para pruebas, o
2. Postgres local + Supabase local.

### La mina que hay que ver antes de pisarla

Existe `pnpm --filter @vacker/api seed:test-user`, y es útil — **pero hace
`upsert` sobre el tenant `vacker`**. Corrido con el `DATABASE_URL` de
producción, **crea o modifica un usuario dentro del cliente real**.

Nunca se ejecuta apuntando a producción. Y el día que haya base de pruebas, el
seed tiene que crear su propio tenant, no reusar el de Vacker.

## Al agregar una prueba

1. **¿Se puede sin sesión?** Va junto a las de `acceso` o `sin-arrastre-lateral`.
   **¿Necesita sesión?** Va en `alquileres/` (o en una carpeta hermana sumada a
   `CON_SESION` en `playwright.config.ts`), con el `test` de `sesion.ts` y los
   datos en el simulador. Nunca contra producción.
2. **¿Es de teléfono?** Las sin sesión: `test.skip(info.project.name !== 'mobile', '…')`.
   Las con sesión corren solas en `telefono`: usá `esTelefono` y
   `revisarEnTelefono`.
3. **Nombre en castellano y en indicativo**, diciendo qué se garantiza:
   *"el manifest y el service worker se sirven, o la app no se puede instalar"*.
   El nombre tiene que explicar **por qué importa**, no solo qué mira.
4. **Comprobá que falla** sin el arreglo. Una prueba que pasa en los dos casos
   no está probando nada.
5. Corré la tanda entera antes de publicar.
