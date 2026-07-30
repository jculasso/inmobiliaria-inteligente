---
name: ordenar-pedido
description: Ordena un pedido largo, desordenado, ambiguo o que se contradice — lo devuelve numerado y en orden de ejecución, separando qué hacer de contexto y de restricciones, citando las frases que chocan y declarando qué default toma en lo ambiguo. Usar al recibir un mensaje con varios pedidos mezclados, antes de indagar.
---

# Ordenar el pedido

Un pedido mal entendido cuesta más que uno mal codificado: el código malo se
ve, la interpretación equivocada pasa los tests.

Esta skill trabaja sobre **el texto del pedido**, no sobre el dominio. Para las
preguntas del negocio —roles, tenant, vista o permiso— seguí con `indagar`.

## Cuándo aplicarla sin que te la pidan

- Más de tres pedidos en un mensaje.
- Un "pero", "igualmente" o "aunque" que cambia lo que se dijo antes.
- "Todos", "siempre" o "nunca" conviviendo con una excepción.
- Una fecha o una urgencia mezclada con el alcance.
- El pedido viene de un tercero (Bernardo, Ezequiel, Vacker) citado de memoria.

Si el mensaje es corto y claro, **no la uses**: devolver ordenado un pedido que
ya estaba ordenado es hacerle perder el tiempo al usuario.

## Qué devolver

**1. El pedido reescrito, numerado, en orden de ejecución** — no en el orden en
que se escribió. Una acción por línea.

**2. Separado en tres**, que suelen venir mezclados:

| | Qué es | Ejemplo real |
|---|---|---|
| **Pedido** | La acción a ejecutar | "que la tabla de vendedores solo la vean los admin y el CEO" |
| **Contexto** | Por qué, quién lo pidió, qué pasó antes | "me lo reportó Ezequiel, ya están en producción" |
| **Restricción** | Lo que acota *cómo* o *cuándo* | "luego de terminar 1", "no quiero romper las propiedades de Vacker" |

Confundir una restricción con un pedido es caro: en un mensaje de esta semana
el punto 2 empezaba con *"luego de terminar 1"*. Si eso se lee como un pedido
más, se hacen las dos a la vez y la urgente llega tarde.

**3. Las contradicciones, citando las dos frases que chocan.** Textuales, no
parafraseadas. Y preguntando cuál vale.

**4. Lo ambiguo, con el default que vas a tomar.** No preguntes lo que podés
resolver con un default razonable: declaralo y seguí. El usuario corrige de un
vistazo lo que esté mal.

**5. Lo que quedó fuera de alcance** según tu lectura.

## Reglas

**No infles el pedido.** Si pidió A, el pedido es A. Proponer A+B está bien
como sugerencia aparte y marcada como tal; presentarla como parte de lo pedido,
no.

**No lo hagas más largo que el original.** Ordenar es sacar ruido, no agregar
prosa. Si tu versión ordenada es más larga que el mensaje del usuario, algo
hiciste mal.

**Preserva sus palabras donde son criterio de negocio.** Si escribió "de MAYOR
a menor", eso va textual — no "orden descendente". Significan lo mismo hasta
que dejan de significarlo, y la traducción es donde se pierde el sentido.

**Lo de terceros va entre comillas.** Cuando el pedido llega de Bernardo o de
Vacker, transcribí la frase y devolvé tu lectura aparte. El pedido sobre las
puntas compartidas se codificó dos veces mal porque se parafraseó en vez de
citarse.

**Empezá por lo que no depende de las respuestas.** Ordenar no es frenar. Si de
cinco puntos hay tres que están claros, esos arrancan mientras se resuelven los
otros dos. Bloquear todo el trabajo esperando una respuesta solo se justifica
si avanzar a ciegas puede romper algo.

## Ejemplo de esta semana

El pedido decía, entre otras cosas:

> *"viste que en distintas vistas aparece el botón 'Ver lo Mío'… necesito que
> se comporte al revés… PARA LOS AMINISTRADORES traer todo"*

Lo que faltaba y no se preguntó a tiempo: qué ve el team leader **al tildar**
el check, y si el vendedor lo ve siquiera. Costó tres vueltas y una corrección
en producción. La versión ordenada tendría que haber dicho:

> Ambiguo — asumo: por default cada uno ve **lo suyo**; el check "Ver todo" lo
> lleva al máximo de su rol (dirección → toda la inmobiliaria, team leader → su
> equipo); el vendedor ya está en su máximo, así que no le muestro el check.
> Los admin ven todo siempre y para ellos el check no aparece.

Eso es una frase que el usuario confirma o corrige en diez segundos.
