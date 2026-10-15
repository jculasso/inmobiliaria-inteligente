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

    **Desde el 15/10/2026 vale solo cuando el índice ya salió** y falta que
    alguien confirme la indexación. Si el tramo **espera su índice** (el ICL
    o el IPC no se publicó, o es Casa Propia), la parte se genera como
    **liquidación parcial** con el importe del tramo anterior (regla 130).

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
    Vacker). Si cae sábado o domingo, se corre al lunes. ~~Los feriados
    **no** se corren, igual que en Gexion (el 12/10/2026, feriado, queda
    igual). Decidido por Javier el 5/10/2026: se mantiene el criterio de
    Gexion.~~ **Reemplazada por la regla 100** (Florencia, Vacker,
    15/10/2026): un feriado también se corre al siguiente día hábil.

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
    (seis desde el 15/10/2026: las cuatro que se calculan en la base van en
    una sola sentencia, regla 175; más las de la bandeja de indexación y las
    liquidaciones pendientes), y la lista de un número, dos como mucho.

### Dashboard: lo que viaja (15/10/2026)

Medido con una cartera del tamaño de la de Vacker (120 contratos, dos años de
historia): el Dashboard pesaba 1,3 MB y tardaba unos 4 segundos con la
distancia entre la API y la base.

175. **Cada fila viaja una vez.** Los tres cortes —todos, particulares y
     comerciales— siguen llegando juntos (cambiar de filtro no pide nada),
     pero en la forma compacta: las filas van una sola vez, sin los campos
     vacíos, y cada número lleva las posiciones de las suyas. La pantalla
     ve exactamente lo mismo: cada número con su lista, en el mismo orden,
     y la lista suma el número (reglas 26 y 79). La web la pide con
     `?formato=compacto`; sin eso, la API responde la forma de siempre, y
     la web acepta las dos (se despliegan en cualquier orden). Las cuatro
     lecturas que se calculan en la base —alquileres, deuda a cada cierre,
     ingresos por mes y liquidaciones finales pendientes— van en una sola
     sentencia: un viaje en vez de cuatro, y la misma foto de la base para
     las cuatro.

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
      liquidar** (lo que va a su favor en la próxima) − **A descontar en la
      próxima liquidación** (regla 98).

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
    línea dice «Descontado en la liquidación N del dd/mm» o «Se descontará
    en la próxima liquidación» (`estadoDePartida`), y cada grupo suma su
    renglón de la cadena.
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
98. **Lo que falta liquidar nunca se muestra negativo** (decidido el
    7/10/2026 por delegación de Javier, probando el informe de Marcela Ibarra
    en Alteva: el alquiler de octubre ya liquidado y después el gasto del
    reclamo 2, a cargo del propietario, sin descontar, daban «Pendiente de
    liquidar −$ 15.000»). Por moneda: **Pendiente de liquidar** =
    máx(0, neto − liquidado) y **A descontar en la próxima liquidación** =
    máx(0, liquidado − neto); la cadena sigue cerrando al centavo: neto =
    liquidado + pendiente − a descontar. «A descontar…» es un renglón propio,
    solo si hay algo, y dice qué es —«Arreglo: Plomería Juan (Cambio de
    canilla · reclamo 2)», «Impuesto: TGI (Tasa municipal) cuota 9/12»—: los
    descuentos del período que todavía no entraron en una liquidación
    (`queSeDescuentaEnLaProxima`). Lo mismo en la pantalla, en el PDF
    (`renglonesDeLaCadena`, una sola lista) y en la tabla de propietarios,
    donde va debajo del pendiente, en la misma celda y en la tarjeta, sin
    sumar columnas. Los totales suman lo pendiente y lo a descontar de cada
    propietario por separado.

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
   la cadena cierra: cobrado − descuentos = liquidado + pendiente − a
   descontar.
3. Carga en Impuestos y servicios, para esa propiedad, una boleta de
   «Expensas extraordinarias» a cargo del propietario que paga la
   inmobiliaria: al volver al informe aparece en Descuentos › Expensas con
   ese nombre y «Se descontará en la próxima liquidación», y baja el
   pendiente; si su alquiler ya estaba liquidado, el pendiente queda en $ 0 y
   aparece «A descontar en la próxima liquidación $ X» diciendo qué es.
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

### Entrega A para Vacker: arrancar con contratos reales (15/10/2026)

> Decidido por Florencia (Vacker) el 15/10/2026, antes de que ella y Martín
> carguen tres contratos reales —probablemente ya en curso— y simulen el mes
> entero. Las cinco decisiones son finales.

**Para quién y para qué.** Para quien administra los alquileres de una
inmobiliaria que empieza a usar el módulo con contratos que ya existen: que
cada contrato nuevo arranque con los valores de la casa, que los vencimientos
respeten los feriados, que el sellado salga según el tipo de contrato, poder
tomar un contrato a mitad de camino sin inventar deuda, y corregir un importe
que las partes renegociaron.

**Roles.** Los de §3, sin cambios: todo lo de esta sección es de
`ROLES_ADMINISTRACION_ALQUILERES` (`administracion`, `direccion`,
`admin_tenant`); `vendedor`, `team_leader` y `publicador` reciben 403, y
`admin_plataforma` no ve datos. La configuración la edita cualquiera de esos
tres roles, como hasta hoy.

#### Lo que se propone en cada contrato nuevo

99. Cada inmobiliaria configura en **Alquileres › Configuración › Contratos
    nuevos** el **punitorio diario**, los **honorarios**, los **gastos
    administrativos** y los días de **vencimiento del inquilino** y de **pago
    al propietario**. El alta de un contrato los trae precargados y cada
    contrato los puede cambiar; los contratos ya cargados no cambian. Una
    inmobiliaria que no los configuró ve lo mismo que antes del 15/10/2026
    (honorarios 8%, gastos 2%, sin punitorio, días 5 y 10): no se cargan los
    valores de Vacker como valores de todos. Los de Vacker —punitorio 0,3%
    diario, honorarios 8% + IVA, gastos 2% + IVA, días 5 y 10— se cargan en su
    configuración. Una configuración guardada antes, sin estos campos, se
    sigue leyendo.

#### Vencimientos y feriados

100. **Reemplaza a la regla 37.** El vencimiento del inquilino y el pago al
     propietario que caen **sábado, domingo o feriado nacional** se corren al
     **siguiente día hábil**; varios días no hábiles seguidos se saltean
     juntos (el lunes 7 y el martes 8/12/2026 llevan un vencimiento del 5 al
     miércoles 9). El 12/10/2026 pasa al 13. Cuentan como feriados los que
     publica la fuente, puentes turísticos incluidos: ese día los bancos no
     abren. La función sigue siendo pura (`vencimientoDelMes` recibe los
     feriados); los conceptos ya generados no cambian.
101. Los feriados viven en una tabla **global** (`feriado`, como
     `indice_valor`: sin `tenant_id`, solo lectura para la API). Los escribe
     la misma **tarea diaria** que trae el ICL y el IPC (`/tareas/indices`):
     el año en curso y el siguiente, desde
     `api.argentinadatos.com/v1/feriados/{año}`. Cada año se sincroniza
     entero cuando la fuente responde (entra un puente nuevo, sale un
     trasladable que se movió); una respuesta vacía no borra nada. Si la
     fuente no responde, **nunca se frena la generación**: se usa lo que ya
     está cargado y queda en el log. Es un **error** del workflow —falla y
     llega el mail— solo si un año quedó sin un solo feriado; si los dos ya
     estaban, es un **aviso**. La migración siembra 2026 y 2027.
102. El punitorio corre **desde el día siguiente al vencimiento** (Florencia):
     pagar el día del vencimiento son 0 días; el día siguiente, 1. Con un
     vencimiento corrido por feriado, se cuenta desde el día hábil. Es lo que
     ya hacía `proponerPunitorio` (regla 16); la regla queda escrita y con su
     test.

#### Sellado

