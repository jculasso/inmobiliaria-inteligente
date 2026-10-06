# Alquileres — plan de la segunda etapa

> Del módulo en producción (entregas 1 a 9, 6/10/2026) a poder apagar Gexion
> en Vacker. Recoge los 15 comentarios de Javier al probarlo en Alteva y el
> relevamiento de Gexion del mismo día. La spec de la fase 1
> (`alquileres-fase-1.md`) sigue valiendo; cada entrega suma sus reglas ahí.

## 1. El objetivo y el orden

1. **Bloques A a E** (entregas 10 a 19), probados en Alteva.
2. **Migración de Vacker** (entrega 20) con fecha de corte parametrizable.
3. **Marcha blanca**: un mes operando acá y en Gexion en paralelo; Vacker
   sigue facturando en Gexion y se comparan los números mes contra mes.
4. **Facturación electrónica** (entrega 21), con un facturador homologado.
5. **Corte**: se apaga Gexion.

**Afuera por ahora** (decidido por Javier el 6/10): contabilidad (asientos,
libros, balance). A lo sumo, un reporte para el contador.

## 2. Lo que se exige a cada entrega

Javier pidió énfasis en cuatro cosas. Son condición para cerrar cada entrega,
no una revisión al final.

### La gráfica: igual que el resto del sistema

- Las pantallas se arman con las **mismas piezas** que el Tablero Comercial:
  `KpiCard` con su ícono, `PeriodosChart`, el modal de detalle, las tablas con
  encabezado ordenable, `tabla-movil`, los filtros de período, las insignias.
  Nada dibujado aparte.
- Mismas acciones por fila que las ventas: **lápiz** para editar y
  **papelera** con `ConfirmarBorradoModal` (que anula con motivo si lo que se
  borra tiene historia).
- **«Particular» y «Comercial»**, como Gexion, en todas las pantallas.
- Cierre de cada entrega: captura de cada pantalla al lado de su par del
  Tablero Comercial.

### El teléfono

- Cada pantalla verificada a **375 px** y a escritorio (skill `verificar-ui`):
  sin desborde horizontal, tablas que pasan a tarjetas, campos de 16 px,
  importes que no se parten, la barra de pestañas que se desliza.
- **Prueba de navegador (Playwright, Chromium y WebKit)** de los recorridos
  clave en tamaño teléfono, con la API simulada: cobrar, liquidar, indexar,
  tablero. Corre en CI.

### Que no falte nada de Gexion

La sección 5 es la lista completa de Gexion, punto por punto, con dónde queda
cada cosa. Se revisa al cerrar cada entrega.

### Performance y seguridad

- **Consultas que no crecen con las filas**: test que cuenta consultas con 5 y
  con 25 contratos en cada servicio nuevo, como en las entregas 5 a 8.
- **Lo que crece con la historia se calcula en SQL** (como la morosidad), y
  probado contra producción en una transacción que se deshace.
- **Prueba de volumen** antes de la migración: Alteva con 100 contratos y
  24 meses de historia; cada pantalla tiene que responder en menos de 2 s.
  Lo que no, se pagina.
- **Toda tabla nueva con RLS**, en el test de aislamiento (con filas de
  repuesto para sus índices únicos: es lo que falló en el despliegue del
  6/10), y en la guardia de acceso directo.
- **Roles**: cada controller con `@Modulo('alquileres')` y la constante de
  roles; el test de roles los recorre todos.
- **Plata**: decimales en la base y centavos enteros en las cuentas; nada se
  borra si tiene historia, se anula con motivo, usuario y fecha.
- **Archivos** (extractos, comprobantes, PDF): tipo verificado por contenido,
  límite de tamaño en Multer, bucket privado y links de vida corta.
- **Antes de cada migración**: copia de producción (base y Storage) y ensayo
  dentro de `BEGIN … ROLLBACK`. Aplicada antes del merge.
- **Revisión de seguridad** (`/security-review`) al cerrar los bloques D y E,
  que mueven dinero.

## 3. Las entregas

