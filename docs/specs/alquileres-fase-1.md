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

| Tema | Decisión |
|---|---|
| Alcance | **Módulo propio que reemplaza a Gexion**, no un complemento. Vacker es el primer cliente. |
| Licencia | Módulo nuevo `alquileres` en `MODULO_KEYS`, **apagado por defecto**. Se prende para Vacker y para Alteva (demo, datos inventados). |
| Operador | **Rol funcional nuevo `administracion`**, como `publicador`: opera el módulo y no ve nada del Tablero Comercial. |
| Facturación electrónica | **Fase 2**, a través de un facturador homologado con ARCA, por API. En la fase 1 se emiten recibos y liquidaciones **no fiscales**; Vacker sigue facturando como hoy. |
| Migración | **Corte en una fecha**: se cargan los contratos vigentes con los saldos de cada persona a ese día, y desde ese mes se opera solo acá. |
| Propietarios e inquilinos | Reciben **PDF** (liquidación, estado de cuenta, recibo) por WhatsApp o mail. El portal con usuario propio queda para después. |
| Celular | La dirección **consulta** (tablero, alertas, cuenta de una persona). La **operación** (cargar, cobrar, liquidar) se diseña para escritorio y no se bloquea en el teléfono. |
| Tablero Comercial | Separado en la fase 1. Más adelante, un alquiler firmado ahí ofrece crear el contrato administrado. |
| Firma del contrato | **Prevista desde la fase 1, integrada en la fase 2.** El contrato lleva su documento y un estado de firma; la conexión con un proveedor pasa por una capa propia (un adaptador por proveedor), como la autenticación. Qué proveedor, y si firma **digital** (Ley 25.506, certificador licenciado) o **electrónica**, lo define Vacker con su abogado. |

## 3. Matriz de roles

Los alquileres administrados no tienen puntas: son de la inmobiliaria. No hay
«lo mío» ni tilde «Ver todo»: quien entra al módulo ve la cartera entera, y
quien no entra no ve nada. **Ver y poder coinciden** en este módulo, a
diferencia del Tablero (`scope.util.ts`), y eso está decidido, no olvidado.

| Rol | Qué VE | Qué PUEDE HACER |
|---|---|---|
| `vendedor` | Nada. El módulo no aparece en su Home. | Nada (403 en toda la API del módulo). |
| `team_leader` | Nada. | Nada (403). |
| `publicador` | Nada (salvo que además tenga `administracion`). | Nada (403). |
| `administracion` | Todo el módulo y su tablero. | Todo: personas, propiedades, contratos, indexar, cargar conceptos, cobrar, liquidar, anular con motivo. |
| `direccion` | Todo el módulo y su tablero. | Todo, igual que `administracion`. |
| `admin_tenant` | Todo el módulo y su tablero. | Todo, y además prender o apagar el módulo y dar el rol `administracion`. |
| `admin_plataforma` | Nada de los datos (está fuera del tenant). | Prender o apagar el módulo por inmobiliaria, desde la consola de plataforma. |

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
    + reintegros a su favor. Cada concepto se liquida **una sola vez**. Solo
    cuenta lo de contratos donde la persona es propietaria. Un concepto se
    puede dejar para la próxima liquidación; si es un alquiler, sus
    honorarios esperan con él. Si los descuentos superan lo que se le paga,
    no se liquida hasta dejar algún descuento para después.
21. Con **pago garantizado**, el alquiler del propietario se liquida aunque el
    inquilino todavía no haya pagado; la deuda del inquilino sigue siendo con
    la inmobiliaria.
22. Sin pago garantizado, un alquiler impago **no entra** en la liquidación:
    queda «en espera», como en Gexion, con sus honorarios. Un pago parcial del
    inquilino todavía no lo libera. Un cobro cuyo alquiler ya se liquidó al
    propietario no se anula antes que esa liquidación.

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
  33–36) y la **generación del contrato desde plantilla**.
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

   | Caso | Contrato | Por qué |
   |---|---|---|
   | ICL con historia | #25, comercial | Seis tramos, todos indexados; honorarios 2,48% |
   | IPC que arranca el 15 | #5, vivienda | Tramos que cambian a mitad de mes: prorrateo |
   | Casa Propia | #26, vivienda | El único con CCP; contrato desde 2023 |
   | Sin indexación | #93, vivienda | Importe fijo; honorarios 5% |
   | Comercial sin honorarios | #72, comercial | IPC, arranca el 15, honorarios 0% |

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

| Reglas | Cómo se protegen |
|---|---|
| 1, 4 | Unit del validador de contrato: mes sin tramo, tramos superpuestos, porcentajes que no suman 100 |
| 2, 3 | Unit de generación: contrato `borrador`/`finalizado` no genera; rescisión anula lo impago posterior |
| 5, 6, 7 | Unit de indexación con valores del ICL e IPC conocidos; un tramo sin confirmar no cambia de importe; índice no publicado → alerta correcta |
| 8 | Unit del importador de índices con la fuente simulada: no pisa, reintenta, avisa a los 3 días |
| 9, 10, 11, 12, 13 | Unit de generación del período: conceptos esperados por contrato; idempotencia; bloqueo por indexación; montos con IVA de la inmobiliaria; prorrateo por cambio de tramo con los importes de Gexion |
| 37 | Unit de vencimientos: sábado y domingo se corren al lunes, un feriado no |
| 14, 20, 21, 22 | Unit de liquidación: neto con gastos adelantados, con y sin pago garantizado, sin doble liquidación |
| 15, 16, 17 | Unit de cobro: imputación por antigüedad, parcial, punitorio propuesto y condonado, saldo a favor |
| 18 | Unit de cuenta corriente: saldos separados por moneda |
| 19 | API: un DELETE no existe; anular revierte y deja rastro |
| 23, 24 | Unit de los PDFs: totales iguales a la cuenta corriente; leyenda presente |
| 25 | Unit de migración: saldo inicial por moneda igual al importado |
| 33, 34 | Unit de estados de firma: transiciones válidas, registro de cada cambio, aviso ajeno rechazado |
| 35 | Unit con un adaptador de prueba: el módulo funciona entero contra un proveedor simulado |
| 36 | Unit del tablero: contrato vigente sin documento firmado aparece en «a completar» |
| 26 – 32 | Unit de los cálculos del tablero + test de que cada drill-down suma su tarjeta |
| §3 (roles) | API: 403 para `vendedor`, `team_leader`, `publicador`; 200 para `administracion`, `direccion`, `admin_tenant` |
| Aislamiento | Cada tabla nueva en `isolation.e2e-spec.ts` |
| Licencia | API: 403 en una inmobiliaria sin el módulo, aun con rol `direccion` |
