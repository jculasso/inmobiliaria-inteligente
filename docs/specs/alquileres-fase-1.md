# Módulo «Alquileres» — fase 1: especificación

> Decisiones tomadas con Javier el 5/10/2026. Base: el relevamiento de Gexion,
> el sistema que Vacker usa hoy (`docs/specs/analisis-gexion-alquileres.md`).
> Gexion es **referencia de lógica**, no de diseño: el objetivo es reemplazarlo.
>
> **Pendiente:** las respuestas de Vacker a las 7 preguntas sobre su operación
> (mandadas por WhatsApp el 5/10). Pueden cambiar prioridades dentro de esta
> fase, no las decisiones de §2.

## 1. Para quién y para qué

Para quien administra los alquileres de la inmobiliaria: pasa de operar
contratos, indexaciones, cobros y liquidaciones en Gexion a hacerlo en la
plataforma, y la dirección gana un tablero que le dice cómo está la cartera
—cobranza, morosidad, vencimientos, ingresos— sin pedir una planilla.

## 2. Decisiones cerradas (5/10/2026)

| Tema                      | Decisión                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance                   | **Módulo propio que reemplaza a Gexion**, no un complemento. Vacker es el primer cliente.                                                                                                                                                                                                                                                             |
| Licencia                  | Módulo nuevo `alquileres` en `MODULO_KEYS`, **apagado por defecto**. Se prende para Vacker y para Alteva (demo, datos inventados).                                                                                                                                                                                                                    |
| Operador                  | **Rol funcional nuevo `administracion`**, como `publicador`: opera el módulo y no ve nada del Tablero Comercial.                                                                                                                                                                                                                                      |
| Facturación electrónica   | **Fase 2**, a través de un facturador homologado con ARCA, por API. En la fase 1 se emiten recibos y liquidaciones **no fiscales**; Vacker sigue facturando como hoy.                                                                                                                                                                                 |
| Migración                 | **Corte en una fecha**: se cargan los contratos vigentes con los saldos de cada persona a ese día, y desde ese mes se opera solo acá.                                                                                                                                                                                                                 |
| Propietarios e inquilinos | Reciben **PDF** (liquidación, estado de cuenta, recibo) por WhatsApp o mail. El portal con usuario propio queda para después.                                                                                                                                                                                                                         |
| Celular                   | La dirección **consulta** (tablero, alertas, cuenta de una persona). La **operación** (cargar, cobrar, liquidar) se diseña para escritorio y no se bloquea en el teléfono.                                                                                                                                                                            |
| Tablero Comercial         | Separado en la fase 1. Más adelante, un alquiler firmado ahí ofrece crear el contrato administrado.                                                                                                                                                                                                                                                   |
| Firma del contrato        | **Prevista desde la fase 1, integrada en la fase 2.** El contrato lleva su documento y un estado de firma; la conexión con un proveedor pasa por una capa propia (un adaptador por proveedor), como la autenticación. Qué proveedor, y si firma **digital** (Ley 25.506, certificador licenciado) o **electrónica**, lo define Vacker con su abogado. |

## 3. Matriz de roles

Los alquileres administrados no tienen puntas: son de la inmobiliaria. No hay
«lo mío» ni tilde «Ver todo»: quien entra al módulo ve la cartera entera, y
quien no entra no ve nada. **Ver y poder coinciden** en este módulo, a
diferencia del Tablero (`scope.util.ts`), y eso está decidido, no olvidado.

| Rol                | Qué VE                                          | Qué PUEDE HACER                                                                                         |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `vendedor`         | Nada. El módulo no aparece en su Home.          | Nada (403 en toda la API del módulo).                                                                   |
| `team_leader`      | Nada.                                           | Nada (403).                                                                                             |
| `publicador`       | Nada (salvo que además tenga `administracion`). | Nada (403).                                                                                             |
| `administracion`   | Todo el módulo y su tablero.                    | Todo: personas, propiedades, contratos, indexar, cargar conceptos, cobrar, liquidar, anular con motivo. |
| `direccion`        | Todo el módulo y su tablero.                    | Todo, igual que `administracion`.                                                                       |
| `admin_tenant`     | Todo el módulo y su tablero.                    | Todo, y además prender o apagar el módulo y dar el rol `administracion`.                                |
| `admin_plataforma` | Nada de los datos (está fuera del tenant).      | Prender o apagar el módulo por inmobiliaria, desde la consola de plataforma.                            |

## 4. Modelo, en palabras

- **Persona**: física o jurídica, con documento (DNI o CUIT), contacto, y uno o
  más papeles: propietario, inquilino, garante. Una persona puede ser
  propietaria de un contrato e inquilina de otro.
- **Propiedad**: la unidad que se alquila. Se decide en el plan técnico si se
  reusa el modelo `Propiedad` de Publicación o se crea uno propio.
- **Contrato**: propiedad; propietarios (uno o más, con porcentaje);
  inquilinos (uno o más); garantes; tipo vivienda o comercial; moneda (ARS o
  USD); inicio, fin y fecha de firma; día de vencimiento del pago; tramos;
  ajuste; honorarios; gastos administrativos; IVA del alquiler; punitorios;
  pago garantizado; depósito en garantía; estado.
- **Tramo**: un período del contrato con su importe mensual. Un contrato
  indexado tiene tramos cuyo importe se calcula; uno escalonado, tramos con
  importe fijo.
- **Concepto**: una línea que alguien debe o a quien se le debe, en una
  moneda, con período, vencimiento y estado. Es la pieza central, igual que
  en Gexion.
- **Cobro**: plata que entra de un inquilino (o de un propietario), imputada a
  conceptos. Genera un recibo.
- **Liquidación**: lo que se le paga a un propietario por un período, neto de
  honorarios y gastos. Genera un PDF de liquidación.
- **Índice**: ICL (BCRA, diario), IPC Nacional (INDEC, mensual) y Casa Propia,
  con sus valores por fecha o período.

## 5. Reglas de negocio

### Contratos y tramos

1. Un contrato **vigente** cubre cada mes entre su inicio y su fin **sin
   huecos ni superposiciones** de tramos. Guardar un contrato con un mes sin
   tramo, o con dos tramos sobre el mismo mes, falla con un error que nombra el
   mes.
2. Un contrato tiene estado `borrador`, `vigente`, `finalizado` o
   `rescindido`. Solo los `vigentes` generan conceptos.
3. Rescindir un contrato pide fecha; no se generan conceptos de alquiler de
   meses posteriores a esa fecha, y los ya generados de esos meses que no se
   cobraron se anulan con el motivo «rescisión».
4. Si los propietarios son más de uno, sus porcentajes suman **exactamente
   100**. Si no, el contrato no se guarda.

### Indexación

