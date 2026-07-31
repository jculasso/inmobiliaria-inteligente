# Reporte semanal del Protocolo 5 Semanas

> Especificación. Acordada con el usuario el 30/07/2026.
> Escrita con la skill `especificar`: cada regla numerada tiene su test.

## Para quién y para qué

Un mail semanal a los dueños de la inmobiliaria con las alertas de las
propiedades en comercialización, agrupadas por vendedor, para que la dirección
sepa qué necesita decisión **sin tener que entrar al sistema**.

El CEO es justamente el que menos entra a la aplicación. Ese es todo el punto:
el reporte va hacia él.

## Matriz de roles

Este reporte **no se pide, se recibe**: no hay pantalla ni endpoint público.
Aun así el alcance de lo que cada uno vería es el que ya existe.

| Rol | Qué VE | Qué PUEDE HACER |
|---|---|---|
| `vendedor` | Lo suyo | Nada — no recibe (por ahora) |
| `team_leader` | Lo suyo y lo de su equipo | Nada — no recibe (por ahora) |
| `direccion` | Toda la inmobiliaria | Recibe **si está marcado** |
| `admin_tenant` | Toda la inmobiliaria | Recibe si está marcado |
| `admin_plataforma` | — | **No** recibe: no es de la inmobiliaria |

**Quién recibe no se deriva del rol.** En Vacker `direccion` son cuatro
personas: los dos dueños (Ezequiel Olivera, Nahuel Vaccaro) y los dos
implementadores (Bernardo Falconi, Javier Culasso). Mandarlo "a los
`direccion`" se lo manda también a quienes no lo pidieron.

Va por una **marca explícita por usuario**, apagada por default. Quién recibe
un mail es una decisión de negocio, no un permiso; mezclarlas es la misma
confusión que ya costó una vez entre vista y permiso
(`CONVENCIONES_TECNICAS.md` §2).

## Reglas de negocio

1. El reporte cubre **solo protocolos activos**. Los archivados no alertan
   —`calcularAlertas` ya devuelve `[]` para ellos— y no aparecen ni en el
   resumen ni en el detalle.
2. Las alertas se calculan con **`calcularAlertas`, la misma función que el
   dashboard**. No se reimplementa la lógica: si el mail dijera una cosa y la
   pantalla otra, se dejaría de creer en las dos.
3. El detalle va **agrupado por vendedor y ordenado alfabéticamente** por
   nombre. Alfabético y no por urgencia: semana a semana cada uno se encuentra
   en el mismo lugar, y la urgencia ya la resuelve la sección 5.
4. Dentro de cada vendedor, las propiedades van **ordenadas por prioridad**
   (roja, ámbar, verde) y a igual prioridad por dirección.
5. Hay una sección **"Necesita decisión"** con solo las alertas **rojas** de
   todas las propiedades, agrupadas por vendedor. Es lo primero que se lee.
6. Cada propiedad muestra las **cinco semanas** con su estado:
   - `futura` — la semana todavía no llegó
   - `completa` — todas sus acciones aplicables están realizadas
   - `en_curso` — es la semana actual y no está completa
   - `incompleta` — ya pasó y quedaron acciones sin cerrar
7. Cada alerta se atribuye a la semana que trae en su campo `semana`. Las que
   traen `semana: null` —autorización vencida, sin actividad reciente,
   resultados sin cargar— son **de la propiedad**, no de una semana, y se
   muestran aparte.
8. El resumen de cabecera tiene cuatro números: propiedades activas, con alerta
   roja, con autorización por vencer o vencida, y listas para cierre.
9. **Si no hay ninguna alerta roja, el reporte es corto**: solo el resumen.
   Un mail que mide siempre lo mismo se ignora en la tercera semana; el valor
   está en que sea breve cuando todo va bien.
10. Un vendedor **sin propiedades activas no aparece**. La lista es de trabajo
    en curso, no un padrón del equipo.
11. El reporte se genera **por inmobiliaria**. Cada tenant recibe el suyo, con
    sus propios destinatarios, y solo si tiene el módulo `protocolo`
    habilitado.
12. Una propiedad **se puede cerrar con tareas pendientes**, y el reporte tiene
    que decirlo con todas las letras: `listoParaCierre` viene acompañado de
    `pendientesArrastrados` —las acciones sin realizar de semanas ya pasadas— y
    de una frase única (`textoDeCierre`) que usan el mail y la pantalla.

    Decidido por la dirección el 30/07/2026. Antes el verde aparecía pelado al
    lado de una alerta roja y parecía una contradicción; el estado era correcto
    y estaba mal comunicado.
