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
| Marca "recibe el reporte" por usuario | pendiente |
| Render del mail (HTML) | pendiente |
| Proveedor de envío (Resend) + DNS | pendiente — depende de `avisos.inmobiliariainteligente.net` |
| Disparo por cron (GitHub Actions) | pendiente |