5. El importe de un tramo indexado es el **importe del tramo anterior** ×
   (valor del índice al empezar este tramo ÷ valor al empezar el anterior),
   **redondeado a peso entero**. Se encadena: cada tramo parte del importe
   que efectivamente se cobró, incluso si alguien lo corrigió a mano.
   - **ICL** (diario): el valor del día en que empieza cada tramo. Para el
     segundo tramo, el del día en que empezó el contrato.
   - **IPC** (mensual): el valor del **mes anterior** al que empieza cada
     tramo. Un tramo que arranca el 15/12/2025 usa noviembre; el contrato que
     arrancó el 15/08/2025, julio.
   - **Casa Propia** y cualquier índice sin fuente: el importe se carga a mano.

   El «período base» que muestra Gexion **no interviene** en la cuenta: en
   varios contratos dice un mes que no es el que usa. Por eso el contrato no
   lo guarda; sale de la fecha de inicio.

   Verificado el 5/10/2026 contra los tramos ya indexados de Vacker, con los
   valores oficiales (BCRA para el ICL, INDEC para el IPC):
   - IPC: 23 de 25 tramos exactos; los otros dos, a un peso.
   - ICL: 61 de 109 exactos; 31 más a menos del 0,005%, que es lo que mueve
     publicar el índice con dos decimales (Gexion debe usar más). El resto
     son importes redondos o saltos de más del 0,2%: correcciones manuales.

   Calcularlo desde el importe inicial con la variación acumulada da peor: 41
   de 109 en ICL y 16 de 25 en IPC. Es la regla que esta spec decía antes, y
   salía de leer los porcentajes que Gexion muestra redondeados.

6. El sistema **propone** el importe; queda aplicado solo cuando una persona
   lo **confirma**. Ningún importe cambia sin confirmación, aunque el índice
   esté cargado.
7. Si el índice del período requerido **todavía no se publicó** (el IPC sale
   con un mes de demora), el tramo no se puede indexar y aparece en la alerta
   «indexación pendiente de índice», no en «indexación vencida».
8. Los valores del ICL y del IPC se traen solos de la fuente oficial una vez
   por día; un valor ya cargado no se pisa. Si la fuente no responde, se
   reintenta al día siguiente y se avisa si pasan 3 días sin datos.

### Generación mensual de conceptos

9. Generar el período de un mes crea, por cada contrato vigente en ese mes:
   el alquiler **a cobrar** al inquilino, el alquiler **a pagar** a cada
   propietario (según su porcentaje), los **gastos administrativos** a cobrar
   al inquilino y los **honorarios** a descontarle a cada propietario.
10. Generar el mismo período **dos veces no duplica** nada: la segunda vez solo
    crea lo que falte (un contrato cargado después, por ejemplo).
11. Si una parte del mes cae en un tramo **sin indexar**, esa parte **no se
    genera** y el contrato queda listado en el resultado de la generación
    con el camino a «a indexar». No se cobra un importe viejo por defecto. La
    parte indexada del mismo mes sí se genera, como en Gexion: diciembre de
    2026 del contrato #5 trae el 1 al 14 (513.717,81) y nada del 15 en
    adelante. Una vez confirmada la indexación, generar el mes de nuevo crea
    lo que faltaba (regla 10).
12. Honorarios = alquiler del mes × porcentaje de honorarios del contrato
    × (1 + IVA de la inmobiliaria), a cargo del propietario. Gastos
    administrativos = alquiler del mes × porcentaje de gastos × (1 + IVA de la
    inmobiliaria), a cargo del inquilino. El IVA es una configuración de la
    inmobiliaria: **21% en Vacker**, que es responsable inscripto — en Gexion,
    8% de honorarios se cobra 9,68% y 2% de gastos, 2,42%. Se calculan con
    centavos, en dos pasos: primero el neto redondeado a centavos, después el
    IVA sobre ese neto. No da lo mismo que aplicar el porcentaje con IVA de
    una vez: sobre 513.717,81 al 2%, Gexion cobra 12.431,98 (10.274,36 × 1,21)
    y el 2,42% directo daría 12.431,97. El IVA **del alquiler** (porcentaje del contrato) es otra cosa y
    va a cargo del inquilino; hoy ningún contrato de Vacker lo tiene.
13. Los períodos son **meses calendario**. Si en un mes empieza o termina el
    contrato, o cambia el tramo, cada parte se cobra **proporcional a sus
    días** sobre los días de ese mes, como conceptos separados, conservando
    los centavos. Honorarios y gastos se calculan sobre cada parte.
    Confirmado por Javier y verificado en Gexion el 5/10/2026: un contrato
    que cambia de tramo el 15/08 genera «1 al 14» = 1.043.387 × 14/31 =
    471.207,03 y «15 al 31» = 1.137.518 × 17/31 = 623.800,19.
14. Expensas, impuestos, servicios y reparaciones se cargan como conceptos
    sueltos de un contrato, indicando **quién lo debe** (inquilino o
    propietario) y **quién ya lo pagó**, si alguien:
    - **nadie todavía**: se le cobra a quien lo debe;
    - **la inmobiliaria**: además queda marcado como adelantado; si lo debe el
      propietario, se le descuenta en la liquidación;
    - **la otra parte** (el inquilino arregló algo que era del dueño): además
      del cargo, se le reconoce a quien lo pagó con un concepto a pagar
      enlazado. Así lo registra Gexion: la misma reparación figura a pagar a
      uno y a cobrar al otro.

    Si lo deben varios propietarios, se reparte por sus porcentajes sin perder
    centavos.

### Vencimientos

37. El alquiler del inquilino vence el **día de vencimiento** del contrato
    (5 en Vacker) y al propietario se le paga el **día de pago** (10 en
    Vacker). Si cae sábado o domingo, se corre al lunes. Los feriados **no**
    se corren, igual que en Gexion (el 12/10/2026, feriado, queda igual).
    Decidido por Javier el 5/10/2026: se mantiene el criterio de Gexion.

### Cobros, punitorios y cuenta corriente

15. Un cobro se imputa a conceptos del inquilino; si no se eligen, se imputa
    **del más viejo al más nuevo**. Se permite el pago parcial: el concepto
    queda con saldo. Si al inquilino se le debe un reintegro (un gasto del
    dueño que pagó él, regla 14), se **compensa** contra lo que debe y paga la
    diferencia. Los **honorarios** no se cobran por caja: se descuentan en la
    liquidación (regla 20).
16. Si se cobra después del día de vencimiento, el sistema **propone** un
    punitorio = saldo del alquiler × tasa diaria del contrato × días de
    atraso. Los días corren desde el vencimiento o, si ya se cobró un
    punitorio por ese alquiler, desde ese cobro: un pago parcial no hace
    cobrar dos veces los mismos días. Se puede condonar total o parcialmente,
    con motivo obligatorio, que queda escrito en el cobro. El punitorio es
    ingreso de la inmobiliaria (regla 30).
17. Lo que se cobra de más queda como **saldo a favor** del inquilino y se usa
    en el próximo cobro.
18. Cada persona tiene una cuenta corriente **por moneda**. Un saldo nunca
    mezcla pesos y dólares; un contrato en USD genera conceptos en USD.
19. Un cobro, una liquidación o un concepto **no se borran**: se anulan, con
    motivo, usuario y fecha. La anulación revierte su efecto en la cuenta
    corriente y queda a la vista. Anular un cobro anula también los
    punitorios que nacieron con él. Un cobro cuyo saldo a favor ya se usó en
    otro posterior no se anula hasta anular ese otro: si no, el recibo
    posterior diría que aplicó una plata que ya no existe.

### Liquidación al propietario

20. El neto de una liquidación = alquileres cobrados del propietario −
    honorarios de esos alquileres − lo que el propietario debe por fuera
    (gastos adelantados por la inmobiliaria, o que pagó el inquilino por él)
    - reintegros a su favor. Cada concepto se liquida **una sola vez**. Solo
      cuenta lo de contratos donde la persona es propietaria. Un concepto se
      puede dejar para la próxima liquidación; si es un alquiler, sus
      honorarios esperan con él. Si los descuentos superan lo que se le paga,
      no se liquida hasta dejar algún descuento para después.
