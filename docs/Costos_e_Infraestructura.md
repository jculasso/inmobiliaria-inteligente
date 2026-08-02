# Costos de infraestructura

## Qué cuesta hoy y qué costaría con 5, 20 y 100 inmobiliarias

Este documento estima el costo de la infraestructura a distintas escalas,
responde qué plan cubre la autenticación y recomienda cuándo mover la API a un
servidor propio.

Los precios son los publicados al **1 de agosto de 2026**. Las proyecciones
salen de medir el consumo real de hoy, no de suponerlo.

---

## 1. De dónde salen los números

Medido sobre la base productiva, con tres inmobiliarias cargadas (una real —
Vacker, con veinte usuarios y un año de operación — y dos de demostración):

| Qué | Medido hoy |
| --- | --- |
| Base de datos completa | **15 MB** |
| La tabla más grande (`operacion`, 226 filas) | 296 kB |
| Archivos en Storage | 93 |
| Usuarios totales | 32 |

La base es **diminuta**. Ese es el dato que ordena todo lo demás: el costo de
este sistema no lo maneja la cantidad de datos sino tres cosas mucho más
chicas, y conviene tenerlas separadas.

Las estimaciones por inmobiliaria y por año, redondeadas hacia arriba:

| Recurso | Por inmobiliaria/año | De dónde sale |
| --- | --- | --- |
| Base de datos | **5 MB** | Medido: 226 operaciones ocupan 296 kB |
| Archivos | **0,5 GB** | Fotos de tasación e informes en PDF |
| Usuarios | **20** | Los que tiene Vacker |
| Tráfico de salida | **3 GB/mes** | Sobre todo fotos servidas |

---

## 2. El escenario de hoy: una inmobiliaria

| Servicio | Plan | Costo |
| --- | --- | --- |
| Supabase | Free | $0 |
| Render (API) | Free | $0 |
| Vercel (web y sitio) | Hobby | $0 |
| Resend (correo) | Free | $0 |
| **Total** | | **$0/mes** |

Funciona, pero con **tres exposiciones reales**, y conviene mirarlas de frente:

**No hay copias de seguridad.** El plan gratuito de Supabase no las hace. Si la
base se corrompe o alguien borra algo, no hay de dónde volver. Es la única
exposición seria del sistema hoy.

**La API se duerme.** El plan gratuito de Render suspende la instancia por
inactividad: el primer pedido después de un rato tarda unos cuarenta segundos.
Y el plan da 750 horas mensuales — pasarse suspende el servicio entero.

**El plan Hobby de Vercel es de uso no comercial.** Desde el momento en que la
plataforma se cobra, corresponde pasar a Pro.

### Lo que yo pagaría hoy mismo

| Servicio | Plan | Costo |
| --- | --- | --- |
| Supabase | **Pro** | $25 |
| Render | **Starter** | $7 |
| Vercel | **Pro** (1 asiento) | $20 |
| Resend | Free | $0 |
| **Total** | | **$52/mes** |

Cincuenta y dos dólares por mes eliminan las tres exposiciones: aparecen las
copias diarias con siete días de retención, la API deja de dormirse, y el
licenciamiento queda en regla para cobrar.

> Si hubiera que elegir uno solo: **Supabase Pro.** Los otros dos son
> incomodidad y trámite; ese es el único que protege de perder datos de un
> cliente.

---

## 3. Cinco inmobiliarias

Cien usuarios. Base estimada en 25 MB, archivos en 2,5 GB al año, tráfico en 15
GB por mes.

| Servicio | Plan | Costo |
| --- | --- | --- |
| Supabase | Pro | $25 |
| Render | Starter | $7 |
| Vercel | Pro | $20 |
| Resend | Free | $0 |
| **Total** | | **$52/mes** |

**No cambia nada.** Cinco inmobiliarias entran holgadas en los mismos planes:
la base usa el 0,3% de los 8 GB incluidos, los archivos el 2,5% de los 100 GB,
el tráfico el 6% de los 250 GB.

A **$10,40 por inmobiliaria por mes**, la infraestructura deja de ser un tema.

---

## 4. Veinte inmobiliarias

Cuatrocientos usuarios. Base 100 MB, archivos 10 GB al año, tráfico 60 GB por
mes.

| Servicio | Plan | Costo |
| --- | --- | --- |
| Supabase | Pro + servidor Small | $25 + $15 |
| Render | Standard | $25 |
| Vercel | Pro | $20 |
| Resend | Pro | $20 |
| **Total** | | **$105/mes** |

