# Verificar la publicación contra Tokko

> Especificación. Acordada con la dirección el 30/07/2026.
> **No empezar hasta que haya protocolos iniciados en Vacker**: esto audita
> protocolos, y hoy hay cero. Construirlo antes sería auditar un conjunto vacío.

## Para quién y para qué

La semana 1 del Protocolo tiene la acción **"Publicación en portales"**
(`publicacion-portales`). Hoy es un checkbox que marca el propio vendedor:
nadie verifica nada.

Con lectura de la API de Tokko —que **ya funciona**— deja de ser autodeclarada.
Ese es el valor: no mostrar una etiqueta linda, sino **convertir un checklist en
una auditoría**.

## Qué NO es esto

**No es el feed.** Mandar propiedades a Tokko es otro trabajo, bloqueado por el
ambiente de prueba y por el riesgo del importador (§12 de
`CONVENCIONES_TECNICAS.md`). Esto es solo lectura y no toca nada en Tokko.

## Lo que se puede probar

Con los datos que la importación ya trae a la tabla `propiedad`:

| Dato | De dónde | Para qué sirve |
|---|---|---|
| Está publicada | existe en Tokko con ese `reference_code` | Confirma la acción de la semana 1 |
| Cuántas fotos | `fotos` | La semana 1 también tiene "producción fotográfica": publicar con 3 fotos es un problema que hoy nadie ve |
| A qué precio | `precio` vs `protocolo.precioPublicado` | **El más valioso**: si el propietario acordó bajar el precio y el portal sigue con el viejo, hoy no lo detecta nadie |
| Hace cuánto no se toca | `deleted_at` (sí, ese campo — ver §12) | Las semanas 3-4 son de ajuste |
| El link a la ficha | `publicUrl` | El CEO verifica en un clic en vez de pedir una captura |

## Reglas de negocio

1. El vínculo entre una tasación y una propiedad de Tokko es **manual y se
   confirma una sola vez**, en el modal de "Iniciar protocolo".
2. El sistema **sugiere** el candidato **por dirección**, pero no lo da por
   bueno solo: una dirección mal emparejada le muestra al CEO un semáforo verde
   de otra propiedad, que es peor que no tener nada.
3. Un protocolo puede quedar **sin contraparte en Tokko**, y eso tiene que
   verse: hay una lista de **protocolos iniciados sin propiedad vinculada**. No
   es un error del sistema — es trabajo pendiente de alguien.
4. Alertas nuevas, con el mismo criterio de color que el resto:
   - 🔴 La acción "Publicación en portales" está **marcada como realizada** y la
     propiedad **no aparece** en Tokko.
   - 🔴 El precio del portal **no coincide** con el del protocolo.
   - 🟠 Publicada con menos de N fotos.
   - 🟠 La publicación **no se modifica** hace ≥21 días.
5. La verificación **nunca escribe en Tokko**. Ni para "corregir" un precio.

La regla 4, primera línea, es la única alerta del sistema que **contradice** en
vez de informar: le dice a la dirección que algo que figura como hecho no está
hecho.

## La vinculación de los agentes, por mail

Independiente de lo anterior y **también importante** (pedido de la dirección
el 30/07/2026).

Tokko trae el mail del agente que captó cada propiedad. La importación ya lo
usa para vincular con nuestro `usuario`, y funciona: **23 de 25** propiedades
quedaron vinculadas. Las que fallan son diferencias de escritura entre los dos
sistemas.

Dos trampas verificadas contra los datos reales:

- **Hay dos Lautaros** en Vacker: `lautaroc@` (Cimarelli) y `lautarod@`
  (Diessler). Emparejar por nombre los mezcla.
- **Tokko escribe "Picabea" y nuestro sistema "Piccabea"**.

Por eso el vínculo es **por mail y no por nombre**. Lo que falta es una pantalla
que muestre los agentes de Tokko sin contraparte, para poder resolverlos sin
mirar la base. Cuidado al corregir el mail del lado de Tokko: puede cambiar cómo
esa persona entra a Tokko.

## Casos borde

- **Propiedad no importada todavía.** Hoy hay **25 de 389**. O se importa
  completo, o se importa al vincular.
- **Propiedad dada de baja en Tokko** después de vinculada: la verificación
  tiene que decir "ya no está publicada", no romperse.
- **Dos propiedades de Tokko con direcciones parecidas**: por eso la
  confirmación es humana.
- **Inmobiliaria sin el módulo de Publicación**: nada de esto aparece.

## Antes de empezar hacen falta

1. **Protocolos iniciados en Vacker.** Hoy: cero. Es el bloqueo real.
2. **La importación completa**, o importar al vincular.
3. Los mails de los agentes corregidos en Tokko — Vacker quedó en hacerlo.

## Fuera de alcance

- Escribir en Tokko (el feed).
- Corregir automáticamente un precio desalineado. El sistema avisa; decidir es
  de la inmobiliaria.
