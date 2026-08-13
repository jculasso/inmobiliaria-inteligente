# Las capturas del producto

Acá van las once capturas que muestran el sistema funcionando. Mientras
falten, las páginas marcan el hueco con `CapturaPendiente`, que **no renderiza
nada en producción**: el sitio se puede publicar en cualquier momento sin que a
un prospecto le aparezca un recuadro gris.

> **Desde el 13/08/2026 el sitio muestra solo dos módulos.** Las capturas del
> Protocolo 5 Semanas siguen acá y el script las sigue sacando: no se muestran
> en ninguna página, pero se mantienen frescas para cuando el módulo vuelva a
> venderse. Si molestan, se comentan en `scripts/capturar.mjs`.

## De dónde salen

De la **inmobiliaria de demostración** (Alteva Propiedades), entrando con un
usuario de dirección. **Nunca de Vacker**: son datos de un cliente real y no van
en material comercial.

Las de escritorio, con la ventana a **1280px** de ancho. Las de teléfono, desde
el celular. PNG.

## Las de pantalla (las saca el script)

| Archivo | Qué |
|---|---|
| `tasador-wizard.png` | Paso de comparables, con el resumen automático |
| `tasador-tasaciones.png` | El listado con el estado de captación |
| `protocolo-ficha.png` | **Alsina 3841** — semana 4, 6 acciones atrasadas |
| `protocolo-ficha-telefono.png` | La misma ficha desde el celular |
| `protocolo-panel.png` | El panel: 4 en comercialización, 2 con alertas |
| `protocolo-correo-lunes.png` | El reporte semanal en pantalla, desde el celular |
| `tablero-kpis.png` | KPIs del período y acumulado del año |
| `tablero-objetivos.png` | Seguimiento contra la meta |
| `tablero-telefono.png` | El tablero desde el celular |

## Las de PDF (a mano, porque son descargas)

Un PDF llega como archivo, no como pantalla, así que el script no las alcanza.
Se descargan desde la aplicación y se convierten con las herramientas que ya
trae macOS:

```bash
qlmanage -t -s 2000 -o . "Reporte-semanal-Alteva-Propiedades-2026-08-01.pdf"
sips -Z 1400 "Reporte-….pdf.png" --out protocolo-reporte-semanal.png
```

El `-Z 1400` no es cosmético: sin achicar, cada página pesa unos 800 KB y se
muestra a 700px. Con las cuatro páginas a tamaño completo, el optimizador de
imágenes de Next tardaba tanto que los tests de navegador fallaban por
timeout.

| Archivo | De dónde |
|---|---|
| `tasador-informe.png` | Tasador → Tasaciones → **Ver**. La de Belgrano 2087, que es la única de la demostración con fotos, servicios y amenities cargados |
| `protocolo-informe.png` | Protocolo → una propiedad → **Informe** |
| `protocolo-reporte-semanal.png` | Protocolo → **Reporte** → descargar |

## El To Do List no tiene captura

No es un olvido: la cuenta de la demostración no tiene calendario vinculado, y
vincular uno mostraría la agenda personal de alguien en un sitio público.

## Por qué Alsina 3841 y no Belgrano 2087

Belgrano lleva 44 días y 27 acciones hechas: sale casi todo verde, y una
captura donde no pasa nada no muestra para qué sirve el módulo. Alsina está a
mitad del ciclo con seis atrasos, así que se ven las dos cosas a la vez — el
método avanzando y el sistema levantando la mano.

## Cuando llegue una

Reemplazar en la página el `<CapturaPendiente>` por:

```tsx
<Captura
  src="/capturas/protocolo-ficha.png"
  ancho={1280}
  alto={900}
  alt="Describir lo que se ve — es lo único que le llega a quien navega con lector de pantalla."
  pie="El texto visible debajo, escrito para el que mira la captura sin leer el resto."
/>
```