Los volúmenes siguen entrando en lo incluido. Lo que sube es **capacidad de
proceso**, no almacenamiento: cuatrocientas personas usando el sistema a la vez
necesitan más memoria y más conexiones simultáneas que el servidor mínimo.

Resend pasa a Pro por el volumen de correo: veinte reportes semanales más los
avisos son más de las 3.000 piezas mensuales del plan gratuito.

**$5,25 por inmobiliaria por mes.** El costo unitario baja a la mitad.

---

## 5. Cien inmobiliarias

Dos mil usuarios. Base 500 MB, archivos 50 GB al año, tráfico 300 GB por mes.

| Servicio | Plan | Costo |
| --- | --- | --- |
| Supabase | Pro + servidor Medium | $25 + $60 |
| Supabase — tráfico excedido | 50 GB × $0,09 | $5 |
| Render | Standard ×2 | $50 |
| Vercel | Pro | $20 |
| Resend | Pro | $35 |
| **Total** | | **$195/mes** |

Sigue siendo poco, y vale la pena entender por qué: **este sistema mueve texto,
no video.** Una inmobiliaria genera unos pocos megabytes de datos por año. Lo
único que pesa son las fotos, y las fotos de cien inmobiliarias siguen entrando
en el almacenamiento incluido de un plan de veinticinco dólares.

Lo que empieza a doler es el proceso, y ahí sí conviene revisar la arquitectura
— aunque antes conviene levantar los límites conocidos (ver sección 8).

**$1,95 por inmobiliaria por mes.**

---

## 6. El resumen en una tabla

| | 1 (hoy) | 1 (protegido) | 5 | 20 | 100 |
| --- | --- | --- | --- | --- | --- |
| Supabase | $0 | $25 | $25 | $40 | $90 |
| Render | $0 | $7 | $7 | $25 | $50 |
| Vercel | $0 | $20 | $20 | $20 | $20 |
| Resend | $0 | $0 | $0 | $20 | $35 |
| **Total mensual** | **$0** | **$52** | **$52** | **$105** | **$195** |
| **Por inmobiliaria** | — | $52 | $10,40 | $5,25 | $1,95 |

La infraestructura **no es el problema del negocio.** Si una inmobiliaria paga
cincuenta dólares por mes, el margen bruto sobre infraestructura es del 96% a
las veinte y del 99% a las cien. Lo que escala con el crecimiento es el soporte
y el trabajo de implementación, no el servidor.

---

## 7. La autenticación

Acá hay una confusión que conviene despejar, porque cambia los números por un
orden de magnitud.

**El sistema no usa Auth0.** Usa **Supabase Auth**, que viene incluido en el
mismo plan que la base de datos y no se cobra aparte.

Lo que se cobra en cualquier servicio de identidad son los **usuarios activos
mensuales** — personas distintas que iniciaron sesión al menos una vez en el
mes.

| Escala | Usuarios activos | Incluido en Supabase Pro | Uso |
| --- | --- | --- | --- |
| 1 inmobiliaria | 20 | 100.000 | 0,02% |
| 5 | 100 | 100.000 | 0,1% |
| 20 | 400 | 100.000 | 0,4% |
| 100 | 2.000 | 100.000 | **2%** |

**Con cien inmobiliarias se estaría usando el 2% de lo incluido.** La
autenticación es gratis a cualquier escala que este negocio vaya a alcanzar. El
plan gratuito ya incluye 50.000, así que ni siquiera hoy se paga por eso.

### Qué costaría con Auth0

Vale la pena tener el número para saber qué se está ahorrando. Auth0 cobra por
tramos de usuarios activos, y un producto vendido a empresas cae en la tabla
B2B:

| Escala | Usuarios activos | Auth0 B2B Essentials |
| --- | --- | --- |
| 5 inmobiliarias | 100 | $150/mes |
| 20 | 400 | ~$150/mes |
| 100 | 2.000 | ~$700/mes |

Con cien inmobiliarias, Auth0 costaría **más de tres veces toda la
infraestructura actual junta**, para hacer lo mismo que ya se hace gratis.

### ¿Y si algún día hiciera falta?

La autenticación está detrás de una **capa de abstracción propia**: el código
de negocio no habla con Supabase Auth directamente, sino con una interfaz del
sistema. Cambiar de proveedor —a Auth0, a Keycloak, a lo que sea— es reemplazar
esa capa, no reescribir la aplicación.

Eso se decidió al principio y sigue siendo la decisión correcta. Pero **no hay
ningún motivo económico ni técnico para ejercerla.** Los motivos que llevarían
a Auth0 serían funcionales —inicio de sesión con la cuenta corporativa del
cliente, certificaciones de cumplimiento que un cliente grande exija— y no
aparecen en el horizonte de este negocio.

