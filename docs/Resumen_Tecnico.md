# Resumen técnico

## Inmobiliaria Inteligente — cómo está hecho el sistema

Este documento explica de qué está construido el sistema, dónde corre cada
pieza y por qué se eligió así. Está escrito para leerlo de corrido, no para
consultarlo: las decisiones importan tanto como la lista de tecnologías.

Es la foto al **3 de agosto de 2026**, con el sistema en producción en Vacker
Negocios Inmobiliarios y quince vendedores usándolo todos los días.

---

## 1. La forma general

El sistema son **tres aplicaciones** que comparten código y una base de datos:

| Aplicación | Qué es | Dónde corre |
| --- | --- | --- |
| **API** | El cerebro. Toda la lógica de negocio y el único que habla con la base | Render |
| **Web** | El producto que usan las inmobiliarias | Vercel |
| **Sitio** | La página comercial, para vender | Vercel |

La regla que ordena todo lo demás: **la lógica de negocio vive en la API y en
ningún otro lado.** La web no calcula comisiones ni decide quién ve qué; se lo
pregunta a la API. Eso es lo que permite que mañana una aplicación de teléfono
nativa se conecte a lo mismo sin reescribir nada.

Las tres viven en un solo repositorio —un *monorepo*— junto a cuatro paquetes
de código compartido:

- **`types`** — las formas de los datos y sus reglas de validación. Lo usan la
  API y la web, así que es imposible que una espere un campo que la otra no
  manda.
- **`domain`** — los cálculos del negocio puros: valor por metro cuadrado,
  comisiones, semanas del protocolo. Sin base de datos ni pantallas de por
  medio, se pueden probar solos.
- **`ui`** — los colores, la tipografía y los componentes visuales.
- **`config`** — la configuración de las herramientas.

Un solo repositorio significa que un cambio que toca la API y la web viaja en
un solo commit y se revisa junto. Con repositorios separados, esa coordinación
es manual y falla.

---

## 2. Un solo lenguaje: TypeScript

Todo el sistema está escrito en **TypeScript**, de la base de datos a la
pantalla. No es una preferencia estética.

TypeScript es JavaScript con **tipos**: se declara qué forma tiene cada dato, y
la computadora verifica antes de publicar que nadie la esté usando mal. Si un
campo se llama `valorRecomendado` y alguien escribe `valor_recomendado`, no
compila. Ese error, en un lenguaje sin tipos, aparece recién cuando un vendedor
abre la pantalla.

Que sea **el mismo** lenguaje en las tres aplicaciones tiene un efecto
concreto: la definición de qué es una tasación se escribe **una vez**, en
`packages/types`, y la usan la API para validar lo que entra y la web para
saber qué mostrar. No hay dos versiones que se desincronizan.

---

## 3. La infraestructura: dónde corre cada cosa

| Pieza | Servicio | Plan hoy | Qué pasa si se cae |
| --- | --- | --- | --- |
| API | Render | Gratis | El producto no responde. El sitio comercial sigue en pie |
| Web y Sitio | Vercel | Hobby | Cada uno cae por separado |
| Base de datos | Supabase (PostgreSQL) | Gratis | Se cae todo |
| Identidad | Supabase Auth | Gratis | Nadie puede entrar |
| Archivos | Supabase Storage | Gratis | No se ven fotos ni informes |
| Correo | Resend | Gratis | No salen los avisos |

Dos cosas para tener presentes de los planes gratuitos:

**Render duerme la API por inactividad.** El primer pedido después de un rato
tarda unos cuarenta segundos en despertar. Hay un ping que la mantiene
despierta, pero solo en días hábiles: el plan da 750 horas de instancia al mes
y pasarse **suspende el servicio entero**, no solo la API.

**Supabase gratis no hace copias de seguridad automáticas.** Es la exposición
más seria que queda abierta hoy, y el argumento principal para pasar a Pro —
por encima del rendimiento.

El sitio comercial se desplegó a propósito **aparte** del producto. Dentro del
producto viven los datos de un cliente real; sumarle tráfico anónimo y un
formulario abierto sería agrandarle la superficie de ataque al único sistema
que no se puede caer.

---

## 4. La base de datos

**PostgreSQL**, una base relacional con cuarenta años de historia y la opción
por defecto cuando los datos importan. Hoy tiene **16 tablas** y **19
migraciones** —cada migración es un cambio de estructura versionado en el
repositorio, así que la forma de la base es reproducible desde cero.

Las tablas centrales:

