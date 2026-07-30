---
name: indagar
description: Interroga al usuario antes de codificar algo no trivial — un módulo nuevo, un cambio de reglas de negocio, un pedido que llega de terceros. Hace la batería de preguntas cuyas respuestas cambian el código, con un default propuesto para cada una. Usar ANTES de escribir la primera línea.
---

# Preguntar antes de codificar

El error más caro de este proyecto no fue técnico: fue **implementar bien la
interpretación equivocada**. El pedido de Bernardo sobre las puntas compartidas
se codificó dos veces mal —una enmascarando por rol en vez de por vista— y las
dos veces pasó los tests, porque los tests verificaban lo que yo había
entendido.

Esta skill existe para que esa conversación pase **antes**.

## Cómo preguntar

- **Todo junto, no de a una.** El usuario responde en tandas; una pregunta por
  mensaje lo hace abandonar.
- **Con un default propuesto para cada una**, para que pueda contestar "todo
  bien" y avanzar. Una pregunta sin default le traslada trabajo a él.
- **Solo lo que cambia el código.** Lo que está en el repo se busca, no se
  pregunta.
- Si hay entre dos y cuatro opciones reales y excluyentes, usá
  `AskUserQuestion`. Si no, texto plano.

**Cuando el pedido llega de un tercero** (Bernardo, Ezequiel, Vacker),
citá textualmente la frase ambigua y devolvé tu lectura en otras palabras. No
la parafrasees en el resumen: transcribila y preguntá "¿esto quiere decir X o
Y?". Ahí es donde se pierde el sentido.

## La batería

### 1. Quién lo usa

Los cinco roles, siempre los cinco, aunque para la mayoría la respuesta sea
"nada": `vendedor`, `team_leader`, `direccion`, `admin_tenant`,
`admin_plataforma`. El que no se nombra es el que después aparece con un 403.

### 2. ¿Filtra lo que se ve, o niega el permiso?

**La pregunta central de este código.** Son dos funciones distintas
(`scopeDeVista` y `scopeDePermiso` en `apps/api/src/modules/tablero/scope.util.ts`)
y unificarlas ya rompió la autorización una vez: un CEO mirando "solo lo mío"
dejó de poder abrir la ficha de otro.

- *Filtrar* = qué filas aparecen en la lista, en los KPIs, en el ranking.
- *Permitir* = si puede abrir, editar o borrar una ficha concreta.

Un dato puede estar oculto en la lista y seguir siendo abrible. Preguntá por
las dos por separado.

### 3. ¿Va detrás de un módulo licenciado?

`MODULO_KEYS` en `packages/types/src/tenant.ts`. Si es un módulo nuevo:
¿arranca apagado para todos? ¿quién lo prende? Hoy conviven `tablero`,
`tasador`, `todo`, `protocolo` y `publicacion`, y **no todas las inmobiliarias
tienen los mismos**.

### 4. Datos

- ¿Tabla nueva? Entonces `tenant_id`, RLS, `REVOKE`/`GRANT` y una línea en
  `apps/api/test/isolation.e2e-spec.ts`. Sin esa línea el aislamiento no está
  verificado por más que la policy exista.
- ¿Campo nuevo en una tabla que ya tiene filas? ¿Qué pasa con las viejas que lo
  tienen en null? Los enums vacíos ya rompieron pantallas.
- ¿De dónde sale el dato hoy? ¿Alguien lo carga a mano?

### 5. Las dos inmobiliarias

En la base están **Vacker** (cliente real) y **Sanso Propiedades** (la demo).
Tienen módulos distintos y datos distintos. Preguntá qué tiene que pasar en la
que *no* estás mirando — y ojo con el que también es tu banco de pruebas.

### 6. Pantalla

- ¿Se usa en el celular? Es una PWA instalada: no hay barra del navegador, así
  que toda pestaña nueva necesita su propia salida.
- ¿Tabla, tarjetas, o las dos? `ListaTarjetas` es `sm:hidden` a propósito:
  usarla sola deja el desktop en blanco.
- ¿Hay campos de texto? Mínimo 16px o iOS hace zoom.

### 7. Qué NO entra

Pedilo explícito. Es la pregunta que más discusiones ahorra después.

### 8. Cómo se sabe que está bien

Una frase que el usuario pueda **comprobar él mismo**, en pasos. "Que se vea
bien" no sirve. "Que Ezequiel, entrando con su usuario y sin tildar Ver todo,
no vea el nombre del vendedor de la otra punta en la OP-0080" sí.

Esa frase es la que después se convierte en test.

## Al terminar

Devolvé lo entendido en una lista corta y numerada, marcando **con qué default
te quedaste** en cada punto que el usuario no contestó. Que pueda corregir de
un vistazo.

Si el cambio es de más de un par de archivos, seguí con `especificar`. Si es
chico, andá derecho a `plan-tecnico`.