---

## 8. La API se queda en Render — decidido

**Decisión tomada el 1 de agosto de 2026: no se migra a un servidor propio.**
Ni ahora ni al vender la segunda inmobiliaria.

El motivo no es el costo. Lightsail sale más barato por unidad de memoria — dos
gigas por doce dólares contra veinticinco en Render — y está en São Paulo, que
bajaría la latencia. El motivo es **quién hace el trabajo**.

Lightsail es un servidor vacío. Pasarían a ser trabajo propio el despliegue en
cada cambio, el certificado HTTPS y su renovación, las actualizaciones de
seguridad del sistema operativo, reiniciar el proceso si se cae y enterarse de
que se cayó, y los registros cuando algo falla. Hoy Render hace todo eso.

Trece dólares de ahorro mensual contra una responsabilidad operativa
permanente. Con dos personas —y una de ellas vendiendo— ese cambio se paga con
el tiempo de la persona más cara. **El criterio queda fijado: mientras el
equipo sean dos, la infraestructura se contrata administrada.**

### Lo que esta decisión deja abierto

**Render no tiene región en Sudamérica.** Sus regiones son Oregon, Ohio,
Virginia, Frankfurt y Singapur. Quedarse en Render significa que la API sigue
corriendo en Estados Unidos, y **la latencia queda como está**.

Y acá hay una precisión que la primera versión de este documento no hacía. El
problema no es solo que el usuario esté lejos del servidor: **la API está lejos
de su propia base de datos.** La base está en São Paulo (`sa-east-1`); la API,
en Estados Unidos.

Medido desde Rosario el 1/08/2026:

| Destino | Ida y vuelta |
| --- | --- |
| Base de datos — Supabase, São Paulo | ~40 ms |
| API — Render, Estados Unidos | ~235 ms, a un pedido que no hace nada |

Una sola pantalla dispara varias consultas, y hoy **cada una cruza el
continente y vuelve**. Ese viaje repetido pesa más que el del usuario al
servidor, que ocurre una vez por pantalla.

Hoy no molesta: está mitigado por código y nadie se quejó. Pero cambia cuál es
el plan si algún día molesta — y lo hace más chico de lo que parecía.

### La base NO se mueve

Podría pensarse en traer la base a Estados Unidos, al lado de la API. **Sería
un error**, por tres motivos en orden de peso:

1. **Lo que importa es que estén juntas**, y eso se consigue de las dos formas.
   El viaje entre ambas pasa de ~110 ms a menos de 1 ms en cualquiera de los
   dos casos. Ese es el grueso de la mejora.
2. **Elegido el lugar, São Paulo le gana por seis veces.** Los usuarios están
   en Argentina: 40 ms contra 235. Llevar todo a Estados Unidos arreglaría el
   viaje interno y empeoraría el del usuario.
3. **La API no guarda nada; la base sí.** Mover la API es volver a publicarla,
   y si sale mal se revierte en minutos. Mover la base es migrar los datos, los
   usuarios de autenticación con sus contraseñas y los archivos de Storage, con
   corte de servicio y —hoy— sin copias de seguridad. No se parecen ni en
   riesgo ni en esfuerzo.

**La base está donde tiene que estar. La API es la pieza descolocada.**

### Si la latencia llegara a molestar

Primero **medir**, no mudarse. Confirmar que la demora es la distancia y no una
consulta lenta o una pantalla que pide de más — que es lo más probable, y se
arregla sin tocar infraestructura.

Si de verdad fuera la distancia, la salida coherente con la decisión de arriba
es **otra plataforma administrada que sí tenga São Paulo**, no un servidor
propio. Google Cloud Run está en `southamerica-east1` y es igual de
administrada que Render: se paga por uso y no hay servidor que mantener.

La comparación se hace en ese momento y con el problema medido. Lo que queda
descartado, por decisión y no por precio, es administrar un servidor.

## 9. Los límites que hay que levantar antes de crecer

Son de código, no de infraestructura, y no los arregla ningún plan pago:

**Las listas traen 500 filas como máximo** y los indicadores se suman **en
memoria** en vez de en la base. Con una inmobiliaria sobra. Con veinte, la
memoria del servidor se convierte en el límite antes que cualquier plan.

Ya está agendado, y conviene que se haga **antes** de la quinta inmobiliaria:
después, cada cliente nuevo lo hace más caro de cambiar.

---

*Inmobiliaria Inteligente · Costos de infraestructura · 1 de agosto de 2026*