103. El sellado de los cargos de ingreso sale del **tipo de contrato**: un
     particular está **exento** (0%); un comercial paga **1%**, o **0,25%** si
     el inquilino tiene **certificado MiPyme**, sobre el valor total del
     contrato. Por defecto lo paga **el inquilino entero** (100%). Las tres
     alícuotas y la parte del inquilino se configuran por inmobiliaria. El
     contrato tiene la marca «Inquilino con certificado MiPyme», que solo
     cuenta en un comercial. Una configuración guardada antes, con la
     alícuota única de entonces (`selladoPct`): si era mayor que cero, fue una
     decisión de esa inmobiliaria y se conserva para los tres casos, con su
     reparto; si era cero —el valor por defecto, «no se calcula»—, rigen las
     alícuotas de esta regla y el inquilino paga el 100%. Al guardar la
     configuración, la alícuota vieja se borra.

#### Un contrato tomado en curso

104. Un contrato puede empezar a administrarse **después de su inicio**:
     «Este contrato ya está en curso», con **Administrado desde** (después del
     inicio, no después del fin). La generación del mes crea conceptos **solo
     desde esa fecha**; si cae a mitad de mes, ese mes se prorratea desde ese
     día, como el primer mes de cualquier contrato (regla 13). Vacío:
     administrado desde el inicio, como todos los contratos anteriores.
105. **Sin deuda de antes** (Florencia: «lo ideal es que arranque sin
     deuda»): no se genera nada anterior a «administrado desde» y no hay
     saldo inicial. Sus **cargos de ingreso no se proponen**: se pagaron cuando
     empezó, con otra administración. Si hace falta cobrar algo, es un gasto
     suelto (regla 14).
106. Del contrato en curso se carga el **alquiler vigente hoy**: el importe del
     tramo que corre en «administrado desde». Los tramos anteriores pueden
     quedar sin importe y son **historia**: no van a la bandeja «a indexar»,
     no se pueden confirmar y no son la «próxima indexación», que es el
     primer tramo sin importe **después** del vigente. La indexación
     siguiente parte del alquiler vigente (regla 5). Un tramo sin importe
     seguido de uno con importe es siempre historia (`esTramoAnterior`).
107. El Dashboard sigue contando los **contratos nuevos por su inicio**, no
     por «administrado desde»: mide cuándo se firmó, no cuándo lo tomó la
     inmobiliaria. Si el primer tramo no tiene importe, no suma importe.

#### Los vencimientos del primer mes

112. **El primer mes no nace vencido** (encontrado probando en Alteva el
     15/10/2026: un contrato administrado desde el 15/10 con vencimiento el 5
     generaba octubre vencido el 5/10 y el pago al propietario el 13/10). Los
     vencimientos de un período nunca son anteriores al día en que el
     contrato empieza a generar en ese período —«administrado desde», o el
     inicio de un contrato que arranca a mitad de mes, como el 20—: si el
     vencimiento calculado es anterior, vence ese día, corrido al siguiente
     día hábil como cualquier vencimiento (regla 100). Y al propietario nunca
     se le paga antes del vencimiento del inquilino de ese período. Los meses
     siguientes no cambian (`vencimientosDelPeriodo`).

#### Corregir el importe de un tramo ya confirmado

108. En la ficha del contrato **vigente**, cada tramo con importe tiene
     **«Corregir importe»** (Florencia: «luego de una indexación de un
     cuatrimestre las partes negocian por menos»). Pide el **importe nuevo**,
     **desde qué mes** rige —un mes del tramo; se propone el primero sin nada
     cobrado ni liquidado— y un **motivo** obligatorio. Un tramo todavía sin
     importe no se corrige: se confirma desde «A indexar».
109. Los meses del tramo desde el elegido cuyo alquiler, gastos,
     honorarios e IVA **no tienen nada cobrado ni liquidado** se **anulan con
     el motivo** (regla 19, nunca se borran) y **se vuelven a generar** con el
     importe nuevo, con la misma generación de siempre y la misma clave. Los
     meses con algo **cobrado o liquidado** —basta un concepto— y los
     **anulados a mano** quedan como están, y la pantalla lo dice antes de
     confirmar. Los meses todavía **sin generar** no se crean: salen con el
     importe nuevo cuando se generen. En un mes con cambio de tramo se toca
     solo la parte del tramo corregido.
110. El **tramo guarda el importe nuevo** y el historial del contrato
     registra el importe anterior y el nuevo, desde qué mes, el motivo, quién
     y qué meses se regeneraron o quedaron. Las **indexaciones siguientes**
     parten del importe corregido (regla 5).
111. Corregir hace **las mismas consultas** sea un mes o doce, y genera el
     mes con las mismas consultas sean 5 o 25 contratos (ahora también los
     feriados, una sola vez).

**Casos borde.**

- **La fila vieja**: los contratos anteriores tienen «administrado desde»
  vacío y «MiPyme» en no: siguen generando igual. Una configuración sin los
  campos nuevos se lee con los valores de antes (reglas 99 y 103).
- **La tabla de feriados vacía** (la migración no se aplicó todavía, o la
  fuente falló dos años seguidos): los vencimientos se corren solo por fin de
  semana, como antes, y el workflow avisa.
- **Un mes anterior a «desde» que todavía no se generó**, en una corrección:
  se genera con el importe nuevo, porque el tramo guarda uno solo. Al
  corregir desde el primer mes sin cobrar —lo que se propone— no pasa.
- **Todos los meses del tramo cobrados**: corregir no regenera nada; solo
  cambia la base de las indexaciones siguientes, y la pantalla lo avisa.
- **Dos personas a la vez**: si alguien cobra un mes o cambia el tramo
  mientras se corrige, no se anula ni se guarda nada (409).
- **La inmobiliaria sin el módulo**: 403, como el resto (§3).

**Fuera de alcance de esta entrega:**

- **Saldo inicial** de un contrato tomado en curso, y la **migración desde
  Gexion**: «administrado desde» es su base, pero importar contratos y
  saldos es otra entrega.
- **Feriados provinciales o municipales**: solo los nacionales.
- **Mover vencimientos ya generados** cuando se carga un feriado nuevo.
- Corregir un importe **por un solo mes** sin cambiar el tramo, y corregir
  meses ya cobrados (se anulan antes los cobros).
- Editar la marca MiPyme de un contrato ya vigente.
- No hay tablas nuevas por inmobiliaria: `feriado` es global; el resto son
  dos columnas de `alq_contrato` y campos de la configuración.

**Criterio de aceptación (en Alteva):**

1. Javier entra a Alteva con su usuario de dirección, va a **Configuración**,
   pone en «Contratos nuevos» punitorio 0,3, honorarios 8, gastos 2, días 5
   y 10, y guarda. En **Contratos › Nuevo**, Condiciones ya trae esos valores.
2. En «Sellado» ve particular 0, comercial 1 y comercial MiPyme 0,25, con el
   inquilino al 100%. Carga un contrato **comercial** nuevo con «Inquilino con
   certificado MiPyme», lo activa: los cargos de ingreso proponen el sellado
   al 0,25% del valor total, a cargo del inquilino, y la cabecera dice
   «sellado 0,25%». Uno particular no propone sellado.
3. Carga un contrato con **«Este contrato ya está en curso»**: inicio
   01/03/2025, ICL cada 4 meses, administrado desde el 10/10/2026, alquiler
   vigente $ 900.000. En Tramos solo pide el importe del tramo que corre el
   10/10/2026; los anteriores dicen «Opcional». Lo activa: la ficha dice
   «Administrado desde 10/10/2026 (tomado en curso)», los tramos de antes
   dicen «Antes de administrarlo», no aparecen en «A indexar» y no se
   proponen cargos de ingreso.
4. Genera **octubre de 2026** en Conceptos: ese contrato trae el alquiler del
   10 al 31 (22/31 días) y nada de los meses anteriores; el inquilino no debe
   nada de antes en su cuenta corriente.
5. Genera **diciembre de 2026**: el alquiler que vence el día 5 (sábado)
   vence el **miércoles 9**, porque el lunes 7 y el martes 8 son feriados; el
   pago al propietario del día 10 (jueves) queda el 10. Lo ya generado de
   octubre no cambia.
6. En un contrato con el tramo vigente confirmado, **«Corregir importe»**:
   el diálogo propone el primer mes sin cobrar, lista los meses cobrados
   como «queda como está» y pide el motivo. Corrige a un importe menor: en
   Conceptos, los meses sin cobrar de ese tramo aparecen anulados con el
   motivo y generados de nuevo con el importe nuevo (gastos y honorarios
   recalculados); el historial del contrato dice el importe anterior, el
   nuevo, quién y por qué. La próxima indexación de la bandeja parte del
   importe corregido.