21. Con **pago garantizado**, el alquiler del propietario se liquida aunque el
    inquilino todavía no haya pagado; la deuda del inquilino sigue siendo con
    la inmobiliaria.
22. Sin pago garantizado, un alquiler impago **no entra** en la liquidación:
    queda «en espera», como en Gexion, con sus honorarios. Un pago parcial del
    inquilino libera **la misma proporción** del alquiler del propietario y de
    sus honorarios (decidido con Javier el 6/10/2026): si pagó la mitad, se le
    liquida la mitad y el resto sigue en espera. Al liquidar, la parte cobrada
    se separa en un concepto propio (enlazado al original por `origenId`);
    anular la liquidación la devuelve al original, salvo que el resto ya se
    haya liquidado después. Un cobro cuyo alquiler ya se liquidó al
    propietario —entero o en parte— no se anula antes que esa liquidación.

### Documentos

23. El recibo al inquilino lista los conceptos imputados y el total. La
    liquidación al propietario lista lo cobrado, cada descuento y el neto.
    Los dos llevan la leyenda «Documento no válido como factura» hasta la
    fase 2.
24. El estado de cuenta de una persona lista sus conceptos pendientes por
    moneda, con el total igual al saldo de su cuenta corriente.

### Firma del contrato

33. Un contrato tiene un **documento** (PDF) y un **estado de firma**:
    `sin_enviar`, `enviado`, `firmado_parcial`, `firmado`, `rechazado` o
    `vencido`. Cada firmante (propietarios, inquilinos, garantes) tiene su
    propio estado.
34. El estado de firma solo cambia por dos vías: **carga manual** (se sube el
    PDF firmado y se marca) o **aviso del proveedor**. Cada cambio queda
    registrado con fecha, estado anterior, estado nuevo y origen (`manual` o
    el nombre del proveedor). Un aviso de un proveedor que no corresponde al
    envío se rechaza.
35. El módulo pide la firma a través de una interfaz propia —enviar
    documento con firmantes, consultar estado, recibir aviso—. Ninguna otra
    parte del módulo conoce al proveedor: cambiarlo es escribir otro
    adaptador.
36. Un contrato puede pasar a `vigente` sin firma electrónica (puede haberse
    firmado en papel); el tablero lista los contratos vigentes **sin documento
    firmado** como «a completar».

    Cómo quedó en la entrega 9:
    - Un documento por contrato. El estado del documento **sale de sus
      firmantes**: alguien rechazó, rechazado; todos firmaron, firmado;
      algunos, firmado en parte. No se elige a mano.
    - Una vez enviado a firmar, el PDF no se cambia: se firma lo que se
      envió. Subir el PDF firmado marca que firmaron todos.
    - Mientras no se contrate un proveedor, el adaptador es el **manual**: la
      inmobiliaria manda el PDF por su cuenta y marca quién firmó. El
      proveedor se elige con `FIRMA_PROVEEDOR`; sus avisos llegan a
      `/webhooks/firma/<proveedor>` y, antes de mirarlos, el adaptador
      valida que sean auténticos.

### Contrato desde plantilla (entrega 15; en Word desde el 7/10/2026)

Pedido de Javier: la inmobiliaria sube **su propio contrato en Word** y de
cada contrato se descarga el Word completo. Reemplaza al editor de texto y al
PDF generado desde la plantilla.

38. Una inmobiliaria tiene **varias plantillas** de contrato. Cada una es un
    Word (`.docx`, hasta 5 MB) con un nombre y para qué contratos sirve
    (particulares, comerciales o los dos). El archivo se guarda en el bucket
    privado de los contratos, bajo la carpeta de la inmobiliaria; reemplazarlo
    sube uno nuevo y borra el anterior, y borrar la plantilla borra su Word.
39. Donde va un dato, el Word lleva un **marcador entre llaves**:
    `{contrato.codigo}`. Una parte que aparece solo si se cumple algo va entre
    `{#deposito}…{/deposito}` (con `{^deposito}…`, solo si no se cumple), y una
    que se repite por cada tramo, propietario, inquilino o garante, entre
    `{#tramos}…{/tramos}`; adentro valen los campos de la lista (`{desde}`) y
    los datos del contrato. Los marcadores son **una sola lista**
    (`MARCADORES_PLANTILLA`, en `@vacker/types`), con descripción y ejemplo.
40. Al **subir o reemplazar** el Word se revisan todos los marcadores contra
    esa lista. Uno desconocido o mal escrito (con sugerencia), con llaves
    dobles, una sección que no se cierra o se cierra con otro nombre, o un
    campo de lista usado fuera de su lista **rechaza la subida** con un mensaje
    en castellano que nombra cada uno. Lo que no es un `.docx` por su
    contenido —no por su nombre— se rechaza.
41. Desde un contrato no anulado se elige una plantilla de Word que sirva para
    su tipo y se **descarga el Word completo**, llamado
    `Contrato-<código>.docx`. Un dato opcional que falta (la fecha de firma,
    el depósito) queda vacío; uno que el contrato necesita y falta dice
    «[sin cargar]». Un contrato sin depósito no imprime «[sin depósito]»: la
    cláusula va dentro de `{#deposito}`.
42. Descargarlo **no genera un PDF ni lo guarda** como el documento del
    contrato: el PDF que se firma se sube a mano en «Documento y firma»
    (regla 33). Cada descarga queda en el historial del contrato.
43. Las plantillas de **texto** del editor anterior quedan en la lista,
    marcadas, y ya no generan: se reemplazan por un Word o se borran.
44. Se descarga un **Word de ejemplo** con cada marcador explicado y un
    contrato de locación armado con ellos. Es una plantilla válida: subirlo
    tal cual funciona.

### Migración

25. Al día de corte, cada persona migrada tiene un concepto «Saldo inicial»
    por moneda, igual a su saldo en Gexion a ese día. Antes del corte no hay
    otros movimientos.

### Tablero del módulo

26. **Cada número del tablero abre la lista de lo que cuenta**, y esa lista
    suma exactamente el número (la misma regla del Tablero Comercial, ver
    `apps/web/lib/drill.ts`). El número y su lista llegan juntos de la API,
    del mismo cálculo. Los gráficos no se abren: son tendencia, no números
    para auditar, y van en pesos, la moneda de toda la cartera de Vacker.
27. **Cartera**: contratos vigentes (vivienda y comercial), alquiler mensual
    administrado por moneda, cantidad de propietarios e inquilinos.
28. **Cobranza del mes**: alquileres cobrados ÷ alquileres emitidos del mes,
    en cantidad y en importe, por moneda. Un alquiler cobrado parcialmente
    cuenta como no cobrado en la cantidad y por lo cobrado en el importe.
29. **Morosidad**: deuda vencida de inquilinos por antigüedad —hasta 30,
    31-60, 61-90 y más de 90 días desde el vencimiento—, y la evolución de 12
    meses del porcentaje cobrado al cierre de cada mes (lo aplicado hasta el
    último día de ese mes, sin lo de cobros anulados). Lo que un propietario
    debe en su propio contrato no es mora: se descuenta al liquidar.
30. **Ingresos de la inmobiliaria**: honorarios + gastos administrativos +
    punitorios cobrados, por mes, 12 meses, contra el mismo mes del año
    anterior.