| # | Bloque | Qué trae | Puntos de Javier | Migración |
|---|---|---|---|---|
| 10 ✅ | A | **Gráfica unificada y teléfono**: todas las pantallas del módulo con las piezas del Tablero Comercial; Particular/Comercial | 1 | — |
| 11 ✅ | A | **Listas claras**: lápiz y papelera en cada fila (borrar lo que no tiene historia, anular lo demás; en un contrato vigente se edita solo lo que no toca plata); numeración ALT-0001 / VAC-0001 con orden numérico; buscador INQ/PROP en cobros y liquidaciones; conceptos agrupados por contrato con estado y columnas «A cobrar» / «A pagar» | 2, 4, 5, 6 | sí |
| 12 ✅ | B | **Tablero completo e índices**: contratos nuevos del año, por trimestre y acumulado mensual; selector Todos/Particulares/Comerciales; por finalizar, depósitos y pólizas a 60 días; indexaciones a 60 días; escalones por iniciar; pestaña «Índices»; los valores usados en cada tramo | 3, 8 | — |
| 13 ✅ | C | **Personas completas**: ficha con solapas (resumen, información básica, gestión administrativa, datos complementarios, cuenta corriente); condición de IVA y CUIT; cuentas bancarias con CBU y alias (validados); contactos adicionales; datos personales; **envío de recibos y liquidaciones por mail** (Resend, a la dirección de la persona, con el PDF adjunto) | 14 | sí |
| 14 ✅ | C | **Contrato completo**: garantías con su ficha e informe; depósito en garantía que se entrega al propietario y su devolución; extender contrato; cargos al firmar parametrizables (comisión: 5% del valor total + IVA en 2 cuotas por defecto, editable; informes de garantía; **sellado**: alícuota y reparto entre las partes, parametrizables) | 7, 11, 12, 13 | sí |
| 15 ✅ | C | **Contrato desde plantilla y reclamos**: plantillas de contrato por inmobiliaria con los datos del contrato (partes, propiedad, importes, tramos, garantías) que generan el PDF que después se firma; **reclamos** por persona o propiedad (asunto, tipo, prioridad, estado, asignado a, historial) | — | sí |
| 16 | D | **Caja y bancos**: cuentas (cajas por moneda, bancos); cada cobro, liquidación y pago mueve una cuenta; ingresos y egresos manuales; cierre de caja; cheques | 15 | sí |
| 17 | D | **Conciliación bancaria**: importar extractos en Excel y CSV (formato recordado por banco), sugerir el par de cada movimiento, marcar conciliados | 15 | sí |
| 18 ✅ | E | **Proveedores**: plomero, electricista, pintor (y aseguradoras, entes); su comprobante; el pago (fecha y medio; la cuenta de la que sale llega con la 16) y, en el mismo paso, se le carga al propietario como adelantado y se le descuenta en la próxima liquidación; reportes de pendientes y por tipo de gasto | 15 | sí |
| 19 | E | **Impuestos, servicios y pólizas**: catálogo por inmobiliaria (API, TGI, EPE, gas, agua); cuáles aplican a cada propiedad, con su número de cuenta; boletas en cuotas con su contraparte; carga de varios juntos y copiando el mes anterior; control de lo que paga la inmobiliaria; pólizas con cuotas y vencimientos | 9, 10 | sí |
| 20 | — | **Migración de Vacker** desde Gexion, con fecha de corte parametrizable y ensayo previo | — | — |
| 21 | — | **Facturación electrónica**, después de la marcha blanca | — | sí |

Cada entrega es un PR a `main` con CI completo (lint, tipos, tests, e2e y
aislamiento contra base real) y se publica al terminar: el módulo ya está en
producción, prendido solo en Alteva.

Al cerrar cada una se actualizan los 10 contratos de Alteva
(`scripts-demo/alquileres-alteva.mjs`) para que muestren lo nuevo.