7. En la Inmobiliaria de Demo, sin el módulo, un usuario `direccion` no ve
   Alquileres y la API de corrección responde 403.

**Cada regla con su test (99 a 112):**

| Regla     | Test                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 99        | Types: `alquileres-entrega-a.test.ts` (sin configurar = lo de antes; la respuesta vieja se lee); API: `alquileres.service.spec.ts` (se lee y se guarda); web: `contrato-form.test.tsx` y `configuracion-form.test.tsx` (`regla 99` en el nombre)                                                                                                             |
| 100       | Domain: `alquileres.test.ts` (`regla 100`: el 12/10/2026 pasa al 13, feriados seguidos, la generación corre inquilino y propietario; reemplaza a «un feriado no se corre»); API: `conceptos.service.spec.ts`                                                                                                                                                 |
| 101       | API: `indices.service.spec.ts` (`importarFeriados`: carga, trasladable movido, respuesta vacía, aviso y error), `tareas.controller.spec.ts`; base: `rls-habilitada.e2e-spec.ts` (`feriado` global y de solo lectura)                                                                                                                                         |
| 102       | Domain: `alquileres.test.ts` (`regla 102`: 0 días el día del vencimiento, 1 el siguiente, y con feriado)                                                                                                                                                                                                                                                     |
| 103       | Types: `alquileres-entrega-a.test.ts` (alícuotas, traducción de `selladoPct`); API: `contrato-completo.service.spec.ts`; web: `configuracion-form.test.tsx`, `contrato-completo.test.tsx`, `contrato-form.test.tsx`                                                                                                                                          |
| 104       | Domain: `alquileres.test.ts` (`regla 104`); API: `conceptos.service.spec.ts`, `contratos.service.spec.ts`; types y web: `contrato-form.test.tsx`                                                                                                                                                                                                             |
| 105       | API: `contrato-completo.service.spec.ts`; web: `contrato-completo.test.tsx`                                                                                                                                                                                                                                                                                  |
| 106       | Domain: `alquileres.test.ts`; types: `alquileres-entrega-a.test.ts`; API: `indexaciones.service.spec.ts`, `contratos.service.spec.ts`; web: `contrato-ficha.test.tsx`, `contrato-form.test.tsx`                                                                                                                                                              |
| 107       | API: `tablero-alquileres.service.spec.ts` (`regla 107`)                                                                                                                                                                                                                                                                                                      |
| 108 – 110 | Domain: `alquileres.test.ts` (estados, mes propuesto, plan); API: `correccion-tramo.service.spec.ts` (`regla 10x` en el nombre: anula y regenera, lo cobrado queda, sin generar no se crea, mes con cambio de tramo, el tramo y el historial, la indexación siguiente, lo que se rechaza); roles: `alquileres.roles.spec.ts`; web: `contrato-ficha.test.tsx` |
| 111       | API: `correccion-tramo.service.spec.ts` (1 mes y 3 meses), `conceptos.service.spec.ts` (5 y 25 contratos)                                                                                                                                                                                                                                                    |
| 112       | Domain: `alquileres.test.ts` (`regla 112`: tomado en curso el 15/10, contrato que empieza el 20, arranque en feriado, meses siguientes y pago al propietario); API: `conceptos.service.spec.ts` (`regla 104`, el vencimiento del primer mes)                                                                                                                 |

### Liquidación parcial y final cuando el índice sale atrasado (15/10/2026)

Pedido de Florencia (Vacker), 15/10/2026: «IPC sale atrasado, podemos hacer
una liquidación provisoria ya que se espera el índice, entonces el inquilino
recibe una liquidación provisoria, paga ese importe similar a la del mes
pasado, y luego cuando sale el índice se hace la liquidación definitiva y el
inquilino paga el saldo, y lo mismo pasa con el propietario, se liquida
provisorio y luego el complemento; en Gexion le lleva mucho trabajo ya que
todo lo hace manual por WhatsApp». Javier confirmó: «va en recibo en el mismo
mes como una liquidación final, la anterior es la liquidación parcial ya que
no tenemos el IPC publicado». Lo usan los mismos roles que el resto del
módulo (§3); no cambia quién ve ni quién puede.

130. **Liquidación parcial.** Al generar un mes, la parte de un tramo que no
     tiene importe, se encadena sobre uno que sí (regla 5) y cuyo importe el
     sistema todavía **no puede saber** —el ICL o el IPC que necesita no se
     publicó (regla 7), o el índice no tiene fuente y se carga a mano (Casa
     Propia)— se genera con el **importe del tramo anterior**, prorrateado
     como cualquier parte (regla 13), con los mismos conceptos que un mes
     normal (alquiler, gastos administrativos e IVA al inquilino; alquiler y
     honorarios a cada dueño). Cada concepto queda marcado `parcial`, con el
     número de su tramo (`alq_concepto.etapa` y `tramo_numero`), y lo dice:
     «Alquiler octubre 2026 — liquidación parcial (espera el IPC de
     septiembre de 2026)». Las claves son las de un mes normal: generar de
     nuevo no duplica (regla 10). El resultado de «Generar» nombra cada
     contrato que salió como parcial y qué espera. Un tramo cuyo índice **ya
     salió** y falta confirmar sigue la regla 11: no se genera.
131. **Liquidación final.** Confirmar la indexación —con el importe que
     calcula la API o con el que se carga a mano para Casa Propia— genera,
     en la misma transacción, la **diferencia** de cada concepto de cada mes
     que se cobró como parcial en ese tramo, **en el mismo período**,
     marcada `final`: «Alquiler octubre 2026 — liquidación final (diferencia
     por IPC)». La parcial **no se toca** (puede estar cobrada y liquidada).
     Si el importe definitivo es igual al anterior, no se genera nada. Los
     meses que se generan después de confirmar salen normales, con el importe
     nuevo. El historial del contrato dice qué meses y cuánto.
132. **Parcial + final = definitivo, al centavo**, concepto por concepto:
     alquiler, gastos e IVA del inquilino; alquiler y honorarios de cada
     dueño, también con dos dueños al 50% y con la parte prorrateada de un mes
     partido. La final es lo que da el mes generado con el importe definitivo
     menos la parcial (y menos las finales anteriores, regla 135): se resta lo
     mismo que se calculó, en centavos enteros.
133. **Vencimiento de la diferencia**: la fecha de confirmación más los
     «Días para pagar la diferencia de la liquidación final» de la
     configuración del módulo (5 por defecto), corrida al siguiente día
     hábil —sábado, domingo o feriado nacional— con la misma función que los
     vencimientos del mes (`diaHabilDesde`, regla 100). Antes de ese día la
     diferencia **no tiene punitorio**: el punitorio cuenta desde el
     vencimiento de cada concepto (reglas 16 y 102).
134. **Diferencia negativa** (un importe acordado menor que el anterior): el
     espejo, como un reintegro de la regla 14, con tipo `otro`: **a favor del
     inquilino** (se compensa en su próximo cobro, regla 15) y **a devolver
     por el dueño** (se le descuenta en la próxima liquidación, regla 20); lo
     mismo con los gastos y los honorarios, que se le devuelven al inquilino
     y al dueño. «… — liquidación final (diferencia por IPC, a su favor)» /
     «…, a devolver». En el Dashboard, el reintegro del alquiler le resta a lo
     emitido y los de gastos y honorarios restan de los ingresos del mes en
     que se compensan o se liquidan.
135. Una parcial **anulada** no recibe final: la anulación es una decisión.
     Si el importe de un tramo ya confirmado **se corrige** después (regla
     108), los meses que se vuelven a generar salen normales —su parcial y su
     final se anulan con la corrección (regla 109)—, y los que quedan como
     estaban (algo cobrado o liquidado) y se habían cobrado como parcial
     reciben **otra final** (`…~final2`) con la diferencia contra la parcial
     y las finales anteriores, desde el mes elegido; ninguna pisa a otra.
136. **Al propietario**: la parcial se liquida como cualquier alquiler (reglas
     21 y 22). La final es una **parte propia del mes**: su alquiler y sus
     honorarios se liberan cuando el inquilino paga la diferencia, en la
     misma proporción (regla 22: pago parcial → lo mismo que pagó el
     inquilino, menos los honorarios proporcionales). Con pago garantizado,
     entra entera (regla 21).
