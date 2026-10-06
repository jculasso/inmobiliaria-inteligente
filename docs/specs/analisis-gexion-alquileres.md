# Análisis de Gexion — base para un módulo de administración de alquileres

> Relevado el 5/10/2026 sobre la cuenta de Vacker en `si.gexion.com.ar`
> (Gexion Sistema Inmobiliario, release 6.4.1, de Profit Sistemas), con la
> sesión abierta por Javier. **Solo lectura**: no se creó, editó ni publicó
> nada. Este documento describe la **estructura** del sistema; no copia datos
> de inquilinos ni propietarios.
>
> Lo que está acá es lo que se VE en las pantallas. Cómo se usa en el día a
> día —qué tarda, qué se hace por fuera, qué se odia— no se puede ver desde
> afuera: eso lo tiene que contar quien lo opera en Vacker (ver §6).

## 1. Qué es Gexion

No es un módulo de alquileres: es un **sistema de gestión completo** para
administración de propiedades, con contabilidad, facturación electrónica y
tesorería. Vacker lo usa sobre todo para alquileres.

La foto de Vacker al 5/10/2026, del propio tablero de Gexion:

|                                                |                                      |
| ---------------------------------------------- | ------------------------------------ |
| Contratos de alquiler en curso                 | 78 (68 de vivienda, 10 comerciales)  |
| Clientes activos                               | 150 (86 inquilinos, 64 propietarios) |
| Contratos con indexación vencida               | 6                                    |
| Contratos a indexar en los próximos 60 días    | 35                                   |
| Contratos con póliza de seguro                 | 1 de 78                              |
| Contratos que terminan en los próximos 60 días | 5                                    |

## 2. El mapa del sistema

| Menú                 | Qué hay adentro                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clientes**         | Clientes · comprobantes · cobros y pagos · control de impuestos y servicios · conceptos (carga múltiple, por código de barras, desde el período anterior) · generación y liquidación de cupones · cuenta corriente · reportes de conceptos cobrados, pagados, facturados y pendientes |
| **Administración**   | Propiedades · loteos · administradores de PH · **contratos de alquiler** · contratos de venta financiada · garantías · sellados · depósitos en garantía · pólizas de seguro · índices · plantillas de documentos · firma electrónica · correos, newsletters y WhatsApp enviados       |
| **Proveedores**      | Pagos · tipos de gasto · pendientes · pagos por tipo de gasto                                                                                                                                                                                                                         |
| **Comercialización** | Publicación a portales · reservas · propiedades en venta y en alquiler                                                                                                                                                                                                                |
| **Fondos**           | Movimientos · cierre de caja · conciliación bancaria · cheques                                                                                                                                                                                                                        |
| **Contabilidad**     | Ejercicios · asientos · plan de cuentas · libro diario · submayor · balance de sumas y saldos · ingresos y egresos · libros IVA ventas y compras · retenciones                                                                                                                        |

Además: agenda, un «resumen cliente» y la publicación a un **portal de
autogestión** donde inquilinos y propietarios ven su cuenta.

## 3. El modelo, por dentro

### El contrato

- Propietario, inquilino, propiedad; tipo **vivienda** o **comercial**.
- Inicio, fin, fecha de firma, y desde qué mes genera cuenta corriente.
- **Tramos** (en el que se miró, seis tramos de 4 meses), cada uno con su
  importe mensual. El contrato puede ser:
  - **indexado**: índice (ICL, IPC Nacional o Casa Propia), período base y
    período requerido. Cada tramo queda «sin indexar» hasta que alguien
    aprieta **Indexar**; recién ahí se calcula el importe nuevo.
  - **escalonado**: importes fijos por tramo, sin índice.
- **IVA del alquiler** (porcentaje).
- **Honorarios profesionales**: porcentaje, a cargo del **propietario**.
- **Gastos administrativos**: porcentaje, a cargo del **inquilino**.
- **Punitorios** por mora, y si se cobran honorarios sobre los punitorios.
- **«Garantizar pago a la contraparte»**: la inmobiliaria le paga al
  propietario aunque el inquilino todavía no haya pagado.
