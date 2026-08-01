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

## 8. Sobre mover la API a Lightsail

La pregunta es si conviene hacerlo ahora o al vender la segunda inmobiliaria.

**Mi recomendación: ninguna de las dos. Todavía no.**

### Qué se compraría

| Opción | Costo | Memoria |
| --- | --- | --- |
| Render Free (hoy) | $0 | 512 MB, se duerme |
| Render Starter | $7 | 512 MB |
| Render Standard | $25 | 2 GB |
| Lightsail São Paulo | $12 | 2 GB |
| Lightsail São Paulo | $24 | 4 GB |

Lightsail da **más máquina por menos plata** — dos gigas por doce dólares
contra dos gigas por veinticinco. Y, sobre todo, **está en São Paulo**: la
latencia contra usuarios argentinos baja mucho respecto de un servidor en
Estados Unidos.

### Qué se pagaría a cambio

Render es un servicio administrado: se publica solo desde la rama principal,
renueva los certificados, reinicia si el proceso muere, y guarda los registros.
Lightsail es **un servidor vacío**. Pasan a ser trabajo propio:

- El despliegue en cada cambio, que hoy es automático.
- El certificado HTTPS y su renovación.
- Las actualizaciones de seguridad del sistema operativo.
- Reiniciar el proceso si se cae, y enterarse de que se cayó.
- Los registros, y dónde mirarlos cuando algo falla.

Trece dólares de ahorro mensual contra varias horas de puesta a punto y una
responsabilidad operativa permanente. **Con dos personas, y una de ellas
vendiendo, ese cambio se paga con el tiempo de la persona más cara.**

### Y la latencia, que es el motivo real

Es un motivo legítimo, pero conviene medir antes de mudarse. La latencia hoy
está mitigada por código, y **ningún usuario se quejó**. Mover la infraestructura
por un problema que nadie está reportando es optimizar a ciegas.

### Cuándo sí

Tres disparadores concretos. Cualquiera alcanza:

1. **Alguien se queja de que el sistema va lento**, y al medir se confirma que
   es la distancia y no otra cosa.
2. **La factura de Render pasa los $25** — a esa altura Lightsail da el doble
   de máquina por la mitad, y el ahorro empieza a justificar el trabajo. Pasa
   alrededor de las veinte inmobiliarias.
3. **Hay una tercera persona en el equipo** que pueda hacerse cargo de la
   operación.

Ninguno se cumple hoy. La segunda inmobiliaria vendida no es un disparador: no
cambia ni la latencia ni la carga.

### Lo que sí hay que hacer ya

**Contratar Supabase Pro. Veinticinco dólares.** No por rendimiento: por las
copias de seguridad. Es el único riesgo del que hoy no hay vuelta atrás, y no
tiene nada que ver con Lightsail.

Después, Render Starter por siete dólares para que la API deje de dormirse. Los
dos juntos cuestan **treinta y dos dólares** y resuelven lo que sí es urgente.

---

## 9. Los límites que hay que levantar antes de crecer

Son de código, no de infraestructura, y no los arregla ningún plan pago:

**Las listas traen 500 filas como máximo** y los indicadores se suman **en
memoria** en vez de en la base. Con una inmobiliaria sobra. Con veinte, la
memoria del servidor se convierte en el límite antes que cualquier plan.

Ya está agendado, y conviene que se haga **antes** de la quinta inmobiliaria:
después, cada cliente nuevo lo hace más caro de cambiar.

---

*Inmobiliaria Inteligente · Costos de infraestructura · 1 de agosto de 2026*