137. **Vista previa**: en «A indexar», confirmar un tramo con meses cobrados
     como parcial primero muestra «Se van a generar las diferencias de
     octubre de 2026: inquilino $ X, propietario $ Y. Vencen el 20/10/2026.»,
     con «Confirmar y generar las diferencias» y «Volver». Lo calcula la API
     con la misma cuenta que la confirmación
     (`GET /alquileres/indexaciones/:tramoId/diferencias?importe=`, mismos
     roles y licencia); «Volver» no confirma nada. Sin parciales, se confirma
     directo, como siempre.
138. **Recibo**: la línea de una final dice «Liquidación final de octubre de
     2026 · completa la liquidación parcial de $ X, pagada en el recibo N°
     000045» (o «pagada en este recibo», o «todavía sin pagar»), solo con
     Montserrat.
139. **Dashboard** (corrige el bug visto en ALT-0005, que esperaba el IPC de
     septiembre y figuraba como vencida):
     - Un tramo que ya empezó y **espera el índice** va en su propia tarea,
       «Indexaciones que esperan el índice», y no en vencidas ni en próximas
       (regla 7); en las listas de contratos, su próxima indexación dice
       «espera el índice», no «vencida».
     - La final se **suma a su parcial** en la cobranza: un alquiler emitido,
       con el importe definitivo; cobrado, lo pagado de las dos.
     - «**Liquidaciones finales pendientes de cobro**»: una fila por
       inquilino, contrato y mes, con lo que falta de la diferencia (alquiler,
       gastos e IVA) y cuándo vence; lleva a cobrar.
     - El tablero hace **ocho** consultas, siempre las mismas (regla 82: la
       octava es esta tarea).
140. **Se ve en todos lados**: en Conceptos, una insignia «Liquidación
     parcial» o «Liquidación final» junto a la descripción; en la cuenta
     corriente, el cobro, la liquidación (pantalla y PDF) y el recibo, la
     descripción de la regla 130 o 131; en el informe al propietario, cada
     mes dice «Liquidación parcial (espera el IPC de septiembre de 2026)» o
     «Liquidación parcial y final (diferencia por IPC)», en la pantalla y en
     el PDF.

**Fuera de alcance:**

- **Generar la parcial cuando el índice ya salió** y nadie confirmó: sigue
  la regla 11 (se confirma primero; el importe ya se sabe).
- **Avisarle al inquilino** por WhatsApp o mail: el recibo y la liquidación
  se mandan como siempre, a mano.
- Una parcial para el **segundo tramo seguido** sin importe: el primero
  tiene que estar confirmado (regla 5).
- Migrar a parcial los meses ya generados sin la parte (antes de esta
  regla): basta con generar el mes de nuevo.

**Criterio de aceptación (en Alteva):**

1. Javier entra a Alteva con su usuario de dirección. En **Configuración**
   ve «Días para pagar la diferencia de la liquidación final» en 5.
2. **Conceptos › octubre 2026 › «Generar octubre»**: el aviso dice «Como
   liquidación parcial, con el importe del tramo anterior: ALT-0006 (espera
   el valor de Casa Propia)» —y ALT-0005 (espera el IPC de septiembre de
   2026), si el IPC todavía no está cargado—. Las líneas de ALT-0006 llevan
   la insignia «Liquidación parcial» y el alquiler es $ 557.300,00.
3. **Dashboard › Lo que hay que hacer**: si ALT-0005 espera el IPC, está en
   «Indexaciones que esperan el índice» y **no** en «Indexaciones vencidas»;
   en «Contratos vigentes», su próxima indexación dice «espera el índice».
4. **Cobros**: cobra la parcial a Martín Acosta. El recibo dice «Alquiler
   octubre 2026 — liquidación parcial (espera el valor de Casa Propia)».
5. **A indexar**: en ALT-0006 carga 600.000 y aprieta «Confirmar». Antes de
   confirmar ve «Se van a generar las diferencias de octubre de 2026:
   inquilino $ …, propietario $ …. Vencen el …» (hoy + 5 días, corrido al
   lunes). Con «Confirmar y generar las diferencias», Conceptos de octubre
   muestra las líneas «Liquidación final», el alquiler en $ 42.700,00, y la
   parcial sigue igual.
6. **Dashboard**: «Liquidaciones finales pendientes de cobro» lista ALT-0006,
   octubre, con lo que falta; en «Alquileres emitidos» de octubre, ALT-0006
   cuenta una vez, con $ 600.000,00.
7. Cobra la diferencia: el PDF del recibo dice «Liquidación final de octubre
   de 2026 · completa la liquidación parcial de $ 557.300,00, pagada en el
   recibo N° …». La tarea del Dashboard se vacía.
8. **Liquidaciones › Liliana Sosa**: la parcial ya liquidada no vuelve; la
   final entra recién después del paso 7, con sus honorarios. En su
   **Informe** de octubre, el mes dice «Liquidación parcial y final
   (diferencia por Casa Propia)» y la cadena cierra.
9. (Diferencia negativa, regla 134, en otro contrato de prueba o cargando
   menos de 557.300 en el paso 5): Martín Acosta queda con un reintegro «a
   su favor» que el próximo cobro compensa, y a Liliana Sosa se le descuenta
   «a devolver» en la próxima liquidación.

### Inventario del contrato y reserva (entrega C, 15/10/2026)

Pedido de Florencia (Vacker), 15/10/2026: «Me van a mandar un Word con el
contrato y quieren que en el módulo se carguen por ej.: Propietario,
Inquilino, Garantes, Inventario, Valor del alquiler, Ajustes, Fechas de
Vigencia, Depósito en garantía en pesos o en dólares, y que en base a la
plantilla se genere automáticamente el contrato … lo mismo me van a enviar un
Word con el formulario de reserva, se cargan los datos y queda la reserva
registrada en el sistema, y relacionada con la propiedad y luego sigue el
contrato. Una vez reservada la propiedad se hace el estudio de garantías y si
todo está OK sigue el contrato.»

Y sus respuestas sobre la seña y el inventario, el mismo día (finales): «Se
pide un mes de seña, que coincide con el depósito»; «la seña la guarda la
inmobiliaria»; «al interesado se le da un recibo por la seña»; «si la reserva
vence, el inquilino no se presenta a firmar o no logra presentar garantías
adecuadas, la seña se retiene y se le entrega al propietario»; «la reserva se
cierra a mano»; y «el inventario: lo mejor es que sea un apéndice del
contrato».

Los Word de Vacker **todavía no llegaron**. Lo que se construye es el
mecanismo general —los datos, los estados y los marcadores—; cuando lleguen,
solo se ubican los marcadores en sus Word. Lo ven y lo operan los mismos
roles que el resto del módulo (§3): `ROLES_ADMINISTRACION_ALQUILERES`, con
`@Modulo('alquileres')`.

**Para quién y para qué.** Para quien administra los alquileres: registrar
la reserva de una propiedad y cobrar su seña con recibo, hacer el estudio de
garantías ahí mismo, y que el contrato salga de la reserva aprobada sin volver
a cargar nada —con la seña como depósito—; si la reserva se cae, que la seña
le llegue al propietario en su liquidación; y que el inventario de lo que se
entrega con la propiedad quede en el contrato y en su anexo.

**Matriz de roles.** Igual que §3, sin cambios: `administracion`,
`direccion` y `admin_tenant` ven y hacen todo; `vendedor`, `team_leader` y
`publicador` reciben 403 en toda la API de reservas e inventario y no ven la
pestaña; `admin_plataforma` no ve datos. Una inmobiliaria sin el módulo
recibe 403 aunque el usuario sea `direccion`.

#### Inventario del contrato

150. **Qué es.** El inventario de un contrato es una lista de ítems
     —descripción (obligatoria, hasta 200 caracteres), cantidad (entera, de
     1 a 9.999; 1 si no se indica) y estado u observación (opcional, hasta
     200)— de hasta 200 ítems, más observaciones generales (hasta 4.000
     caracteres). Se guarda **entero**: la lista que se manda reemplaza a la
     anterior. Un ítem sin descripción se rechaza con «Cada ítem del
     inventario lleva su descripción.».