13. El reporte **se puede pedir a demanda** desde la aplicación
    (`GET /protocolo/reporte-semanal`), sin esperar al lunes. Lo pueden pedir
    `direccion` y `admin_tenant`, por la constante compartida
    `ROLES_REPORTE_PROTOCOLO`. Devuelve siempre el alcance máximo de quien
    consulta: un reporte de conducción con la mitad de las propiedades no
    sirve para conducir.

## Casos borde

- **Protocolo iniciado hoy** — semana 1 en curso, semanas 2 a 5 futuras, sin
  atrasos. No debe generar alertas por "semana anterior incompleta".
- **Protocolo pasado de las 5 semanas** — `semanaActual` queda clavada en 5.
  Sigue activo y sigue apareciendo: cerrar es decisión humana.
- **Acciones `no_corresponde`** — no cuentan para el avance ni para los
  pendientes. Una semana entera en `no_corresponde` está **completa**.
- **Inmobiliaria sin protocolos activos** — no se manda mail. Un reporte vacío
  entrena a ignorarlo.
- **Vendedor dado de baja con propiedades activas** — aparece igual; el trabajo
  existe aunque la persona ya no esté, y es justamente lo que la dirección
  necesita ver para reasignar.

## Lo que sigue: comparar contra la semana pasada

Acordado con la dirección el 30/07/2026, para cuando el mail ya esté
circulando. Es la mejora de más valor y la única que necesita datos nuevos.

**El problema que resuelve:** hoy el reporte dice *cómo está*; no dice *si va
mejorando*. "Belgrano tiene 6 acciones atrasadas" es un estado. "Hace una
semana tenía 3, hoy tiene 6" es información de conducción — y es lo que
justifica que el reporte sea semanal y no una pantalla que se mira cuando uno
se acuerda.

**Lo que hace falta:** una foto semanal por protocolo, guardada al generar el
reporte. Lo mínimo que alcanza:

| Campo | Para qué |
|---|---|
| `protocolo_id`, `generado_el` | la clave |
| `semana_actual`, `dias_transcurridos` | contexto |
| `atrasadas`, `pendientes` | la comparación que importa |
| `prioridad` | pasó de ámbar a roja, o al revés |

Con eso el reporte puede decir, por propiedad, **empeoró / mejoró / igual**, y
en la cabecera algo como "3 propiedades empeoraron respecto de la semana
pasada".

**Por qué no se hizo ya:** sin el mail circulando no hay serie que comparar, y
guardar una foto semanal que nadie lee es inventar una tabla por adelantado.
Primero el hábito, después la historia.

---

## Fuera de alcance (por ahora)

- Envío a team leaders y vendedores. El generador ya lo soporta —es el mismo
  código con otro scope— pero se activa después de que el del CEO funcione.
- Cualquier dato de Tokko. La verificación de publicación es un trabajo
  aparte.
- Configurar el día y la hora desde la aplicación. Va fijo en el cron.

## Criterio de aceptación

1. Con los datos de Vacker, generar el reporte y comprobar que la cantidad de
   propiedades activas coincide con la que muestra el dashboard del Protocolo.
2. Que una propiedad con una acción vencida aparezca en "Necesita decisión",
   bajo el nombre de su vendedor.
3. Que una inmobiliaria sin alertas rojas produzca un reporte corto.
4. Que Ezequiel y Nahuel figuren como destinatarios, y Bernardo y Javier no.

## Estado

| Parte | Estado |
|---|---|
| Generador (función pura) + tests | **hecho** — `reporte-semanal.ts` |
| Contrato compartido en `@vacker/types` | **hecho** — `reporte-protocolo.ts` |
| Cierre con tareas pendientes, explícito | **hecho** — regla 12 |
| Endpoint a demanda | **hecho** — `GET /protocolo/reporte-semanal` |
| Pantalla del reporte a demanda | **hecho** |
| Foto, fecha de inicio y días transcurridos | **hecho** |
| Precio publicado y frase de resumen | **hecho** |
| Comparación contra la semana pasada | pendiente — ver arriba |
| Marca "recibe el reporte" por usuario | pendiente |
| Render del mail (HTML) | pendiente |
| Proveedor de envío (Resend) + DNS | **DNS hecho** el 30/07/2026 — `avisos.inmobiliariainteligente.net` verificado, `RESEND_API_KEY` cargada en Render |
| Disparo por cron (GitHub Actions) | pendiente |