- **`tenant`** — cada inmobiliaria.
- **`usuario`** y **`usuario_rol`** — las personas y qué puede hacer cada una.
- **`operacion`** y **`operacion_punta`** — las ventas y alquileres, con quién
  captó y quién vendió.
- **`tasacion`**, **`tasacion_comparable`**, **`tasacion_foto`** — el Tasador.
- **`protocolo`** y **`protocolo_accion`** — las cinco semanas y sus 29 acciones.

### El aislamiento entre inmobiliarias

Esta es la decisión estructural más importante del sistema, y conviene
entenderla bien.

Todas las inmobiliarias comparten la misma base de datos. Lo que impide que
una vea los datos de otra **no es el código de la aplicación**: es la base de
datos misma, con una función de PostgreSQL que se llama **Row-Level Security**
(seguridad a nivel de fila).

La diferencia es enorme. Si el aislamiento dependiera del código, alcanzaría
con que un programador olvide un filtro en una consulta —una línea, en
cualquiera de cientos de lugares— para que una inmobiliaria vea las
operaciones de otra. Con RLS, la base **rechaza** esa consulta aunque el
código esté mal escrito: cada conexión declara para qué inmobiliaria está
trabajando, y la base no devuelve una sola fila que no le corresponda.

Es defensa en profundidad: el código filtra igual, pero si falla, hay una
segunda barrera que no depende de que alguien se acuerde.

### Cómo se verifica que eso sea cierto

Esta parte del documento decía, hasta el 3 de agosto de 2026, que «hay una
prueba automática que lo verifica en cada cambio». Era optimista: la prueba
existía, pero **no se ejecutaba en integración continua** y comprobaba las
policies por un camino distinto del que usa la aplicación. Hoy sí es cierto, y
conviene ser preciso sobre qué se verifica.

**Se prueban las 16 tablas, por la ruta real.** El test se conecta con el mismo
cliente que la API (Prisma), a través del mismo pooler en modo transaction, y
usa el mismo servicio que declara la inmobiliaria antes de consultar — no una
copia. Si ese servicio cambia, el test cambia con él o falla.

Por cada tabla, tres comprobaciones:

- una consulta desde una inmobiliaria no trae ni una fila de la otra;
- insertar una fila con la inmobiliaria ajena es rechazado;
- modificar filas de la otra afecta cero registros.

Cada rechazo lleva su **control**: la misma fila entrando desde su propia
inmobiliaria. Sin eso, un rechazo por cualquier otro motivo —una columna
faltante, una restricción única— se leería como «el aislamiento funcionó».

**Y una prueba de concurrencia**, que es la que no se podía hacer antes:
veinte transacciones de dos inmobiliarias distintas, solapadas a propósito
sobre un lote de cinco conexiones compartidas. Es la verificación empírica de
que el contexto de una no sobrevive para que lo herede la siguiente cuando el
pooler recicla la conexión.

**Más una guardia sobre el esquema**: un test recorre el catálogo de PostgreSQL
y falla nombrando cualquier tabla que no tenga RLS habilitada, o que la tenga
sin su política. Es lo que evita que la tabla número diecisiete nazca abierta
sin que nadie lo note.

Todo eso corre en integración continua contra una base descartable levantada
para cada corrida, y **bloquea la fusión**: la rama principal tiene una regla
que exige pull request y los tres controles en verde, sin excepciones para
nadie. Un intento de escribir directamente sobre ella es rechazado por el
servidor.

Se comprobó rompiéndolo a propósito: al quitar la bajada de privilegios,
53 comprobaciones se ponen en rojo.

### Lo que todavía falta

Tres cosas, y ninguna es urgente hoy, pero omitirlas daría una imagen mejor que
la real:

**Las tablas no tienen `FORCE ROW LEVEL SECURITY`.** RLS no se aplica al dueño
de la tabla, y las dieciséis pertenecen al mismo rol con el que se conecta la
API. Hoy eso no abre ningún agujero, porque la aplicación baja sus privilegios
antes de consultar y ahí deja de ser el dueño. Pero es una red de contención
que no está puesta: si mañana una consulta se escribe sin pasar por ese camino,
nada la detiene.

**Hay dos lugares que consultan sin bajar privilegios**, y los dos son
deliberados: `auth.guard.ts:78`, que busca al usuario para averiguar a qué
inmobiliaria pertenece —todavía no hay inmobiliaria que declarar—, y
`tareas.service.ts:45,57`, el proceso del reporte semanal, que recorre todas
las inmobiliarias sin sesión de nadie. Ninguno es una fuga. El problema es que
heredan ese permiso por ser dueños de la tabla, en vez de tenerlo concedido de
forma explícita y acotada.