151. **Cuándo se edita.** En **borrador y en vigente** (no toca plata,
     como los datos de la regla 33 del 6/10). En finalizado, rescindido o
     anulado la API responde 400 «El contrato está <estado>: el inventario ya
     no se edita.», y la ficha lo muestra sin el botón. Cada guardado queda
     en el historial del contrato: «Inventario: N ítems».
152. **En la plantilla.** `{#inventario}…{/inventario}` se repite una vez
     por ítem, con `{numero}`, `{descripcion}`, `{cantidad}` y `{estado}`;
     `{^inventario}…{/inventario}` aparece solo si no hay ítems;
     `{#con_inventario}…{/con_inventario}` aparece una sola vez si hay
     ítems (para la frase que presenta la lista: adentro de
     `{#inventario}` se repetiría por ítem);
     `{contrato.inventario_observaciones}` pone las observaciones (vacío si
     no hay). Están en `MARCADORES_PLANTILLA` —así que se validan al subir el
     Word, como los demás (regla 40)— y el Word de ejemplo trae una cláusula
     de inventario armada con ellos.
153. **La fila vieja.** Un contrato cargado antes de esta entrega se lee con
     el inventario vacío y sin observaciones: la migración agrega las
     columnas con su valor por defecto y no toca ninguna fila.

#### Reserva

154. **Qué tiene.** Una reserva lleva un **número correlativo por
     inmobiliaria** (Reserva 1, 2…), la **propiedad**, al menos un
     **interesado** (el futuro inquilino; se lo puede dar de alta en el
     momento, sin salir del formulario), los **propietarios** si se conocen
     y los **garantes propuestos** (personas del módulo, con el mismo papel
     que en un contrato), la **fecha de reserva** y su **vencimiento** (no
     anterior a la fecha), la **seña acordada** (importe y moneda ARS o USD;
     cobrarla es otro paso, regla 169), las **condiciones propuestas**
     (particular o comercial, moneda del alquiler, alquiler inicial, inicio,
     duración en meses, ajuste —índice y cada cuántos meses, o escalonado—,
     depósito y su moneda) y observaciones. Las condiciones son una
     propuesta: pueden quedar sin cargar. Un vencimiento anterior a la fecha
     se rechaza con «El vencimiento no puede ser anterior a la fecha de la
     reserva.»; sin interesado, con «Falta el interesado (el futuro
     inquilino).».
155. **Los estados y sus pasos**, y ningún otro:
     - `reservada` → `en_estudio` (empieza el estudio de garantías),
       `vencida` o `anulada`;
     - `en_estudio` → `aprobada`, `rechazada`, `vencida` o `anulada`;
     - `aprobada` → `convertida` (solo al guardar el contrato, regla 159),
       `no_se_presento` («No se presentó a firmar»), `vencida` o `anulada`.

     `convertida`, `rechazada`, `vencida`, `no_se_presento` y `anulada` son
     finales. Rechazar y anular piden **motivo** (al menos 3 caracteres);
     «No se presentó a firmar» admite una observación. Un paso que no está
     en la lista responde 400 «Una reserva <estado> no pasa a <estado>.».
     Cada paso queda en el historial (`alq_evento`, entidad `reserva`) con
     quién, cuándo y el motivo, y la ficha de la reserva lo muestra como
     línea de tiempo. **Nada se borra**: no hay DELETE de reservas.

156. **Una reserva abierta por propiedad.** Mientras una reserva está
     `reservada`, `en_estudio` o `aprobada`, la propiedad no admite otra: la
     segunda responde 409 «<propiedad> ya tiene abierta la reserva N.». Lo
     garantiza un índice único parcial en la base, no solo el código. Una
     propiedad con un contrato vigente **sí** se puede reservar (para cuando
     ese contrato termine). Una propiedad que tuvo reservas no se borra.
157. **El estudio de garantías** usa el mismo modelo e informe que las
     garantías del contrato (tipo, garante —una persona de la reserva o un
     nombre—, detalle, estado del informe `pendiente`/`aprobada`/`rechazada`,
     fecha de aprobación y observaciones), y se carga con la reserva
     `reservada` o `en_estudio`. **Aprobar** exige al menos una garantía
     aprobada y ninguna pendiente: si no, 400 «Para aprobar, cada garantía
     tiene que tener su informe: falta el de <garante>.» o «Para aprobar
     hace falta al menos una garantía aprobada.». Una garantía rechazada no
     impide aprobar si hay otra aprobada (se reemplazó un garante).
158. **Los datos** de la reserva se editan mientras está abierta
     (`reservada`, `en_estudio`, `aprobada`); en un estado final, 400 «La
     reserva está <estado>: ya no se edita.». Dar por **vencida** solo se
     puede cuando pasó el vencimiento; antes, 400 «La reserva vence el
     dd/mm/aaaa: todavía no venció. Si se cae antes, anulala con el
     motivo.».
159. **Convertir en contrato.** Solo una reserva `aprobada`. «Convertir en
     contrato» abre el alta de contrato **precargada** con la propiedad, los
     propietarios, los interesados como inquilinos, los garantes, el tipo,
     la moneda, el inicio, el fin (inicio + duración − 1 día), el ajuste con
     su índice y periodicidad, los tramos con el alquiler inicial en el
     primero, y el depósito con su moneda (sin depósito propuesto, el de la
     seña cobrada); lo que la reserva no dice, con los valores de la
     inmobiliaria (regla 99). Al guardar, **en una sola transacción**: se
     crea el contrato en borrador, la reserva pasa a `convertida` vinculada
     al contrato, la seña cobrada pasa a ser el depósito (regla 170) y las
     garantías **aprobadas** se copian al contrato. Las de la reserva quedan
     como estaban: son el registro del estudio, y editar las del contrato no
     las toca. Si la reserva ya no está aprobada, o el contrato es de otra
     propiedad, no se crea nada (409 / 400).
160. **El contrato que se borra.** Si se borra el contrato en borrador que
     salió de una reserva, la reserva vuelve a `aprobada`, sin contrato, y
     queda en su historial; la seña vuelve a ser de la reserva y el
     reintegro de lo que sobraba (regla 170) se deshace —si ya se usó en un
     cobro, el borrado se frena—. Se puede volver a convertir.
161. **La seña en el contrato.** La ficha del contrato que salió de una
     reserva muestra «Seña de la reserva N: $ X», con «recibida el
     dd/mm/aaaa (medio), recibo 000123» o «sin recibir», y el enlace a la
     reserva.
162. **Plantillas de reserva.** Cada plantilla es **de contrato, de reserva
     o de anexo de inventario** (regla 174). Las de reserva se validan
     contra su propia lista, `MARCADORES_RESERVA` (`@vacker/types`), con los
     mismos mensajes de la regla 40; un marcador de contrato que no existe
     en la reserva se rechaza. Las plantillas que ya existían son de
     contrato. Cada plantilla se usa solo para lo suyo: pedirla para otro
     documento responde 400 «Es una plantilla de <documento>: se usa desde
     …».
163. **«Descargar la reserva en Word»** desde una reserva que no esté
     anulada: `Reserva-<número>.docx`, con las mismas reglas que el
     contrato (regla 41: lo opcional vacío; una condición propuesta sin
     cargar dice «[a definir]»); la seña sale con su recibo
     (`{sena.recibo}`, `{sena.fecha}`, `{#sena_recibida}`). No se guarda;
     queda en el historial de la reserva. Se descarga un **Word de ejemplo
     de reserva** con cada marcador explicado y un formulario armado con
     ellos; subirlo tal cual funciona.
164. **La lista de reservas** (`/alquileres/reservas`, en la segunda fila de
     la pestaña Contratos: la barra sigue con once pestañas) abre en las
     **abiertas** y filtra por cada estado o todas; en la computadora es una
     tabla y en el teléfono tarjetas. Cada fila dice número, propiedad,
     interesado, vencimiento —«vencida hace N días» en rojo si pasó y sigue
     abierta—, seña y estado.
165. **La propiedad reservada.** La lista de propiedades marca «Reservada»
     (con el número, y abre la reserva) a las que tienen una reserva
     abierta.
166. **Dashboard, «Lo que hay que hacer»**: «Reservas que vencen en 7 días o
     ya vencidas» (abiertas con vencimiento hasta hoy + 7) y «Reservas
     aprobadas sin contrato». Siguen al filtro Particulares / Comerciales por
     el tipo de la reserva, y cada fila abre la reserva.