31. **Lo que hay que hacer**: indexaciones vencidas y de los próximos 30 días,
    contratos que vencen en 30, 60 y 90 días (en franjas: hasta 30, de 31 a 60,
    de 61 a 90), depósitos a devolver (contratos terminados o que terminan en
    30 días, con depósito y sin fecha de devolución), propietarios para
    liquidar, inquilinos con deuda de más de 30 días.
32. Una inmobiliaria con el módulo prendido y sin contratos ve el tablero con
    un mensaje que explica cómo empezar, **no** tarjetas en cero.

### Impuestos y servicios (entrega 19; rediseñada el 7/10/2026)

Pedido de Javier: la pantalla «no se entiende». Mezclaba tres trabajos —
configurar una vez, cargar una vez por mes, pagar y controlar todos los días—
en cinco bloques apilados, y «la debe · paga» no decía qué pasaba con la plata.

45. `/alquileres/impuestos` tiene **tres pestañas**, elegidas por `?ver=`:
    «Para pagar» (`pagar`, la de entrada), «Cargar el mes» (`cargar`) y «Qué
    tiene cada propiedad» (`propiedades`). Un `?ver=` desconocido —y el
    `?ver=control` de antes— abre «Para pagar»; cambiar de mes no cambia de
    pestaña. Las **pólizas no están** en esta pantalla: se dan de alta y se
    anulan en la ficha del contrato. Sus cuotas son boletas y aparecen en
    «Para pagar». La tarjeta de boletas del Dashboard lleva a `?ver=pagar`.
46. Quién debe una boleta y quién la paga se dice con **una sola frase**, la
    misma en «Para pagar», en «Cargar el mes» y en el alta del impuesto de una
    propiedad (`consecuenciaDeBoleta`, en `@vacker/types`):

    | La debe     | La paga         | Frase                                                                               |
    | ----------- | --------------- | ----------------------------------------------------------------------------------- |
    | inquilino   | el inquilino    | La paga el inquilino: solo hay que pedirle el comprobante                           |
    | propietario | el propietario  | La paga el propietario: solo hay que pedirle el comprobante                         |
    | inquilino   | la inmobiliaria | La paga la inmobiliaria y se le cobra al inquilino en su próximo recibo             |
    | propietario | la inmobiliaria | La paga la inmobiliaria y se le descuenta al propietario al liquidar                |
    | propietario | el inquilino    | La paga el inquilino y se le descuenta al propietario (al inquilino se le reconoce) |
    | inquilino   | el propietario  | La paga el propietario y se le cobra al inquilino para devolvérsela                 |

    Sin contrato ese mes, cualquiera sea la combinación: «Sin contrato ese mes:
    no se le carga a nadie, queda para control». El alta tiene **un solo
    campo**, «Quién la paga y a quién se le carga», con las seis frases; la API
    sigue recibiendo `aCargoDe` y `paga`.

47. Una boleta **pagada** que le cargó algo a quien la debe dice si ya se
    recuperó: «Ya se le cobró al inquilino», «Ya se le descontó al
    propietario», o lo que falta («Falta descontárselo al propietario: va en
    su próxima liquidación»; «Falta cobrárselo al inquilino: va en su próximo
    recibo»). Recuperada (`cargoRecuperado`) = todos sus conceptos a cobrar no
    anulados tienen saldo cero, con el mismo saldo de la cuenta corriente
    (`saldoDeConcepto`: importe − imputaciones activas; liquidado = 0). Si no
    se le cargó nada a nadie es `null` y no se dice nada.
48. «Para pagar» agrupa por urgencia, y cada boleta queda en **un solo**
    grupo: **Vencidas** (pendientes con vencimiento anterior a hoy, de
    cualquier mes), **Esta semana** (pendientes que vencen de hoy a 7 días, de
    cualquier mes), **Más adelante en {mes}** (pendientes del mes elegido que
    vencen después) y **Pagadas de {mes}**. Las anuladas del mes van aparte,
    detrás de «Ver anuladas». Cada fila dice qué es («TGI · cuota 10 de 12»),
    la propiedad y el contrato, «venció el lun 06/10» o «vence el vie 10/10»,
    la frase de la regla 46 (o la de la 47, ya pagada), el importe, y un botón
    con texto: «Registrar pago» si la paga la inmobiliaria, «Trajo el
    comprobante» si la paga una parte. Anular es una acción secundaria, con
    texto. Quién la cargó no se repite en cada fila.
49. Las tarjetas de «Para pagar» tienen **un horizonte cada una**: «Vencidas»
    = importe y cantidad del grupo Vencidas; «Vencen esta semana» = los del
    grupo Esta semana, **sin** las vencidas; «Comprobantes que faltan» =
    vencidas que paga el inquilino o el propietario; «Adelantado sin
    recuperar», la regla 50.
50. **Adelantado sin recuperar** = lo que la inmobiliaria ya pagó de boletas
    —cuotas de pólizas incluidas— y todavía no cobró ni descontó: la suma del
    saldo (`saldoDeConcepto`) de los conceptos a cobrar adelantados por la
    inmobiliaria de boletas **pagadas y no anuladas**, de todos los meses,
    **por moneda**. Un cobro parcial descuenta lo cobrado; una liquidación lo
    salda; una boleta o un concepto anulados no cuentan; lo que todavía no se
    pagó no es un adelanto. Lo calcula la API (`GET
/alquileres/boletas/adelantado`) con un número fijo de consultas.
51. La cuota se carga en **dos campos** («[3] de [6]»), se guarda como hasta
    ahora («3/6», `CuotaSchema` no cambia) y en toda la pantalla se **muestra**
    «cuota 3 de 6» (`textoCuota`): «10/12» se leía como una fecha. Uno solo de
    los dos números, letras o una cuota mayor que el total no se guardan, y el
    aviso nombra el impuesto y la propiedad.
52. «Cargar el mes» es una tabla con títulos (Impuesto · Cuota · Vence ·
    Importe), agrupada por propiedad, con el importe del mes anterior en cada
    fila y lo ya cargado como «✓ Ya cargada: $ X, vence dd/mm». El pie dice
    «N boletas para guardar · $ X» y el botón «Guardar N boletas». **Después
    de guardar**, el aviso del resultado no convive con un contador en cero:
    el pie muestra solo el aviso, hasta que se escribe otra cosa.
53. «Qué tiene cada propiedad» lista **todas** las propiedades, también las
    que no tienen ningún impuesto asignado, con «Asignar». Debajo, más chico,
    el catálogo de la inmobiliaria. Ningún texto visible usa «cuenta» como
    jerga por «impuesto de la propiedad».

### Reclamos: quién lo sigue y quién lo arregla (7/10/2026)

Pedido de Javier: «los reclamos se los asignás a los vendedores, eso está
mal». El campo «Asignado a» listaba a todos los usuarios activos, vendedores
incluidos. Pasa a ser dos campos.

60. Un reclamo tiene **«Lo sigue»** —la persona de la inmobiliaria que lo
    gestiona— y **«Proveedor»** —quién lo arregla—. Los dos son opcionales; en
    blanco se leen «Sin asignar» y «Sin proveedor». «Lo sigue» reemplaza a
    «Asignado a» (la columna `asignado_a_id` es la misma).
61. «Lo sigue» ofrece solo a los usuarios **activos** con algún rol que entra
    al módulo (`ROLES_ADMINISTRACION_ALQUILERES`: administración, dirección,
    admin). Un vendedor, un team leader o un publicador no aparecen.