- Al costado: garantías (con garante y estado de verificación), pólizas,
  sellados, depósito en garantía (con fecha de devolución) y documentos con
  firma electrónica.
- Acciones: generar documento (desde plantilla), extender contrato, cambiar
  estado.

### El concepto: la pieza central

Todo lo que se cobra o se paga es un **concepto**, una línea con tipo,
período, cliente, propiedad y contrato. Cada mes, un contrato genera:

| Concepto                 | A quién     | Sentido                                      |
| ------------------------ | ----------- | -------------------------------------------- |
| Alquiler                 | inquilino   | a cobrar                                     |
| Alquiler                 | propietario | a pagar                                      |
| Gastos administrativos   | inquilino   | a cobrar                                     |
| Honorarios profesionales | propietario | a cobrar (se descuenta de lo que se le paga) |

Y además, cargados aparte: expensas (ordinarias y extraordinarias),
impuestos y servicios, reparaciones. Estados: _a cobrar_, _a pagar_, _pago
parcial_, _en espera_ (el pago garantizado: se le debe al propietario aunque
el inquilino no pagó). Los impuestos y servicios se cargan a mano, en lote,
por código de barras o copiando el período anterior.

### El cobro y la liquidación

- **Cobro al inquilino**: un cobro cancela sus conceptos y emite los
  comprobantes. Factura X por el alquiler, nota de crédito X, y **factura B
  electrónica con CAE de ARCA** por lo que es ingreso de la inmobiliaria
  (gastos administrativos).
- **Pago al propietario** (la liquidación): le acredita el alquiler y le
  descuenta los honorarios con una **factura A electrónica**. Se le paga el
  neto, por transferencia o cheque.
- **Cupones de pago** por un servicio de recaudación (**SIRO / Roela**), con
  su liquidación y comisión.
- **Cuenta corriente** por cliente, en pesos **y en dólares**, con punitorios
  calculados y publicable al portal.

## 4. Qué hace bien

- **Las alertas del tablero son las correctas**: indexaciones vencidas y
  próximas, contratos por terminar, depósitos a devolver, pólizas vencidas.
  Cada número es un link a la lista filtrada.
- **El modelo de conceptos es completo**: separa lo que es del propietario de
  lo que es ingreso de la inmobiliaria, con el pago garantizado y los
  punitorios.
- **Factura electrónicamente** y lleva contabilidad, libros IVA y
  retenciones. Esto es lo más difícil de replicar y lo menos visible.
- **Tiene el circuito con terceros**: recaudación SIRO, firma electrónica,
  WhatsApp, cotización de pólizas, portal de autogestión.

## 5. Dónde se puede mejorar — hipótesis a validar con Vacker

Esto sale de mirar las pantallas, no de usarlas. Son hipótesis, no hallazgos.

1. **La indexación es manual, contrato por contrato.** Hay 6 vencidas y 35 en
   los próximos 60 días. Si el índice está cargado (y el ICL es diario), el
   cálculo podría proponerse solo y que la persona solo confirme.
2. **El menú está organizado por área contable, no por tarea.** Para el
   trabajo del mes —indexar, cargar servicios, cobrar, liquidar— hay que
   saltar entre Clientes, Administración y Fondos. Un «cierre del mes» guiado
   sería una sola pantalla.
3. **Los impuestos y servicios se cargan a mano.** Hay tres formas de carga
   masiva, lo que sugiere que es una tarea pesada y recurrente.
4. **Casi ningún contrato tiene póliza** (1 de 78). Puede ser una decisión de
   Vacker o una oportunidad comercial que el sistema muestra pero no empuja.
5. **No hay análisis del negocio de alquileres**: rentabilidad por contrato,
   morosidad en el tiempo, evolución de la cartera, comparación con el
   mercado. El tablero cuenta, pero no compara. Es justo lo que nuestro
   Tablero Comercial ya hace con las ventas.
6. **La interfaz es densa.** Las pantallas están llenas de filtros y
   columnas pensados para administración, no para la dirección. (Durante el
   relevamiento una pestaña del contrato no respondió al click, pero puede
   haber sido el modo en que se navegó, no el sistema.)