**La base sigue sin copias de seguridad automáticas.** Es la exposición más
seria del sistema y no tiene nada que ver con el aislamiento: se resuelve
pagando el plan Pro de Supabase.

### Prisma

Entre el código y la base hay un **ORM** llamado Prisma. Traduce entre las
tablas de PostgreSQL y los objetos de TypeScript, y genera los tipos
automáticamente a partir del esquema. Si mañana se agrega una columna, el
código que no la contempla deja de compilar.

---

## 5. La API

Construida con **NestJS**, un marco de trabajo que organiza el código en
módulos con fronteras claras. Hoy son siete módulos de negocio —tablero,
tasador, protocolo, todo, publicación, tareas y exportación— más el núcleo:
autenticación, usuarios y administración.

Es un **monolito modular**: una sola aplicación, pero partida por dentro. No
son microservicios, y es deliberado — repartir esto en servicios separados
agregaría trabajo de operación que hoy no compra nada.

La API es **REST** y está documentada con **OpenAPI**, el estándar que
describe qué endpoints existen y qué recibe cada uno.

### Las cuatro puertas que atraviesa cada pedido

Ningún pedido llega a los datos sin pasar por cuatro controles, en este orden:

1. **¿Hay sesión?** El navegador manda un token firmado por Supabase Auth. Sin
   token válido, no se avanza.
2. **¿La inmobiliaria tiene ese módulo contratado?** Cada cliente tiene sus
   módulos habilitados uno por uno. Si no contrató el Tasador, la API responde
   que no existe.
3. **¿El rol alcanza?** Cuatro roles dentro de cada inmobiliaria —vendedor,
   team leader, dirección y administrador— más el administrador de plataforma,
   que está fuera de todas.
4. **¿Los datos son de esa inmobiliaria?** Acá entra RLS.

Hay una distinción que el sistema mantiene con cuidado: **filtrar una lista y
negar un permiso son cosas distintas.** Un vendedor que abre el listado de
operaciones ve solo las suyas —eso es filtrar—; un vendedor que intenta abrir
la operación de otro recibe un rechazo —eso es negar—. Mezclarlas produce dos
errores clásicos: mostrar de más, o devolver "no existe" cuando la respuesta
correcta es "no te corresponde".

### La validación

Todo lo que entra a la API se valida con **Zod**, una librería que describe la
forma esperada de un dato y rechaza lo que no encaje. Los mismos esquemas se
usan en la web para validar los formularios antes de enviarlos: se escriben
una vez y valen en los dos lados.

---

## 6. El frontend

**Next.js** con React. Renderiza en el servidor lo que se puede —las páginas
llegan armadas, no en blanco esperando datos— y en el navegador lo que hace
falta que sea interactivo.

Es una **PWA**: se instala en el teléfono desde el navegador, con su ícono en
la pantalla de inicio, sin pasar por App Store ni Google Play. Fue lo que puso
el sistema en el teléfono de los quince vendedores el mismo día, sin esperar
la revisión de una tienda.

Una regla que vale la pena conocer porque costó descubrirla: **ningún campo de
formulario puede tener letra menor a 16 píxeles en el teléfono.** Con menos,
iOS agranda la pantalla al enfocar el campo, la ventana visible se achica y la
página entera se puede arrastrar de costado. Pasaba en todos los módulos a la
vez y la causa era esa. Hoy hay una prueba que lo impide.

---

## 7. El camino de un pedido, punta a punta

Un vendedor marca una acción del protocolo como hecha, desde el teléfono:

1. La **web** valida el dato con Zod y lo manda a la API con el token de sesión.
2. La **API** verifica el token, que la inmobiliaria tenga el Protocolo
   contratado, y que el rol alcance.
3. Abre una conexión a la base **declarando para qué inmobiliaria trabaja** y
   bajando sus propios privilegios.
4. **PostgreSQL** aplica RLS: solo deja tocar filas de esa inmobiliaria.
5. La API recalcula las alertas —qué quedó vencido, si la autorización está por
   caer— con las funciones puras de `domain`.
6. Devuelve el estado nuevo, y la pantalla se actualiza.

El lunes siguiente, una tarea programada recorre las inmobiliarias que tienen
el módulo, arma el reporte, genera el PDF y lo manda por correo a la dirección.
Nadie tuvo que entrar a pedirlo.

---

## 8. Documentos y correo

Los informes en PDF —tasación, comercialización, reporte semanal— se generan
**en la API**, con la marca de cada inmobiliaria, usando `@react-pdf/renderer`.
Se arman con el mismo lenguaje que las pantallas.