62. Es un **permiso**, no un filtro de la pantalla: la API rechaza con 400, y
    un mensaje que nombra a la persona, abrir o reasignar un reclamo a
    alguien que no entra al módulo o que está inactivo. Alguien que además de
    vendedor es de dirección o admin sí puede seguirlo.
63. Un reclamo que ya lo seguía alguien que hoy no califica **conserva su
    nombre** en la lista y en la ficha. En la ficha, el campo lo muestra como
    la opción actual, marcada «Nombre · no usa Alquileres», para no perderlo
    en silencio: guardar otro cambio no lo toca ni falla, y pasarlo a otra
    persona válida o a «Sin asignar» funciona.
64. «Proveedor» se elige de la lista de **Proveedores** del módulo. Uno que no
    es de la inmobiliaria se rechaza («El proveedor no existe.»), en la API y
    en la base (clave foránea con la inmobiliaria adelante).
65. Cada cambio deja su nota en el historial del reclamo: «Lo sigue: X.» o
    «Sin asignar.»; «Proveedor: X.» o «Sin proveedor.».
66. El proveedor se ve en la lista (columna y tarjeta), en la ficha y en los
    reclamos del contrato. En la ficha, su teléfono y su email son enlaces
    para llamarlo o escribirle. La lista trae los proveedores en una sola
    consulta, no una por reclamo.

Borrar un proveedor (solo se puede si no tiene comprobantes) deja sus
reclamos «Sin proveedor»; el historial de cada uno conserva la nota con el
nombre.

### Reclamos: el circuito del arreglo (7/10/2026)

Pedido de Javier sobre la ficha del reclamo: «como está no sirve». Aprobó
cinco cambios: tres estados, la prioridad con su nombre, el gasto del arreglo
cargado desde el reclamo y el aviso al proveedor por mail.

67. Un reclamo tiene **tres estados**: Abierto, En curso y Resuelto. «Cerrado»
    se fue —no se distinguía de Resuelto—: los reclamos cerrados pasan a
    resueltos y conservan `cerrado_en` (migración
    `20261022100000_reclamos_circuito`). Pasar a Resuelto anota la fecha;
    reabrirlo la borra. «Abiertos» —en la lista y en «Reclamos abiertos» del
    Dashboard— son Abierto y En curso (`ESTADOS_RECLAMO_ABIERTOS`).
68. Una pantalla vieja que todavía manda «cerrado», o una fila que la
    migración no alcanzó, **se lee como «resuelto»**: no se rechaza, porque
    quien lo manda quería lo mismo, y no se repite el cambio si ya estaba
    resuelto. Un valor que no es un estado se sigue rechazando con 400.
69. La prioridad suelta dice su nombre: **«Prioridad media»**, no «Media»,
    arriba de la ficha, en los reclamos del contrato y en el Dashboard
    (`nombrePrioridad`). Bajo un rótulo «Prioridad» (columna de la lista,
    campo de la tarjeta) alcanza con «Media».
70. **«Cargar el gasto del arreglo»**, en la ficha, abre el mismo formulario
    de comprobante de Gastos › Proveedores, con el proveedor del reclamo y su
    contrato (fijo). Sin proveedor en el reclamo funciona igual: se elige en
    el formulario. El comprobante queda **enlazado** al reclamo
    (`alq_comprobante.reclamo_id`, opcional, con la clave `(tenant_id,
reclamo_id)` en la base; borrar el reclamo lo deja suelto). La API
    rechaza un reclamo de otra inmobiliaria («El reclamo no existe.») y un
    gasto a cargo de una parte que va a otro contrato que el del reclamo.
71. La ficha muestra **«Gastos del arreglo»**: fecha, proveedor, qué se hizo,
    a cargo de quién, importe y estado (A pagar, Pagado, Anulado), tarjetas
    en el celular y tabla en la compu, y el **total sin los anulados**. Cargar
    un gasto deja su nota en el historial del reclamo («Gasto del arreglo:
    X, $ Y, a cargo del propietario.»). La ficha hace las mismas consultas
    con uno o con muchos gastos.
72. En Gastos › Proveedores, el comprobante que salió de un reclamo dice
    **«Reclamo N»**, con link a su ficha.
73. **«Avisar al proveedor»** abre el mail ya redactado y editable: asunto
    «Reclamo N · {asunto} · {dirección}»; en el cuerpo, la dirección y la
    unidad, qué pasa (asunto y detalle), la prioridad, el inquilino del
    contrato y su teléfono —con el tilde «Incluir el teléfono del inquilino»,
    marcado por defecto— y quién lo sigue en la inmobiliaria con su
    teléfono y su email para coordinar. Sale con la infraestructura de los
    recibos: a nombre de la inmobiliaria, desde el dominio de la plataforma,
    respuestas a quien lo manda, su firma al pie y el mismo tope por hora.
    Va **solo al email del proveedor del reclamo**: el pedido no trae
    destinatario. Sin proveedor, o sin email («Cargale un email al
    proveedor en Gastos › Proveedores», con link), el botón no falla: dice
    qué falta. Al salir queda en el historial: «Se avisó a {proveedor} por
    mail ({email}).». Si el mail no sale, no queda anotado. Nada se manda
    solo.

### Dashboard: el período (7/10/2026)

Pedido de Javier: «en el dashboard principal de alquileres tenemos que
replicar lo que tenemos en dashboard comercial con la posibilidad de ver el
mes actual, el acumulado anual y la vista de Q1, Q2, Q3 y Q4 en cada uno de
los indicadores». Amplía las reglas 26 a 31; no cambia quién ve el Dashboard
(§3).

74. **Un solo selector de período** para toda la pantalla, en el encabezado,
    junto a Tipo y Año, con el aspecto del Tablero Comercial: **Mes** (con el
    mes), **Trimestre** (Q1 a Q4) o **Año**, siempre del año elegido. Al
    entrar, el mes en curso (diciembre, en un año que ya pasó). Queda en la
    dirección —`?periodo=mes&mes=3`, `?periodo=trimestre&q=3`,
    `?periodo=anio`; el período por defecto no escribe nada— y una dirección
    que no se entiende vuelve al de por defecto. Cambiar de período, como
    cambiar de tipo, **no le pide nada al servidor**; cambiar de año sí, y
    conserva el período.
75. **Los flujos son del período**: alquileres emitidos y cobrados (cantidad
    e importe), ingresos de la inmobiliaria (el total y cada parte:
    honorarios, gastos administrativos, punitorios, comisiones e informes) y
    contratos nuevos. Un trimestre o un año es **la suma de sus meses**. Los
    contratos nuevos dejan sus tarjetas Q1 a Q4 propias y siguen al
    selector.
76. **«Importe cobrado» es lo cobrado hasta hoy** de los alquileres del
    período. Debajo dice qué parte de lo emitido es y **«x% se cobró dentro
    del mes»**: lo cobrado al cierre de cada mes (regla 29) sobre lo emitido,
    recalculado sobre los totales del período, nunca el promedio de los
    porcentajes.
