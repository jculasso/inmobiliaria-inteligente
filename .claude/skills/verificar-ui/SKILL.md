---
name: verificar-ui
description: Verifica en el navegador un cambio de interfaz antes de darlo por hecho — levanta el dev server, monta un banco de pruebas /lab si el componente está detrás de login, mide, y limpia. Usar al tocar componentes, estilos, responsive o PWA.
---

# Verificar la interfaz

Un test verde no prueba que algo **se vea**. `CredencialTokko` renderizaba
perfecto y era invisible: estaba abajo de una tabla de veinte personas. La
lista de propiedades de Tokko pasaba sus tests y no aparecía en desktop, porque
`ListaTarjetas` lleva `sm:hidden`.

Nunca le pidas al usuario que compruebe a mano lo que podés comprobar vos.

## 1. Levantar el server

```
preview_start { name: "web" }   → http://localhost:3000
preview_start { name: "api" }   → http://localhost:3001
```

Están definidos en `.claude/launch.json`. **Nunca levantes el dev server con
Bash.**

## 2. Si el componente está detrás de login: banco de pruebas `/lab`

No podés loguearte por el usuario — no se ingresan credenciales. La salida es
montar la pieza en una ruta pública temporal.

1. Creá `apps/web/app/lab/page.tsx` que importe el componente y le pase props
   de mentira representativas (el caso real, no el vacío).
2. Agregá `'/lab'` a `PUBLIC_PATHS` en `apps/web/middleware.ts`.
3. Verificá y sacá la captura.
4. **Limpiá siempre**, aunque el resultado haya sido bueno:

```bash
rm -rf apps/web/app/lab && git checkout apps/web/middleware.ts
```

Confirmá con `git status` que el working tree quedó como estaba.

## 3. Medir, no mirar

Preferí las herramientas de texto antes que la captura: dicen valores exactos.

- `read_console_messages` y `preview_logs` — errores primero.
- `read_page` — contenido y estructura; devuelve refs para `computer`.
- `javascript_tool` — `getComputedStyle` para tamaños, colores y `display`
  reales. Es la única forma de responder "¿cuántos px mide este campo?".
- `computer` / `form_input` — interacción; después `read_page` para confirmar.
- `resize_window` — responsive y modo oscuro.

La captura va al final, como evidencia para el usuario.

## 4. Las tres trampas de este proyecto

**Móvil (375px).** Ningún campo por debajo de **16px**: iOS hace zoom al
enfocarlo y arrastra la pantalla entera. Comprobalo midiendo, no a ojo:

```js
[...document.querySelectorAll('input,select,textarea')]
  .map(e => [e.name || e.type, getComputedStyle(e).fontSize])
  .filter(([, s]) => parseFloat(s) < 16)
```

**Desktop (1280px).** Revisá que lo que ves en móvil también esté en desktop.
`ListaTarjetas` es `sm:hidden` **a propósito** — es el complemento de una
tabla, no una lista para todo ancho. Si la usás sin tabla, en desktop no hay
nada.

**Service worker.** Si tocaste `apps/web/public/sw.js`, subí su `VERSION` o los
clientes se quedan con la caché vieja. El SW cachea **solo estáticos**: nunca
respuestas de la API ni páginas con datos — la caché es por dispositivo, no por
usuario, y en un celular compartido eso expone a una persona frente a otra.

Y si el cambio suma un archivo que el navegador pide **sin sesión** (íconos,
`manifest.webmanifest`, un PDF público), va a `PUBLIC_PATHS` **y** a
`apps/web/middleware.test.ts`. Ya se olvidó tres veces.

## 5. Verificar un PDF

Los informes no se miran, se miden. En `apps/api/src/common/` hay tres
herramientas, y ninguna necesita abrir el archivo:

| Qué | Para qué |
|---|---|
| `medirFotosPdf` | El alto de la caja de recorte y el alto dibujado de cada foto. Si el dibujado supera a la caja, la foto está **recortada** — que no es lo mismo que estirada, y se arregla distinto |
| `textoDePdf` | El texto legible. Hace falta porque el texto **no viaja como texto**: la fuente va recortada y lo que se escribe son ids de glifo |
| `fuentesUsadasEnPdf` | Las tipografías con las que realmente se dibuja |

**Dos trampas que ya costaron** (`CONVENCIONES_TECNICAS.md` §14):

- **Un carácter que no está en Montserrat arrastra Helvetica.** No tiene `✓`
  ni `→`. En pantalla funcionan —ahí manda el navegador—, en el PDF no.
- **El nombre del archivo solo llega por nuestro botón "Descargar".** Las URLs
  `blob:` son opacas; si se guarda desde el visor del navegador, el archivo
  sale con un UUID.

Al corregir un estilo de informe, escribí el test y **comprobá que falla con el
estilo viejo** antes de darlo por bueno.