167. **Roles y licencia.** Todos los endpoints de reservas y de inventario
     llevan `@Modulo('alquileres')` y `ROLES_ADMINISTRACION_ALQUILERES`
     (`alquileres.roles.spec.ts` los recorre a todos).
168. **Consultas fijas.** Listar reservas, abrir una, convertirla y
     descargar su Word hacen **las mismas consultas** con 5 que con 25
     reservas, partes o garantías; el Dashboard suma una sola consulta.

#### La seña (respuestas de Florencia, 15/10/2026)

169. **El recibo de la seña.** «Cobrar la seña», en la ficha de una reserva
     abierta con seña acordada, da un **recibo de verdad** —el de Cobros: el
     número siguiente, el PDF y «Mandar por mail»— a nombre del interesado
     (el primero, o el que se elija entre los interesados), con la fecha y
     el medio. Por dentro, un concepto `sena` a cobrar del interesado, con
     su reserva, cancelado por ese recibo: está en su cuenta corriente y en
     su historial. Una vez por recibo vigente («La seña ya se cobró: recibo
     N.»); con el recibo hecho, el importe y la moneda de la seña ya no se
     cambian («…para cambiarla, anulá ese recibo en Cobros.»). Anular el
     recibo anula la seña cobrada y lo que nació con ella (el reintegro y la
     retención de las reglas 170 y 171), salvo que la retención ya se le
     haya liquidado al propietario: entonces primero la liquidación.
170. **La seña pasa a ser el depósito.** Al convertir, el concepto de la
     seña pasa al contrato y el depósito queda **cobrado en la fecha del
     recibo**: «Depósito en garantía» (estado, entregar al propietario o
     retener, devolver) funciona igual que con un depósito cobrado. La seña
     y el depósito tienen que ser de la misma moneda (si no, 400). Si el
     depósito es **mayor**, «Cargos de ingreso» propone solo la diferencia,
     y el depósito queda «a cobrar» hasta que se cobre; si es **menor** (o
     no hay depósito), lo que sobra se le reintegra al inquilino: un
     concepto a pagar, a su favor, que el próximo cobro compensa. La
     pantalla de conversión lo dice antes de guardar.
171. **La seña retenida va al propietario.** Si la reserva se cierra como
     `rechazada` (no logró presentar garantías adecuadas), `vencida` o
     `no_se_presento`, la seña cobrada se retiene: un concepto `sena` a
     pagar a cada propietario de la reserva, en partes iguales, que entra
     en su **próxima liquidación** aunque la reserva no tenga contrato. Sin
     honorarios, salvo que la inmobiliaria configure un porcentaje en
     **Configuración › Reservas** (con su IVA, regla 12), que se le
     descuenta. Si la reserva no tiene propietario cargado, cerrar pide
     elegirlo («Para retener la seña hace falta el propietario: elegí a
     quién se le entrega.») y se suma a la reserva. La ficha lo dice: «Seña
     retenida: $ X se le entrega al propietario en su próxima liquidación».
172. **Anular es deshacer un error.** Anular una reserva no retiene nada; si
     la seña tiene recibo vigente, primero se anula el recibo, como
     cualquier otro: «La seña tiene el recibo N: anulalo primero, en Cobros,
     y después anulá la reserva.».
173. **La reserva se cierra a mano.** Ninguna reserva cambia de estado sola:
     ni al vencer ni nunca. El Dashboard avisa (regla 166) y la lista la
     marca en rojo (regla 164); quien la administra decide.
174. **El anexo de inventario** («lo mejor es que sea un apéndice del
     contrato»): una plantilla de Word de **anexo de inventario**, con su
     lista de marcadores —el código, las fechas y el tipo del contrato, la
     propiedad, los propietarios y los inquilinos, la fecha del día, la
     lista `{#inventario}` y sus observaciones; los mismos datos que el
     contrato—, validada al subirla como las demás y con su **Word de
     ejemplo**. Desde la ficha del contrato, al lado del contrato en Word,
     «Descargar el anexo de inventario (Word)»:
     `Anexo-inventario-<código>.docx`, con la plantilla de anexo de la
     inmobiliaria o, si no subió ninguna, con el modelo de la plataforma. No
     se guarda; queda en el historial. Un contrato anulado no tiene anexo.

**Casos borde:**

- **La fila vieja**: contratos sin inventario (regla 153); plantillas sin
  tipo, que son de contrato (regla 162); garantías que siempre fueron de un
  contrato (la columna nueva `reserva_id` queda vacía); conceptos sin
  reserva (la columna nueva `reserva_id` de `alq_concepto`, vacía).
- **La lista vacía**: sin reservas, «Todavía no se cargó ninguna reserva.»;
  sin abiertas, «No hay reservas abiertas.»; una reserva sin garantías no
  se aprueba (regla 157); una reserva sin seña cobrada se cierra sin
  retener nada.
- **La inmobiliaria sin el módulo**: 403 en todo, como el resto (regla 167).
- **El interesado que ya es inquilino** de otro contrato: es la misma
  persona; nada lo impide.
- **Varios propietarios**: la seña retenida se reparte en partes iguales (la
  reserva no lleva porcentajes; el contrato sí).

**Fuera de alcance (entrega C):**

- Mapear los Word reales de Vacker: llegan después y solo hay que ubicar
  los marcadores.
- Generar el **PDF** de la reserva o mandarla por mail: se descarga el
  Word, como el contrato. (El recibo de la seña sí va por mail, regla 169.)
- Una seña en una moneda y el depósito en otra (regla 170: misma moneda).
- La seña retenida en el informe al propietario: se liquida y sale en su
  cuenta corriente y en la liquidación; el informe mira los contratos.
- Un portal o un link para que el interesado complete sus datos.

**Criterio de aceptación (en Alteva):**

1. Javier entra a Alteva con su usuario de dirección y va a **Contratos ›
   Reservas**: ve «No hay reservas abiertas» y el botón «Nueva reserva».
2. Carga una reserva para una propiedad, con un interesado que **da de alta
   en el momento** («＋ Dar de alta una persona nueva…»), un garante, seña de
   USD 500, vencimiento en 5 días, alquiler inicial $ 600.000 por ICL cada 3
   meses, 24 meses, depósito USD 500. Queda «Reserva 1 · Reservada». En
   **Propiedades** esa propiedad dice «Reservada»; intentar una segunda
   reserva para ella dice que ya tiene la Reserva 1 abierta.
3. En la reserva, «Cobrar la seña» por transferencia: sale el recibo
   000N, que se abre en PDF y se manda por mail a su propio correo; en la
   cuenta corriente del interesado está la seña, cancelada por ese recibo.
4. En el Dashboard, «Reservas que vencen en 7 días o ya vencidas» la cuenta.
5. «Empezar el estudio de garantías»; carga la garantía con el informe
   pendiente: «Aprobar» dice que falta el informe. La pone aprobada:
   «Aprobar» la pasa a Aprobada. La línea de tiempo muestra los pasos con
   su usuario; el Dashboard la muestra en «Reservas aprobadas sin contrato».
6. En **Configuración › Plantillas** descarga los ejemplos de reserva y de
   anexo de inventario y los sube con su tipo; en la reserva, «Descargar la
   reserva en Word» baja `Reserva-1.docx` con la seña de U$S 500,00 y su
   recibo. Las plantillas no se mezclan con las de contrato.
7. «Convertir en contrato» abre el alta precargada; con el depósito en USD
   400 dice que sobran U$S 100,00 y se le reintegran; lo vuelve a USD 500 y
   dice que la seña ya cubre el depósito. Lo guarda: el contrato en
   borrador dice «Seña de la reserva 1: U$S 500,00 · recibida …, recibo
   000N», el depósito figura cobrado y la reserva queda «Convertida».
8. En la ficha del contrato carga el **Inventario** (tres ítems y una
   observación) y baja «el anexo de inventario (Word)» con su plantilla: los
   tres ítems, las partes y la propiedad. Sin plantilla de anexo, sale con
   el modelo de la plataforma.