77. **Las fotos son al cierre del período**: contratos vigentes (particulares
    y comerciales), alquiler mensual y deuda vencida con sus tramos. El
    cierre es el último día del último mes del período; si el período llega
    a hoy —o todavía no empezó—, es **a hoy**, como siempre. El rótulo lo
    dice: «al 31/03/2026» o «a hoy». Al cierre:
    - **vigente** es por fechas: había empezado y no había terminado (el fin,
      o la rescisión); uno que hoy sigue vigente lo estaba desde que empezó,
      aunque ya haya pasado su fin. A hoy es su estado, como siempre;
    - el **alquiler** de cada uno es el del tramo de esa fecha;
    - la **deuda** es lo vencido antes de esa fecha menos lo cobrado hasta
      esa fecha, sin cobros anulados, con las mismas exclusiones de la regla
      29, y la antigüedad de cada tramo contada a esa fecha.
78. **«Lo que hay que hacer»**, «Vencen en 90 días» y el reparto entre
    particulares y comerciales son **siempre a hoy**: no siguen al selector y
    lo dicen («a hoy»).
79. **Cada número del período abre la lista de lo que cuenta** (regla 26) y
    la lista **suma exactamente la tarjeta**. El tablero trae los doce meses
    sumados —no las listas de un año para tres cortes—; la lista de un flujo
    o de una foto al cierre se pide al abrirla
    (`GET /alquileres/tablero/detalle?indicador=…&desde=AAAA-MM&hasta=AAAA-MM&tipo=…&moneda=…&tramo=…`,
    un año como máximo, los mismos roles del Dashboard). El número y la lista
    salen de la misma consulta y de la misma definición. Lo que es a hoy —y
    los contratos nuevos— viajan con el tablero, con su lista.
80. **El gráfico y la planilla** siguen al período: con Mes o Año, doce meses
    —con Mes, el elegido marcado; con Año, ninguno, porque es todo el año—;
    con Trimestre, Q1 a Q4 con el elegido marcado. Tocar una barra o una
    columna elige ese mes o ese trimestre en toda la pantalla. El pie dice lo
    del período elegido.
81. **Sin comparación con el año anterior en las tarjetas** (Javier: confunde
    —pesos con inflación, y el año anterior está vacío en casi todas las
    inmobiliarias—). Quedan solo «x en {año anterior}» de Contratos nuevos,
    en cantidad, y la fila «Ingresos {año anterior}» de la planilla.
82. El Dashboard hace **las mismas consultas** con 5 o con 500 contratos
    (siete, más las de la bandeja de indexación y las liquidaciones
    pendientes), y la lista de un número, dos como mucho.

### Informe al propietario (7/10/2026)

Pedido de Javier: «un reporte para el propietario, donde le podemos detallar
los alquileres que cobró, los honorarios que pagó, los impuestos que se le
hayan descontado o expensas extraordinarias y las atenciones con proveedores
que tuvo su propiedad, esto puede ser algo global que lo vea el administrador
de la inmobiliaria y se puede generar una ficha para el propietario, de manera
que pueda ver cómo está funcionando su propiedad». Lo ven los mismos roles que
el resto del módulo (§3); el propietario no entra: recibe el PDF.

83. **Dónde está.** Una solapa **«Informe»** en la ficha de la persona, que
    aparece solo si es **propietaria** en algún contrato que no esté en
    borrador ni anulado (lo mismo que mira la API: a quien no lo es, 404 «X
    no es propietario de ningún contrato.»). Y la pantalla **«Informe de
    propietarios»** (`/alquileres/propietarios`), en la segunda fila de la
    pestaña Liquidaciones: la barra sigue con once pestañas. Los endpoints
    (`/alquileres/informes/propietarios…`) llevan `@Modulo('alquileres')` y
    `ROLES_ADMINISTRACION_ALQUILERES`: una inmobiliaria sin el módulo recibe
    403 y no ve la pestaña.
84. **El período** se elige con **el mismo selector del Dashboard** (Mes,
    Trimestre o Año, y el año: este y los dos anteriores; una sola pieza,
    `selector-periodo.tsx`), pero abre en **el mes anterior, ya cerrado**
    (en enero, diciembre del año anterior). Queda en la dirección
    (`?anio=2026&periodo=trimestre&q=3`; el de por defecto no escribe nada),
    y lo que no se entiende vuelve al de por defecto. La API pide
    `desde`/`hasta` (`AAAA-MM`), en orden y de un año como máximo, con los
    mismos mensajes que el detalle del Dashboard (`RANGO_EN_ORDEN`,
    `RANGO_DE_UN_ANIO`).
85. **Qué fecha pone cada cosa en el período.** Cada concepto entra por **su
    mes** (`periodo`): el alquiler y sus honorarios, por el mes del
    alquiler; un impuesto, un servicio o una expensa, por el mes de la
    boleta; un arreglo, por el mes de la fecha del comprobante. Lo **cobrado**
    y lo **liquidado** de esos conceptos se cuentan **hasta la fecha del
    informe** —como el «Importe cobrado» del Dashboard (regla 76)—, con su
    fecha a la vista: cuándo pagó el inquilino (la fecha del cobro en que se
    registró, sin cobros anulados) y en qué liquidación y cuándo se le pagó.
    Un **reclamo** entra si se creó en el período o estuvo abierto durante él
    (creado antes de que termine y no resuelto antes de que empiece; los días
    se cortan a la medianoche argentina). La **deuda** del inquilino es a hoy.
    El informe dice la fecha: «Lo cobrado y lo liquidado se cuentan hasta
    hoy, 07/10/2026».
86. **Solo lo suyo como propietario**, con la definición de la liquidación
    (regla 20): sus conceptos en contratos donde es propietario —en uno con
    varios dueños, su parte—; lo que se le paga (`a_pagar`) y lo que se le
    descuenta (honorarios y los gastos de `GASTOS_DEL_PROPIETARIO`). Lo que
    debe como inquilino de otro contrato no entra.
87. **La cadena**, por moneda, cierra al centavo:
    - Alquiler del período − el inquilino todavía no pagó = **Cobrado**.
    - Cobrado − honorarios − impuestos y servicios − expensas − arreglos −
      otros descuentos + reintegros a su favor = **Neto del período**.
    - Neto = **Liquidado** (lo que ya se le transfirió) + **Pendiente de
      liquidar** (lo que va en la próxima). Pendiente negativo se dice «A
      descontar en la próxima liquidación».

    «Cobrado» es la parte de su alquiler que ya está para él: la proporción
    que pagó el inquilino (regla 22) o todo, con pago garantizado (regla 21);
    sale de `proponerLiquidacion`, la misma propuesta de la pantalla de
    liquidaciones. Sus honorarios se descuentan en esa misma proporción: lo
    que espera al inquilino no se cuenta como descontado. Los gastos se
    descuentan enteros. Lo que el propietario pagó él mismo por caja, o se
    compensó en un cobro, no pasa por la liquidación y no figura.

88. **Pesos y dólares nunca se suman**: una cadena por moneda; en la tabla
    de propietarios, una línea por moneda en cada celda y un total por
    moneda.
89. **«El inquilino debe hoy $ X»**, solo si hay deuda vencida en sus
    contratos: la misma deuda del Dashboard (regla 77, `sqlSaldosAlCierre`,
    a hoy), por moneda y por contrato.
90. **Por propiedad**: cada contrato suyo en curso durante el período (o con
    algo que contar en él): propiedad, contrato, inquilinos, alquiler
    vigente, próxima indexación, vencimiento y, con varios propietarios, su
    parte. Mes a mes: su alquiler, cuánto se cobró y cuándo, lo que el
    inquilino todavía debe de ese mes y en qué liquidación se le pagó.
