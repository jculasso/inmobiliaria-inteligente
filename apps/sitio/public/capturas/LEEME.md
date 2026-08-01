# Las capturas del producto

Acá van las once capturas que muestran el sistema funcionando. Mientras
falten, las páginas marcan el hueco con `CapturaPendiente`, que **no renderiza
nada en producción**: el sitio se puede publicar en cualquier momento sin que a
un prospecto le aparezca un recuadro gris.

## De dónde salen

De la **inmobiliaria de demostración** (Alteva Propiedades), entrando con un
usuario de dirección. **Nunca de Vacker**: son datos de un cliente real y no van
en material comercial.

Las de escritorio, con la ventana a **1280px** de ancho. Las de teléfono, desde
el celular. PNG.

## Las once

| Archivo | Qué |
|---|---|
| `tasador-wizard.png` | El paso de comparables, con tres cargados y el rango calculado |
| `tasador-informe.png` | Primera página del informe de tasación en PDF |
| `protocolo-ficha.png` | **Alsina 3841** (Nicolás Vera): 23 días, 10 hechas, 6 atrasadas |
| `protocolo-ficha-telefono.png` | La misma ficha desde el celular |
| `protocolo-informe.png` | Informe de gestión en PDF, el detalle semana por semana — de **Belgrano 2087**, que tiene 27 acciones hechas |
| `protocolo-correo-lunes.png` | El correo de los lunes como llega al celular |
| `tablero-kpis.png` | KPIs del período y ranking de vendedores |
| `tablero-objetivos.png` | Seguimiento de objetivos contra la meta |
| `tablero-telefono.png` | El tablero desde el celular |
| `tareas-semana.png` | La lista de tareas de la semana |
| `tareas-calendario.png` | Las mismas tareas en el calendario del celular |

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
