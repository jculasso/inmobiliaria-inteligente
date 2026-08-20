# La presentación comercial

```bash
pnpm presentacion                # el deck completo
pnpm presentacion -- --sueltas   # cinco archivos, uno por lámina
```

Sale en `scripts/comercial/Inmobiliaria-Inteligente-2-modulos.pptx`. El .pptx
no se versiona: se genera.

`pptxgenjs` está en las dependencias de la raíz, igual que `sharp` para los
íconos. **`npm install` acá adentro no funciona** — el monorepo es de pnpm y npm
se atraganta con los `workspace:` del `package.json` de la raíz.

## Por qué está acá y no en una carpeta cualquiera

**Porque ya se perdió una vez.** El generador vivía fuera del repositorio, se
limpió el área de trabajo, y hubo que reconstruirlo entero a partir del .pptx
para cambiar una lámina. Acá no se pierde, y el .pptx pasa a ser una salida y no
la fuente.

## Cómo mirar lo que sale

`--sueltas` escribe un archivo por lámina. No es un capricho: en esta máquina no
hay LibreOffice, y la vista previa del sistema (`qlmanage -t`) solo dibuja la
**primera** hoja de cada archivo. Con una lámina por archivo se pueden ver las
cinco.

```bash
node presentacion.js --sueltas
for i in 1 2 3 4 5; do qlmanage -t -s 1500 -o previa "previa-lamina-$i.pptx"; done
```

## El sistema visual: una sola lista para todo el deck

Las cinco láminas usan **la misma fila**: una marca, un título y —si hace
falta— una descripción. Lo único que cambia es qué va en la marca.

| | Marca | Dónde se usa |
|---|---|---|
| Lista sin orden | un punto | Láminas 1 y 2 |
| Secuencia | `01` `02` `03` | Láminas 3 y 4 |
| Bloque con nombre | filete azul arriba | Láminas 1 y 5 |

**Lo que NO se toca es dónde arranca el texto: 0,42" después del borde de la
fila, en todas.** Eso es lo que hace que cinco láminas se lean como una sola
presentación. Antes había tres sangrías distintas (0,20 · 0,26 · 0,50), tres
tamaños de marca y tres escalas tipográficas para decir lo mismo.

El número se apoya a la izquierda del hueco y el punto a la derecha, pegado a su
frase. No es capricho: un `01` necesita todo el hueco y un punto no, y alinearlo
a la izquierda lo deja flotando a media pulgada de su propio texto.

## Lo que hay que saber antes de tocarlo

- **Las viñetas tienen que entrar en un renglón.** El paso entre una y otra es
  fijo; si una envuelve, se monta sobre la siguiente. En la lámina 1, a 9,5pt y
  5,3 pulgadas de ancho, el límite práctico son unos 80 caracteres.
- **El filete azul de cada módulo se calcula** con `altoDelBloque()`, a partir de
  cuántas viñetas tiene. Si se agrega una y el alto fuera fijo, el filete queda
  corto y se lee como un error de maquetación.
- **Los pies de las capturas van en un renglón.** Con dos, el segundo termina
  debajo del número de lámina.
- **Las proporciones de las capturas no se inventan.** Las de pantalla son
  2560x1600 (ancho = alto × 1,6); las de teléfono, 750x1624 (ancho = alto ×
  0,462). Estirarlas se nota antes que cualquier otra cosa.
- **Figtree no viaja dentro del archivo.** PowerPoint no incrusta la tipografía:
  en esta Mac se ve bien, en otra la reemplaza. Para presentar desde otra
  computadora, exportar a PDF.
- **El Protocolo 5 Semanas no aparece** — no se comercializa todavía. Ver
  `docs/specs/sitio-comercial.md` §11.

## Las capturas

Salen de `apps/sitio/public/capturas/`, que se rehacen con
`pnpm --filter @vacker/sitio capturas`. Son de la inmobiliaria de demostración,
**nunca de Vacker**: son datos de un cliente real y no van en material comercial.