91. **Descuentos detallados**: honorarios; impuestos y servicios **con el
    nombre del impuesto** (el del catálogo: «API (Impuesto inmobiliario)»,
    «TGI (Tasa municipal)»…); expensas con su nombre —las **«Expensas
    extraordinarias»** son un servicio más del catálogo sugerido, clase
    expensa, así salen en su propia línea, sin cambiar el esquema—; arreglos
    con el proveedor, qué se hizo y su reclamo; otros (pólizas, cargos). Cada
    línea dice «Descontado en la liquidación N del dd/mm» o «Va en la
    próxima liquidación», y cada grupo suma su renglón de la cadena.
92. **Mantenimiento**: los reclamos de sus contratos (o cargados a su
    nombre) del período (regla 85): fecha, número, asunto, propiedad,
    proveedor y estado. El **importe**, solo de los gastos del arreglo **a
    cargo del propietario** (comprobantes no anulados con
    `reclamo_id`); uno a cargo del inquilino o de la inmobiliaria no se
    muestra. Las **notas internas** del reclamo no se leen de la base y no
    salen en la API, la pantalla ni el PDF.
93. **Liquidaciones**: las que le pagaron algo del período, con número,
    fecha, medio, el neto de la liquidación y cuánto de eso es del período;
    lo del período de todas suma «Liquidado». Las anuladas no están (sus
    conceptos vuelven a quedar por liquidar, regla 19).
94. **Sin movimientos** en el período, el informe dice «Sin movimientos en
    {período}.» en vez de una cadena en cero —en la pantalla, en el PDF y en
    la tabla («Sin movimientos»)—, y sigue mostrando sus contratos.
95. **«Descargar PDF»** arma el informe con la marca de la inmobiliaria
    (`Informe-<nombre>-<AAAA-MM>.pdf`), del mismo cálculo que la pantalla,
    solo con Montserrat. **«Mandar por mail»** sale como la liquidación (regla
    73 y entrega 13): a los mails de la persona y de sus contactos o a otro,
    a nombre de la inmobiliaria, con el PDF adjunto, el mismo tope por hora,
    y queda en el historial de la persona («Informe de septiembre 2026
    enviado a …»). **De a una persona**: no hay envío masivo.
96. **Informe de propietarios**: una fila por propietario con contratos en
    el período —cobrado, honorarios, otros descuentos (impuestos, expensas,
    arreglos y otros), liquidado, pendiente de liquidar y reclamos—, con
    totales por moneda. Cada fila abre su informe en la ficha
    (`?solapa=informe`) con el mismo período. En el teléfono y la tablet,
    tarjetas (`ListaTarjetas`, hasta `lg`); en la compu, tabla. La fila de
    cada propietario es **exactamente** el resumen de su informe: los dos
    salen de la misma lectura y el mismo armado.
97. El informe y la tabla hacen **las mismas consultas** con 5 o con 25
    contratos (ocho como mucho: la persona, los contratos, sus conceptos, los alquileres
    de los inquilinos, los reclamos, la deuda, y los nombres de las boletas y
    de los comprobantes), y ninguna crece con los propietarios.

**Fuera de alcance de este informe:**

- **Acceso del propietario**: ni portal, ni usuario, ni link público. Recibe
  el PDF por mail (o por WhatsApp, a mano).
- **Envío masivo** a todos los propietarios de una vez, y el envío
  automático a fin de mes.
- La comparación con el período anterior o con el año anterior.
- Un informe equivalente para el **inquilino**.
- Un esquema nuevo: no hay migración. Las expensas extraordinarias son un
  servicio del catálogo.

**Criterio de aceptación (en Alteva):**

1. Javier entra a Alteva con su usuario de dirección, va a **Liquidaciones ›
   Informe de propietarios** y ve, en septiembre de 2026 (el mes anterior),
   una fila por cada propietario de los contratos de prueba. En el teléfono
   las ve como tarjetas.
2. Elige un propietario con un alquiler de septiembre cobrado y liquidado: la
   fila abre su ficha en la solapa «Informe», en septiembre. Lo cobrado y
   los honorarios coinciden con la liquidación de ese mes (Liquidaciones), y
   la cadena cierra: cobrado − descuentos = liquidado + pendiente.
3. Carga en Impuestos y servicios, para esa propiedad, una boleta de
   «Expensas extraordinarias» a cargo del propietario que paga la
   inmobiliaria: al volver al informe aparece en Descuentos › Expensas con
   ese nombre y «Va en la próxima liquidación», y baja el pendiente.
4. En un reclamo de ese contrato con un gasto a cargo del propietario, el
   informe muestra el importe; en uno cuyo gasto es del inquilino, no. Las
   notas del reclamo no aparecen en ningún lado.
5. Cambia a Trimestre (Q3) y a Año: el informe se recalcula y la dirección
   lo conserva al recargar.
6. «Descargar PDF» baja `Informe-<nombre>-2026-09.pdf` con la marca verde de
   Alteva y los mismos números. «Mandar por mail» a su propio correo llega
   con el PDF adjunto y queda en el historial de la persona.
7. En la Inmobiliaria de Demo, sin el módulo, un usuario `direccion` no ve
   Alquileres y la API de informes responde 403.

## 6. Casos borde

- **La fila vieja**: contratos migrados de Gexion sin algún dato (sin
  garante, sin día de vencimiento, sin depósito). El contrato se guarda; lo
  faltante aparece como «a completar» en la ficha y en una alerta, sin
  bloquear la operación del mes.
- **La lista vacía**: un inquilino sin conceptos; un mes sin cobros; un
  propietario sin nada para liquidar → mensajes claros, no tablas vacías.
- **El dato de otro**: no hay puntas, pero sí **inmobiliarias**: ninguna
  consulta cruza `tenant_id`. Toda tabla nueva lleva RLS y entra en
  `isolation.e2e-spec.ts`.
- **La inmobiliaria sin el módulo**: Vacker con el módulo y la Inmobiliaria de
  Demo sin él → la Demo no lo ve en la Home y recibe 403 en la API, aunque el
  usuario sea `direccion`.
- **El índice que no llegó**: ver regla 7.
- **El contrato en dólares** con honorarios en pesos: no existe; todo el
  contrato va en su moneda (regla 18).
- **Varios inquilinos en un contrato**: los cargos del mes van a uno solo,
  siempre el mismo. Tiene que ser estable, porque la clave que evita
  duplicar (regla 10) lleva la persona.
- **El IVA del alquiler** (ningún contrato de Vacker lo tiene): lo paga el
  inquilino y lo recibe el propietario, que es quien lo factura.
- **Un concepto generado y después anulado** no se vuelve a crear al generar
  el mes de nuevo: la anulación es una decisión, no un hueco.
- **El mes de la rescisión** se genera entero; los siguientes no (regla 3).
- **El propietario que también es inquilino**: una sola persona, dos cuentas
  corrientes por contrato, un solo estado de cuenta que las muestra separadas.

## 7. Fuera de alcance (fase 1)

- **Facturación electrónica** (fase 2, con facturador homologado).
- **Contabilidad**: plan de cuentas, asientos, libros IVA, retenciones.
- **Caja, bancos y cheques**: el cobro registra el medio, no concilia.
- **Proveedores** y sus pagos.
- **Cupones de cobro SIRO / Roela** y cualquier otro servicio de recaudación.
- **La conexión con un proveedor de firma** (queda prevista, ver reglas
  33–36). La **generación del contrato desde plantilla** llegó en la entrega
  15 y es en Word desde el 7/10/2026 (reglas 38–44).