## 6. La decisión que hay que tomar antes de diseñar

**¿Reemplazar Gexion o complementarlo?**

|            | Reemplazar                                                                                                                              | Complementar                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Qué es     | Un sistema de administración propio: contratos, conceptos, cobros, liquidaciones, **facturación electrónica**, cuenta corriente, portal | Gexion sigue siendo el sistema donde se opera; nosotros sumamos lo que no tiene: análisis, alertas y el día a día simplificado       |
| Lo difícil | Facturación electrónica con ARCA, recaudación SIRO, contabilidad y libros IVA. Es regulado: un error es fiscal, no visual               | Traer los datos: hay que ver si Gexion tiene API o exportaciones (el contrato muestra un «ID externo», lo que sugiere integraciones) |
| Tiempo     | Meses, y una migración de 78 contratos con su historia                                                                                  | Semanas para una primera versión                                                                                                     |
| Riesgo     | Alto: Vacker cobra y paga con esto todos los meses                                                                                      | Bajo: si algo falla, Gexion sigue andando                                                                                            |

**Recomendación: complementar primero.** El valor que podemos agregar rápido
—análisis de la cartera, alertas, indexación asistida, morosidad— no
necesita reemplazar la facturación. Reemplazar se puede evaluar después,
cuando el módulo ya esté en uso y se sepa qué duele de verdad.

### Las preguntas para Vacker

Para quien opera Gexion todos los días:

1. ¿Qué tarea del mes les lleva más tiempo? (indexar, cargar servicios,
   cobrar, liquidar, conciliar…)
2. ¿Qué hacen **por fuera** de Gexion? Planillas, WhatsApp, cuentas a mano.
3. ¿Usan la facturación electrónica de Gexion para todo, o facturan en otro
   lado?
4. ¿Cuántos inquilinos pagan por cupón SIRO y cuántos por transferencia?
5. ¿Los propietarios usan el portal de autogestión?
6. ¿Qué información les gustaría ver de los alquileres y hoy no tienen?
7. ¿Cuánto pagan por Gexion? (para saber contra qué precio competimos si
   algún día se reemplaza)

Y una técnica, para Profit Sistemas o desde la configuración: **¿Gexion
tiene API o exportación de datos?** Sin eso, complementar significa cargar
dos veces, y no sirve.

## 7. ¿Se puede integrar? Lo que se vio

**Técnicamente, sí.** La aplicación web de Gexion es una pantalla que le pide
todo a una API REST propia, en `api.si.gexion.com.ar`, con recursos que
calzan con lo que necesitaríamos: `contract`, `concept`, `customer`,
`index/{id}/period`, `guarantee`, `securityDeposit`, y estadísticas como
`statistic/conceptPaidPercentage` (lo que la pantalla muestra como «alquileres
cobrados 71 de 78»). Se observó mirando el tráfico de la sesión, sin llamarla.

**Pero es una API privada**: la usa su propia pantalla, no está documentada
ni ofrecida para terceros. Conectarse a ella con el usuario de Vacker
funcionaría hoy, y tiene tres problemas:

1. **Permiso.** Hacerlo sin autorización de Profit Sistemas puede violar sus
   términos, y el usuario es de una persona de Vacker.
2. **Fragilidad.** Si Gexion cambia una ruta en un release, la integración se
   rompe sin aviso.
3. **Credenciales.** Habría que guardar la clave de una persona en nuestro
   sistema. Es exactamente lo que no queremos.

**El camino correcto: pedirle a Profit Sistemas acceso oficial** —una API key
o un usuario de integración, de solo lectura—. Ya se integran con terceros
(portales, SIRO/Roela, Propiedades Seguras, ARCA, su propio portal), así que
no sería un pedido raro. Lo pide Vacker, que es el cliente.

**El plan B: exportaciones.** Si no dan API, una exportación periódica
(Excel/CSV) de contratos y conceptos alcanza para la parte de análisis. No
sirve para nada en tiempo real.