Un detalle que costó una vez: la tipografía va incrustada, y **un solo carácter
que la fuente no tenga arrastra una segunda tipografía** al documento. Un ✓ en
una tira de semanas metía Helvetica dentro de un informe de marca. Hay una
prueba que mide qué fuentes **dibuja** el PDF, no cuáles declara.

El correo sale por **Resend**, desde un subdominio propio y verificado. Se usa
para el reporte de los lunes y para las consultas del sitio comercial.

---

## 9. Las integraciones

**Tokko Broker** — el CRM que usan las inmobiliarias. La integración es de
**solo lectura**: trae las propiedades publicadas con sus fotos, su precio y el
vendedor que las captó, vinculado por correo electrónico. Publicar en los
portales lo sigue haciendo Tokko.

> Hay un camino de escritura en Tokko, y **tiene una trampa documentada**: el
> archivo que se le manda se interpreta como el inventario completo, así que
> enviar cinco propiedades daría de baja las otras trescientas ochenta y cuatro
> que la inmobiliaria tiene publicadas. Por eso no está en uso.

**Google Calendar** — espejo de solo lectura para el módulo To Do. Cada usuario
ve únicamente su calendario principal. El sistema no escribe eventos: fue una
decisión de alcance, no una limitación.

---

## 10. Las pruebas y la publicación

**559 pruebas automáticas** de unidad e integración, más las de navegador y las
de aislamiento.

| Tipo | Herramienta | Qué cubre |
| --- | --- | --- |
| Unidad e integración | Vitest | Cálculos, permisos, plantillas de PDF, correos |
| API | Supertest | Los endpoints de punta a punta |
| Navegador | Playwright | Lo que se ve, en Chromium y **WebKit** |
| Aislamiento | Vitest + Postgres + PgBouncer | Las 16 tablas por la ruta real (ver sección 4) |

WebKit —el motor de Safari— está incluido a propósito: el problema del zoom en
iOS solo aparece ahí. Probar en un solo navegador no lo habría detectado.

Cada cambio pasa por **integración continua** antes de llegar a la rama
principal: una máquina limpia baja el proyecto, revisa el estilo del código,
verifica los tipos, corre todas las pruebas, abre navegadores de verdad y
levanta una base de datos descartable para comprobar el aislamiento.

**Y no es una recomendación: es un bloqueo.** La rama principal tiene una regla
que exige pull request, los tres controles en verde, y la rama al día respecto
de lo último que se fusionó. Sin excepciones para nadie, ni para el dueño del
repositorio. Un intento de escribir directamente sobre ella lo rechaza el
servidor:

```
remote: - Changes must be made through a pull request.
remote: - 3 of 3 required status checks are expected.
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```

La rama principal está siempre lista para desplegar, y de ahí Render y Vercel
publican solos.

Las pruebas de navegador **nunca** tocan la base productiva: corren con
variables de entorno falsas a propósito. La base no tiene copias automáticas;
un test que escriba ahí no se deshace.

---

## 11. Los límites conocidos

Están asumidos, no ignorados. Cada uno tiene su motivo y su fecha.

**Las listas traen como máximo 500 filas** y los indicadores se suman **en
memoria** en lugar de en la base. Alcanza de sobra para el volumen actual y no
escala más allá. Lo que cambió es que el tope ya no es mudo: cuando una lista
se recorta, la pantalla lo avisa.

**La API corre en Estados Unidos** y los usuarios están en Argentina. La
latencia está mitigada, no resuelta; la causa de fondo es dónde corre la API, y
se resuelve con la migración de infraestructura.

**Faltan pruebas de navegador con sesión iniciada**, que necesitan una base de
pruebas separada de la productiva.

---

## 12. Lo que cuesta hoy, y qué cambia al crecer

Hoy la infraestructura cuesta **cero**. Todo corre en planes gratuitos. Eso
tiene tres consecuencias que hay que mirar de frente:

1. **Sin copias de seguridad automáticas** en la base. Es lo primero que hay
   que resolver, y no por rendimiento.
2. **El plan Hobby de Vercel es de uso no comercial.** En cuanto la plataforma
   se cobre, hay que pasar a Pro.
3. **Render suspende el servicio si se pasa de 750 horas** mensuales.

El camino previsto es Supabase Pro por las copias, y después mover la API a un
servidor en São Paulo para bajar la latencia. Ninguno de los dos bloquea la
operación de hoy.

---

*Inmobiliaria Inteligente · Resumen técnico · 3 de agosto de 2026*