- **Pólizas de seguro** y sellados.
- **Contratos de venta financiada** y loteos.
- **Portal** de propietarios e inquilinos con usuario propio.
- **Envío automático** de PDFs: en la fase 1 se generan y se mandan a mano
  (WhatsApp o mail del operador).

## 8. Criterio de aceptación

Con los datos reales de Vacker migrados al día de corte:

1. Javier entra con un usuario de rol `administracion` en Vacker y ve el
   módulo en la Home; con un usuario `vendedor`, no lo ve, y la URL directa
   devuelve «sin acceso».
2. Se cotejan **cinco contratos reales** de Vacker, elegidos el 5/10/2026
   recorriendo los 78 vigentes (código de Gexion entre paréntesis):

   | Caso                     | Contrato       | Por qué                                        |
   | ------------------------ | -------------- | ---------------------------------------------- |
   | ICL con historia         | #25, comercial | Seis tramos, todos indexados; honorarios 2,48% |
   | IPC que arranca el 15    | #5, vivienda   | Tramos que cambian a mitad de mes: prorrateo   |
   | Casa Propia              | #26, vivienda  | El único con CCP; contrato desde 2023          |
   | Sin indexación           | #93, vivienda  | Importe fijo; honorarios 5%                    |
   | Comercial sin honorarios | #72, comercial | IPC, arranca el 15, honorarios 0%              |

   En la cartera de Vacker **no hay** contratos en dólares, con IVA del
   alquiler ni con pago garantizado: esas reglas se prueban con casos
   construidos, no con un cotejo. Para el primer mes después del corte, en
   Gexion y en el módulo, se comparan:
   - el alquiler del mes,
   - los honorarios y los gastos administrativos,
   - el neto liquidado a cada propietario,
   - el saldo de cada inquilino al fin de mes.

   **Tienen que coincidir al peso.** Cualquier diferencia es un error del
   módulo o una regla mal entendida, y se corrige antes de apagar Gexion.

   La excepción es la **próxima indexación por ICL**: el módulo usa el valor
   oficial del BCRA, que tiene dos decimales, y puede dar unos pesos distinto
   de lo que habría calculado Gexion (regla 5). Se acepta; la diferencia se
   anota en el cotejo y no frena el corte.

3. El tablero muestra la misma cantidad de contratos vigentes que Gexion (78
   al 5/10/2026, o los que haya al corte) y el mismo porcentaje de alquileres
   cobrados del mes.
4. En la Inmobiliaria de Demo, sin el módulo, un usuario `direccion` no ve
   «Alquileres» en la Home.

## 9. Cada regla con su test

| Reglas            | Cómo se protegen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 4              | Unit del validador de contrato: mes sin tramo, tramos superpuestos, porcentajes que no suman 100                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2, 3              | Unit de generación: contrato `borrador`/`finalizado` no genera; rescisión anula lo impago posterior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5, 6, 7           | Unit de indexación con valores del ICL e IPC conocidos; un tramo sin confirmar no cambia de importe; índice no publicado → alerta correcta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8                 | Unit del importador de índices con la fuente simulada: no pisa, reintenta, avisa a los 3 días                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9, 10, 11, 12, 13 | Unit de generación del período: conceptos esperados por contrato; idempotencia; bloqueo por indexación; montos con IVA de la inmobiliaria; prorrateo por cambio de tramo con los importes de Gexion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 37                | Unit de vencimientos: sábado y domingo se corren al lunes, un feriado no                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 14, 20, 21, 22    | Unit de liquidación: neto con gastos adelantados, con y sin pago garantizado, sin doble liquidación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15, 16, 17        | Unit de cobro: imputación por antigüedad, parcial, punitorio propuesto y condonado, saldo a favor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 18                | Unit de cuenta corriente: saldos separados por moneda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 19                | API: un DELETE no existe; anular revierte y deja rastro                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 23, 24            | Unit de los PDFs: totales iguales a la cuenta corriente; leyenda presente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 25                | Unit de migración: saldo inicial por moneda igual al importado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 33, 34            | Unit de estados de firma: transiciones válidas, registro de cada cambio, aviso ajeno rechazado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 35                | Unit con un adaptador de prueba: el módulo funciona entero contra un proveedor simulado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 36                | Unit del tablero: contrato vigente sin documento firmado aparece en «a completar»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 38 – 44           | Unit de `plantilla-word`, `plantilla-modelo` y `plantillas.service` (validación, lista ↔ datos, sin PDF, consultas fijas); web: `plantillas-vista` y `generar-contrato`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 26 – 32           | Unit de los cálculos del tablero + test de que cada drill-down suma su tarjeta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 45 – 53           | Types y domain: `boletas.test.ts`; API: `impuestos.service.spec.ts` (recupero, adelantado con cobro parcial y anulada, consultas fijas); web: `impuestos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 60 – 66           | Unit de `reclamos.service` (`regla 6x` en el nombre: vendedor y team leader rechazados, fila vieja que se vuelve a guardar, proveedor ajeno, notas); web: `reclamos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 67 – 73           | Types: `reclamos.test.ts`; API: `reclamos.service.spec.ts`, `proveedores.service.spec.ts`, `envios.service.spec.ts`, `tablero-alquileres.service.spec.ts`; base: `aislamiento.e2e-spec.ts` (regla 70); web: `reclamos.test.tsx`, `proveedores-vista.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 74 – 82           | Domain: `cierreDelMes`; web: `periodo-tablero.test.ts` (74), `tablero-alquileres.test.tsx` (`regla 7x` en el nombre); API: `tablero-alquileres.service.spec.ts` (75 a 79 y 82: cada flujo de un mes, un trimestre y el año, y cada foto, suman su tarjeta en los tres cortes; consultas con 5 y 25 contratos); base: `tablero-alquileres.e2e-spec.ts` (79, el SQL real, en el job de aislamiento de CI); roles: `alquileres.roles.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 83 – 97           | Domain: `informe-propietario.test.ts` (87, 88, 84: la cadena con cobro parcial, parte ya liquidada, pago garantizado, gastos por caja; el nombre del período); types: `RANGO_*` en `InformePeriodoQuerySchema`; API: `informe-propietario.service.spec.ts` (`regla 8x`/`9x` en el nombre: la cadena al centavo, solo lo suyo, ARS/USD, deuda, mes a mes, nombres y sumas de cada descuento, reclamos sin notas y con importe solo a cargo del propietario, liquidaciones que suman lo liquidado, vacío, 404, la fila igual al informe, consultas con 5 y 25 contratos), `informe-propietario.template.spec.tsx` (95 y 94: texto del PDF y solo Montserrat), `envios.service.spec.ts` (95), `alquileres.roles.spec.ts` (83); base: `informe-propietario.e2e-spec.ts` (85 a 93 y 96, el SQL real, en el job de aislamiento de CI); web: `periodo-tablero.test.ts` (84), `cuenta-corriente.test.tsx` (83), `informe-propietario.test.tsx` (84 a 96), `alquileres-nav.test.tsx` (83) |
| §3 (roles)        | API: 403 para `vendedor`, `team_leader`, `publicador`; 200 para `administracion`, `direccion`, `admin_tenant`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Aislamiento       | Cada tabla nueva en `isolation.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Licencia          | API: 403 en una inmobiliaria sin el módulo, aun con rol `direccion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