**Estado (6/10/2026):** 10 y 11 en producción (#215, #216); la 11 sumó la
trazabilidad (punto 17: quién registró cada transacción, con historial). Javier
pidió seguir con 12, 13, 14, 15, 18 y 19; las 16 y 17 esperan los extractos de
Vacker, y la 18 registra el pago con su medio hasta que exista la cuenta de la 16.

## 4. Decisiones ya tomadas (6/10/2026)

- Borrar de verdad solo lo que no tiene historia; lo demás se anula.
- Un contrato vigente se edita solo en lo que no toca plata.
- Numeración con el prefijo de la inmobiliaria; Vacker conserva sus números
  de Gexion.
- «Particular» y «Comercial».
- Comisión parametrizable; el depósito se le entrega al propietario.
- A los proveedores les paga la inmobiliaria y se lo retiene al propietario.
- Extractos en Excel y CSV; fecha de corte parametrizable.
- Contabilidad afuera; facturación después de la marcha blanca.
- El operador que registra cada transacción queda guardado, se ve en el
  historial y va en el recibo y en la liquidación.
- Código de barras, más adelante; envío por mail con Resend, sí; contrato
  desde plantilla, sí; reclamos, sí; administradores de consorcio, por ahora
  no; sellados, sí.

## 5. Gexion, punto por punto

Relevado el 6/10/2026 en la cuenta de Vacker, sin copiar datos personales.

| Gexion | Dónde queda |
|---|---|
| Contratos de alquiler (alta, tramos, índices, estados, rescisión) | ✅ Entregas 1–3 |
| Indexación (ICL, IPC, Casa Propia) y alertas | ✅ Entrega 4; pestaña «Índices» en la 12 |
| Generación del mes, prorrateo, honorarios y gastos con IVA | ✅ Entrega 5 |
| Cobros, recibos, punitorios, saldo a favor, cuenta corriente | ✅ Entrega 6 |
| Liquidaciones al propietario, «en espera», pago garantizado | ✅ Entrega 7 |
| Tablero de contratos | ✅ Entrega 8; completo en la 12 |
| Firma electrónica | ✅ Prevista (entrega 9); proveedor a definir |
| Extender contrato | Entrega 14 |
| Garantías (ficha, informe, aprobación) | Entrega 14 |
| Depósitos en garantía | Entrega 14 |
| Comisión inicial e informes al firmar | Entrega 14 |
| Clientes: datos, IVA, cuentas bancarias, contactos | Entrega 13 |
| Fondos: movimientos, cierre de caja, cheques | Entrega 16 |
| Movimientos bancarios y conciliación | Entrega 17 |
| Proveedores, comprobantes, pagos, tipos de gasto | ✅ Entrega 18 |
| Impuestos y servicios (catálogo, cuotas, contraparte, control) | Entrega 19 |
| Cargas múltiples y desde el período anterior | Entrega 19 |
| Pólizas de seguro | Entrega 19 |
| Reportes: cuenta corriente, conceptos cobrados/pagados, pendientes | Entregas 12 y 18 |
| Facturación electrónica (factura A/B, notas de crédito) | Entrega 21 |
| Cargas por código de barras | Más adelante (decisión del 6/10) |
| Envío de recibos y liquidaciones por mail | Entrega 13, con Resend. WhatsApp sigue siendo a mano |
| Plantillas de documentos (generar el contrato) | Entrega 15 |
| Reclamos por cliente o propiedad | Entrega 15 (la agenda, más adelante) |
| Administradores de PH | Por ahora no (decisión del 6/10) |
| Sellados | Entrega 14 (alícuota y reparto parametrizables); el pago a API, con proveedores en la 18 |
| Cupones de pago (SIRO / Roela) | Afuera por ahora |
| Portal de autogestión | Afuera por ahora |
| Contabilidad (asientos, libros, balance, IVA compras/ventas) | Afuera (decisión del 6/10) |
| Contratos de venta financiada y loteos | Afuera |
| Comercialización (portales, reservas, búsquedas) | Ya existe en el Tablero Comercial y en Publicación |

## 6. Riesgos

- **Que las cuentas de Vacker no cierren en la migración.** Mitigación: la
  marcha blanca de un mes, comparando cada número contra Gexion.
- **La conciliación** depende del formato de cada banco. Mitigación: pedir un
  extracto real de cada banco de Vacker antes de la entrega 17.
- **Dependencia nueva** para leer Excel: `exceljs` (mantenida, MIT). SheetJS
  desde npm está desactualizada y tiene vulnerabilidades conocidas.
- **Volumen**: hoy Alteva tiene 10 contratos; Vacker, 78 con años de historia.
  Mitigación: la prueba de volumen de la sección 2 antes de la entrega 20.