9. Otra reserva con seña cobrada, sin propietario, aprobada: «No se
   presentó a firmar» pide el propietario; elegido, la ficha dice «Seña
   retenida», y en **Liquidaciones** ese propietario tiene U$S 500,00 para
   liquidar. Anular una reserva con la seña cobrada pide anular primero el
   recibo.
10. En la Inmobiliaria de Demo, sin el módulo, un usuario `direccion` no ve
    Alquileres y `GET /alquileres/reservas` responde 403.

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

| Reglas            | Cómo se protegen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 4              | Unit del validador de contrato: mes sin tramo, tramos superpuestos, porcentajes que no suman 100                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2, 3              | Unit de generación: contrato `borrador`/`finalizado` no genera; rescisión anula lo impago posterior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5, 6, 7           | Unit de indexación con valores del ICL e IPC conocidos; un tramo sin confirmar no cambia de importe; índice no publicado → alerta correcta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8                 | Unit del importador de índices con la fuente simulada: no pisa, reintenta, avisa a los 3 días                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9, 10, 11, 12, 13 | Unit de generación del período: conceptos esperados por contrato; idempotencia; bloqueo por indexación; montos con IVA de la inmobiliaria; prorrateo por cambio de tramo con los importes de Gexion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 37 → 100          | Unit de vencimientos: sábado, domingo y feriado se corren al siguiente día hábil (regla 100)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14, 20, 21, 22    | Unit de liquidación: neto con gastos adelantados, con y sin pago garantizado, sin doble liquidación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15, 16, 17        | Unit de cobro: imputación por antigüedad, parcial, punitorio propuesto y condonado, saldo a favor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 18                | Unit de cuenta corriente: saldos separados por moneda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 19                | API: un DELETE no existe; anular revierte y deja rastro                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 23, 24            | Unit de los PDFs: totales iguales a la cuenta corriente; leyenda presente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 25                | Unit de migración: saldo inicial por moneda igual al importado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 33, 34            | Unit de estados de firma: transiciones válidas, registro de cada cambio, aviso ajeno rechazado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 35                | Unit con un adaptador de prueba: el módulo funciona entero contra un proveedor simulado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 36                | Unit del tablero: contrato vigente sin documento firmado aparece en «a completar»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 38 – 44           | Unit de `plantilla-word`, `plantilla-modelo` y `plantillas.service` (validación, lista ↔ datos, sin PDF, consultas fijas); web: `plantillas-vista` y `generar-contrato`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 26 – 32           | Unit de los cálculos del tablero + test de que cada drill-down suma su tarjeta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 45 – 53           | Types y domain: `boletas.test.ts`; API: `impuestos.service.spec.ts` (recupero, adelantado con cobro parcial y anulada, consultas fijas); web: `impuestos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 60 – 66           | Unit de `reclamos.service` (`regla 6x` en el nombre: vendedor y team leader rechazados, fila vieja que se vuelve a guardar, proveedor ajeno, notas); web: `reclamos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 67 – 73           | Types: `reclamos.test.ts`; API: `reclamos.service.spec.ts`, `proveedores.service.spec.ts`, `envios.service.spec.ts`, `tablero-alquileres.service.spec.ts`; base: `aislamiento.e2e-spec.ts` (regla 70); web: `reclamos.test.tsx`, `proveedores-vista.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 74 – 82           | Domain: `cierreDelMes`; web: `periodo-tablero.test.ts` (74), `tablero-alquileres.test.tsx` (`regla 7x` en el nombre); API: `tablero-alquileres.service.spec.ts` (75 a 79 y 82: cada flujo de un mes, un trimestre y el año, y cada foto, suman su tarjeta en los tres cortes; consultas con 5 y 25 contratos); base: `tablero-alquileres.e2e-spec.ts` (79, el SQL real, en el job de aislamiento de CI); roles: `alquileres.roles.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 83 – 98           | Domain: `informe-propietario.test.ts` (87, 88, 84, 98: la cadena con cobro parcial, parte ya liquidada, pago garantizado, gastos por caja; el caso de Marcela Ibarra —alquiler liquidado y un arreglo posterior sin liquidar—; el nombre del período); types: `RANGO_*` en `InformePeriodoQuerySchema`; API: `informe-propietario.service.spec.ts` (`regla 8x`/`9x` en el nombre: la cadena al centavo, solo lo suyo, ARS/USD, deuda, mes a mes, nombres y sumas de cada descuento, reclamos sin notas y con importe solo a cargo del propietario, liquidaciones que suman lo liquidado, vacío, 404, la fila igual al informe, consultas con 5 y 25 contratos, regla 98 con el mismo caso), `informe-propietario.template.spec.tsx` (95, 94 y 98: texto del PDF, los renglones y solo Montserrat), `envios.service.spec.ts` (95), `alquileres.roles.spec.ts` (83); base: `informe-propietario.e2e-spec.ts` (85 a 93 y 96, el SQL real, en el job de aislamiento de CI); web: `periodo-tablero.test.ts` (84), `cuenta-corriente.test.tsx` (83), `informe-propietario.test.tsx` (84 a 96 y 98), `alquileres-nav.test.tsx` (83)                                                                                                                                                                                                                                                                      |
| 99 – 112          | Ver la tabla «Cada regla con su test (99 a 112)» de la Entrega A para Vacker: domain `alquileres.test.ts`; types `alquileres-entrega-a.test.ts`; API `correccion-tramo.service.spec.ts`, `indices.service.spec.ts`, `conceptos.service.spec.ts`, `contrato-completo.service.spec.ts`, `contratos.service.spec.ts`, `indexaciones.service.spec.ts`, `alquileres.service.spec.ts`, `tablero-alquileres.service.spec.ts`, `tareas.controller.spec.ts`; base `rls-habilitada.e2e-spec.ts`; web `contrato-form`, `contrato-ficha`, `contrato-completo` y `configuracion-form` (`.test.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 150 – 168         | Types: `reservas.test.ts` (154, 155: el schema, los pasos, el motivo, el filtro), `alquileres.test.ts` (162); API: `inventario.service.spec.ts` (150 a 153 y el Word del inventario), `reservas.service.spec.ts` (`regla 15x`/`16x` en el nombre: alta, una abierta por propiedad, pasos válidos e inválidos, aprobar con garantías, vencida, editar cerrada, convertir en la transacción del alta y copiar las aprobadas, seña, reserva devuelta al borrar el contrato, consultas con 5 y 25), `contratos.service.spec.ts` (159 y 160), `reserva-modelo.spec.ts` (162 y 163: `MARCADORES_RESERVA` ↔ datos, validación por documento, el ejemplo, cruces 400, anulada, consultas fijas), `tablero-reservas.spec.ts` y `tablero-alquileres.service.spec.ts` (166 y 168), `propiedades.service.spec.ts`, `alquileres.roles.spec.ts` (167); base: `reservas.e2e-spec.ts` (153, 156 con el índice parcial, 157 con el CHECK, 159 y 160 de punta a punta) y `aislamiento.e2e-spec.ts` (las dos tablas nuevas y la parte que cruza inmobiliarias); web: `reservas.test.tsx` (154, 155, 157, 159, 161, 164, 165, 150 y 151), `tablero-alquileres.test.tsx` (166), `plantillas-vista.test.tsx` (162 y 163), `alquileres-nav.test.tsx` (164)                                                                                                                                                               |
| 169 – 174         | Types: `reservas.test.ts` (169, 171: cobrar la seña, los cierres que retienen, el propietario elegido), `alquileres.test.ts`; API: `reservas.service.spec.ts` (`regla 169`–`172` en el nombre: el recibo, una vez por recibo, la seña con recibo no se cambia, la seña como depósito con diferencia en los dos sentidos y en otra moneda, la retención en partes iguales, con honorarios, sin propietario y sin seña, anular con recibo, el contrato borrado devuelve la seña), `contrato-completo.service.spec.ts` (170: depósito cobrado, mayor, menor, sin depósito y lo que propone «Cargos de ingreso»), `liquidaciones.service.spec.ts` (171: la retenida sin contrato entra en la liquidación, con honorarios), `cobros.service.spec.ts` (169 y 171: anular el recibo de la seña, frenado si la retenida ya se liquidó), `anexo-inventario.spec.ts` (174: marcadores, validación, ejemplo, modelo de la plataforma, plantilla propia, cruces 400, anulado); base: `reservas.e2e-spec.ts` (169 a 171 de punta a punta); web: `reservas.test.tsx` (169 a 171 y 174: cobrar, recibo, cierre que pide propietario, seña como depósito, anexo), `plantillas-vista.test.tsx` (174)                                                                                                                                                                                                               |
| 175               | Types: `tablero-alquileres-compacto.test.ts` (expandir lo compactado devuelve lo mismo; cada fila una vez; las dos formas); API: `tablero-alquileres.service.spec.ts` (`regla 82`: seis consultas con 5 y con 25 contratos), `en-un-viaje.spec.ts`; base: `tablero-alquileres.e2e-spec.ts` (el SQL en una sentencia, contra Postgres); web: `tablero-alquileres.test.tsx` (la forma compacta se ve igual y el filtro no pide nada)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| §3 (roles)        | API: 403 para `vendedor`, `team_leader`, `publicador`; 200 para `administracion`, `direccion`, `admin_tenant`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Aislamiento       | Cada tabla nueva en `isolation.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Licencia          | API: 403 en una inmobiliaria sin el módulo, aun con rol `direccion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Reglas            | Cómo se protegen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 4              | Unit del validador de contrato: mes sin tramo, tramos superpuestos, porcentajes que no suman 100                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2, 3              | Unit de generación: contrato `borrador`/`finalizado` no genera; rescisión anula lo impago posterior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5, 6, 7           | Unit de indexación con valores del ICL e IPC conocidos; un tramo sin confirmar no cambia de importe; índice no publicado → alerta correcta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8                 | Unit del importador de índices con la fuente simulada: no pisa, reintenta, avisa a los 3 días                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9, 10, 11, 12, 13 | Unit de generación del período: conceptos esperados por contrato; idempotencia; bloqueo por indexación; montos con IVA de la inmobiliaria; prorrateo por cambio de tramo con los importes de Gexion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 37 → 100          | Unit de vencimientos: sábado, domingo y feriado se corren al siguiente día hábil (regla 100)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14, 20, 21, 22    | Unit de liquidación: neto con gastos adelantados, con y sin pago garantizado, sin doble liquidación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15, 16, 17        | Unit de cobro: imputación por antigüedad, parcial, punitorio propuesto y condonado, saldo a favor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 18                | Unit de cuenta corriente: saldos separados por moneda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 19                | API: un DELETE no existe; anular revierte y deja rastro                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 23, 24            | Unit de los PDFs: totales iguales a la cuenta corriente; leyenda presente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 25                | Unit de migración: saldo inicial por moneda igual al importado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 33, 34            | Unit de estados de firma: transiciones válidas, registro de cada cambio, aviso ajeno rechazado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 35                | Unit con un adaptador de prueba: el módulo funciona entero contra un proveedor simulado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 36                | Unit del tablero: contrato vigente sin documento firmado aparece en «a completar»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 38 – 44           | Unit de `plantilla-word`, `plantilla-modelo` y `plantillas.service` (validación, lista ↔ datos, sin PDF, consultas fijas); web: `plantillas-vista` y `generar-contrato`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 26 – 32           | Unit de los cálculos del tablero + test de que cada drill-down suma su tarjeta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 45 – 53           | Types y domain: `boletas.test.ts`; API: `impuestos.service.spec.ts` (recupero, adelantado con cobro parcial y anulada, consultas fijas); web: `impuestos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 60 – 66           | Unit de `reclamos.service` (`regla 6x` en el nombre: vendedor y team leader rechazados, fila vieja que se vuelve a guardar, proveedor ajeno, notas); web: `reclamos.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 67 – 73           | Types: `reclamos.test.ts`; API: `reclamos.service.spec.ts`, `proveedores.service.spec.ts`, `envios.service.spec.ts`, `tablero-alquileres.service.spec.ts`; base: `aislamiento.e2e-spec.ts` (regla 70); web: `reclamos.test.tsx`, `proveedores-vista.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 74 – 82           | Domain: `cierreDelMes`; web: `periodo-tablero.test.ts` (74), `tablero-alquileres.test.tsx` (`regla 7x` en el nombre); API: `tablero-alquileres.service.spec.ts` (75 a 79 y 82: cada flujo de un mes, un trimestre y el año, y cada foto, suman su tarjeta en los tres cortes; consultas con 5 y 25 contratos); base: `tablero-alquileres.e2e-spec.ts` (79, el SQL real, en el job de aislamiento de CI); roles: `alquileres.roles.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 83 – 98           | Domain: `informe-propietario.test.ts` (87, 88, 84, 98: la cadena con cobro parcial, parte ya liquidada, pago garantizado, gastos por caja; el caso de Marcela Ibarra —alquiler liquidado y un arreglo posterior sin liquidar—; el nombre del período); types: `RANGO_*` en `InformePeriodoQuerySchema`; API: `informe-propietario.service.spec.ts` (`regla 8x`/`9x` en el nombre: la cadena al centavo, solo lo suyo, ARS/USD, deuda, mes a mes, nombres y sumas de cada descuento, reclamos sin notas y con importe solo a cargo del propietario, liquidaciones que suman lo liquidado, vacío, 404, la fila igual al informe, consultas con 5 y 25 contratos, regla 98 con el mismo caso), `informe-propietario.template.spec.tsx` (95, 94 y 98: texto del PDF, los renglones y solo Montserrat), `envios.service.spec.ts` (95), `alquileres.roles.spec.ts` (83); base: `informe-propietario.e2e-spec.ts` (85 a 93 y 96, el SQL real, en el job de aislamiento de CI); web: `periodo-tablero.test.ts` (84), `cuenta-corriente.test.tsx` (83), `informe-propietario.test.tsx` (84 a 96 y 98), `alquileres-nav.test.tsx` (83)                                                                                                                                                                                                                                                                      |
| 99 – 111          | Ver la tabla «Cada regla con su test (99 a 111)» de la Entrega A para Vacker: domain `alquileres.test.ts`; types `alquileres-entrega-a.test.ts`; API `correccion-tramo.service.spec.ts`, `indices.service.spec.ts`, `conceptos.service.spec.ts`, `contrato-completo.service.spec.ts`, `contratos.service.spec.ts`, `indexaciones.service.spec.ts`, `alquileres.service.spec.ts`, `tablero-alquileres.service.spec.ts`, `tareas.controller.spec.ts`; base `rls-habilitada.e2e-spec.ts`; web `contrato-form`, `contrato-ficha`, `contrato-completo` y `configuracion-form` (`.test.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 130 – 140         | Domain: `liquidacion-final.test.ts` (`regla 13x` en el nombre: la parcial con el importe anterior y prorrateada, la regla 11 cuando el índice ya salió, parcial + final = definitivo al centavo con dos dueños al 50% y mes partido, el espejo negativo, la parcial anulada, la segunda final, la final como parte propia en `proponerLiquidacion`, el vencimiento y el punitorio); API: `conceptos.service.spec.ts` (130, consultas con 5 y 25 contratos), `indexaciones.service.spec.ts` (131 a 137: las finales al confirmar, al centavo, Casa Propia a mano, días de la configuración, vista previa igual a la confirmación, feriados, consultas con 1 y 5 meses), `correccion-tramo.service.spec.ts` (135: otra final al corregir, desde el mes elegido), `cobros.service.spec.ts` (133, 134, 138), `informe-propietario.service.spec.ts` (136, 140), `tablero-alquileres.service.spec.ts` (139: esperan el índice, final unida a su parcial, reintegro, tarea, ocho consultas), `recibo.template.spec.tsx` (138, solo Montserrat), `informe-propietario.template.spec.tsx` (140), `alquileres.roles.spec.ts` (el endpoint nuevo); base: `tablero-alquileres.e2e-spec.ts` (139 y 134, el SQL real); web: `bandeja-indexacion.test.tsx` (137), `configuracion-form.test.tsx` (133), `conceptos-mes.test.tsx` (130), `tablero-alquileres.test.tsx` (139), `informe-propietario.test.tsx` (140) |
| §3 (roles)        | API: 403 para `vendedor`, `team_leader`, `publicador`; 200 para `administracion`, `direccion`, `admin_tenant`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Aislamiento       | Cada tabla nueva en `isolation.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Licencia          | API: 403 en una inmobiliaria sin el módulo, aun con rol `direccion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
