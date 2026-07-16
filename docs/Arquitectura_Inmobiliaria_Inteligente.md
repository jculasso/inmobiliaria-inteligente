**VACKER**

NEGOCIOS INMOBILIARIOS

**Inmobiliaria Inteligente 2.0**

Documento preliminar de arquitectura

*Para discusión con el equipo técnico*

Versión 0.2 · borrador · Julio 2026

> **Nota de versión (v0.2).** Se incorpora la sección 19 «Plan de pasaje a CODE — Fase 1 (MVP productivo)», que define un enfoque pragmático de arranque con hosting y base de datos gratuitos, respetando los principios de la arquitectura objetivo (API-first, multi-tenant con RLS, RBAC, TypeScript full-stack). Se actualizan el roadmap (sección 16) y las decisiones abiertas (sección 17) marcando las que quedan cerradas para esta fase, y se suma el módulo **To Do List** (agenda por vendedor/Team Leader sincronizada con Google Calendar) al catálogo de módulos.

**Contenido**

1. Resumen ejecutivo

2. Alcance y objetivos

3. Actores, roles y canales

4. Requisitos no funcionales

5. Visión general de la arquitectura

6. Estrategia multi-tenant

7. Stack tecnológico: recomendación y alternativas

8. Modularidad y diseño de la API

9. Identidad, roles y permisos (RBAC)

10. Estrategia de apps móviles

11. Modelo de datos (núcleo)

12. Facturación por uso y multi-tenant

13. Seguridad y cumplimiento

14. Observabilidad, DevOps y entornos

15. Escalabilidad y disponibilidad

16. Roadmap por fases

17. Decisiones abiertas para el equipo

18. Próximos pasos

19. Plan de pasaje a CODE — Fase 1 (MVP productivo)

1. Resumen ejecutivo

Inmobiliaria Inteligente 2.0 es la evolución del conjunto de herramientas internas de Vacker hacia una plataforma SaaS multi-tenant: un sistema único, modular y accesible desde cualquier dispositivo, pensado para ser comercializado a múltiples inmobiliarias y usado por muchos usuarios dentro de cada una.

Este documento propone una arquitectura de referencia para pasar del MVP actual (prototipos funcionales en HTML/React: home, tablero comercial y tasador de propiedades) a un sistema productivo. Presenta una recomendación concreta de stack y patrones, junto con alternativas y trade-offs, para que el equipo técnico pueda debatir y ajustar antes de comenzar el desarrollo definitivo.

Las decisiones estructurales recomendadas son: (1) una plataforma API-first con un backend de monolito modular que puede evolucionar a servicios; (2) multi-tenancy con base de datos compartida y aislamiento por fila (Row-Level Security); (3) una web responsive/PWA como canal universal más una app móvil nativa para vendedores, supervisores y dirección; (4) control de acceso basado en roles (RBAC) sensible al tenant; y (5) facturación por uso medida a nivel de tenant.

**Estrategia de arranque (v0.2): **la arquitectura objetivo descrita en este documento es el estado final. Para el pasaje inicial a CODE se adopta un subconjunto pragmático de bajo costo (ver sección 19) que respeta esos mismos principios, de modo que ninguna decisión temprana deba deshacerse al escalar. El primer entregable productivo es el **backend + el módulo Tablero Comercial** sobre la web, seguido por la Home autenticada; luego la app móvil; y más adelante el Tasador y el To Do List a medida que maduren sus MVP.

**Naturaleza del documento: **es un borrador para discusión. No fija un stack de forma definitiva; su objetivo es alinear criterios y dejar registradas las decisiones abiertas antes de escribir código.

2. Alcance y objetivos

El sistema debe cubrir varios módulos de negocio (comenzando por Tablero Comercial y Tasador de Propiedades, y sumando To Do List, CRM, Documentación y otros en el futuro), bajo una experiencia unificada y con acceso gobernado por el rol de cada usuario.

Objetivos principales

- Plataforma única con módulos que comparten identidad, diseño y datos, evitando silos y re-logins.

- Multi-tenant: cada inmobiliaria (tenant) opera de forma aislada y segura sobre la misma plataforma.

- Acceso multi-dispositivo: navegador en PC, notebook, tablet y móvil, más apps nativas iOS/Android para roles comerciales.

- Acceso por rol: vendedor, supervisor de ventas y dirección/CEO ven y hacen solo lo que su perfil habilita.

- Operación de backend para la administración de la plataforma: gestión de tenants, soporte y facturación por uso.

- Extensibilidad: agregar módulos nuevos sin rediseñar el núcleo.

Fuera de alcance de este documento

No se incluye el diseño detallado de cada módulo funcional ni el modelo de datos exhaustivo; se define el marco arquitectónico. El detalle funcional continúa madurando en el MVP.

3. Actores, roles y canales

La plataforma distingue dos planos: los usuarios de cada inmobiliaria (plano tenant) y los usuarios de la plataforma que la operan y facturan (plano plataforma / backend administrativo).

Actores y ámbito

| **Actor** | **Ámbito** | **Accede principalmente a** | **Ejemplos de permisos** |
| --- | --- | --- | --- |
| **Agente / Vendedor** | Tenant | Tasador, sus operaciones y sus clientes | Crear tasaciones, gestionar su cartera |
| Team Leader | Tenant | Tablero de su equipo, tasaciones del equipo | Ver KPIs, reasignar, aprobar captaciones |
| **Dirección / CEO** | Tenant | Todos los módulos y KPIs globales del tenant | Configurar objetivos, visión total |
| **Administración (****tenant**** ****admin****)** | Tenant | Usuarios, roles y plan del tenant | Alta/baja de usuarios, gestión de suscripción |
| **Soporte / ****Admin**** de plataforma** | Plataforma | Backoffice: todos los tenants (con control) | Gestión de tenants, soporte, impersonación auditada |
| **Finanzas / Facturación** | Plataforma | Medición de uso, planes y cobranzas | Emitir facturas, ver consumo por tenant |

Canales de acceso

- Web responsive (PWA): canal universal para todos los módulos y roles, desde cualquier dispositivo con navegador.

- Apps móviles nativas (iOS/Android): foco en el trabajo de campo del vendedor, el seguimiento del supervisor y los tableros de dirección, con notificaciones push y uso offline parcial.

- Backoffice de plataforma: aplicación interna para la operación comercial y administrativa del SaaS.

4. Requisitos no funcionales

Los siguientes objetivos guían las decisiones de arquitectura. Son metas iniciales, a validar y ajustar con el equipo.

| **Categoría** | **Objetivo de referencia** |
| --- | --- |
| **Disponibilidad** | 99,9% objetivo, con degradación elegante ante fallos parciales |
| **Rendimiento** | Latencia P95 < 300 ms en operaciones de lectura de la API |
| **Escalabilidad** | Crecer en tenants y usuarios sin rediseño (escalado horizontal) |
| **Multi-dispositivo** | Experiencia consistente en web responsive y apps nativas |
| **Aislamiento** | Separación estricta de datos entre tenants |
| **Seguridad** | Cifrado en tránsito y reposo, MFA, mínimo privilegio |
| **Cumplimiento** | Ley 25.326 (Protección de Datos Personales, AR) y buenas prácticas tipo GDPR |
| **Observabilidad** | Trazabilidad extremo a extremo (logs, métricas, trazas) |
| **Mantenibilidad** | Base de código modular, tipada y con pruebas automatizadas |

> **Aplicabilidad por fase.** Estos objetivos corresponden al estado productivo con tenants pagos. En la Fase 1 gratuita (sección 19) se aceptan explícitamente concesiones —cold starts del hosting free y pausa por inactividad de la base de datos— porque el objetivo de esa fase es validar con un único tenant (Vacker), no cumplir el SLA de disponibilidad. El 99,9% es un disparador de la fase de escala.

5. Visión general de la arquitectura

La plataforma se organiza en capas: canales de cliente, una capa de borde que concentra el acceso, servicios de aplicación modulares protegidos por identidad y acceso, y una capa de datos. Servicios transversales (observabilidad, CI/CD, infraestructura como código, backups y gestión de secretos) atraviesan todo el sistema.

*Figura 1. Arquitectura lógica de alto nivel.*

El principio rector es API-first: toda la funcionalidad se expone a través de una API bien definida, de modo que web, apps móviles y backoffice sean clientes de la misma capa de servicios. Esto evita duplicar lógica de negocio por canal y facilita agregar módulos y clientes nuevos.

6. Estrategia multi-tenant

Multi-tenancy es la característica central: una sola plataforma sirve a muchas inmobiliarias manteniendo sus datos y su configuración aislados. Hay tres modelos habituales, que pueden convivir.

| **Modelo** | **Descripción** | **Ventajas** | **Contras** |
| --- | --- | --- | --- |
| **Pooled**** (recomendado)** | BD compartida; cada fila lleva tenant_id; aislamiento por Row-Level Security | Costo eficiente, operación simple, escala a muchos tenants | Aislamiento lógico (no físico); exige rigor en RLS |
| **Bridge** | Un esquema de BD por tenant en una misma instancia | Mejor aislamiento; migraciones por tenant | Más complejidad operativa; límite práctico de esquemas |
| **Silo** | BD o infraestructura dedicada por tenant | Aislamiento máximo; ideal para enterprise/regulados | Costo y operación altos; no escala a muchos tenants chicos |

**Recomendación: **comenzar con el modelo pooled (PostgreSQL + Row-Level Security), que ofrece el mejor equilibrio costo/simplicidad para captar muchas inmobiliarias. Diseñar desde el inicio con tenant_id en todas las entidades y reglas RLS, dejando la puerta abierta a promover a un modelo silo a clientes grandes que lo requieran, sin cambiar el modelo de datos.

> **Decisión para Fase 1.** El modelo pooled + RLS se implementa desde el día 1, aun con Vacker como único tenant. Es baratísimo hacerlo al inicio y muy costoso de retrofitear. La base de datos gestionada elegida para arrancar (PostgreSQL de Supabase, sección 19) soporta RLS de forma nativa.

7. Stack tecnológico: recomendación y alternativas

La recomendación prioriza un ecosistema unificado en TypeScript (web, móvil y backend comparten lenguaje y parte de la lógica), reaprovechando el trabajo en React del MVP. Todas las alternativas listadas son válidas; la elección final depende de las preferencias y experiencia del equipo.

| **Capa** | **Recomendación** | **Alternativas** | **Notas** |
| --- | --- | --- | --- |
| **Frontend**** web** | React + Next.js (TypeScript), PWA | Angular, Vue/Nuxt, SvelteKit | Reutiliza el React del MVP; SSR/SEO y PWA |
| **Design**** ****system** | Librería propia (tokens rojo Vacker) sobre Tailwind + Radix | MUI, Chakra UI | Consistencia entre módulos y canales |
| **Backend**** / API** | Node + NestJS (TS), monolito modular | Django/DRF (Python), .NET, Rails | Un lenguaje full-stack; extraer servicios luego |
| **Estilo de API** | REST + OpenAPI | GraphQL, tRPC | BFF para móvil si conviene optimizar payloads |
| **Base de datos** | PostgreSQL + Row-Level Security | MySQL/MariaDB, Aurora | RLS clave para el aislamiento multi-tenant |
| **Caché / colas** | Redis + BullMQ | RabbitMQ, AWS SQS | Jobs async: PDF, metering, emails |
| **Almacenamiento** | Object storage S3-compatible | GCS, Azure Blob | PDFs de tasación, fotos, adjuntos |
| **Identidad / ****Auth** | Keycloak (self-host) o Auth0 / Cognito | Clerk, WorkOS, Supabase Auth | OIDC/OAuth2, multi-tenant, SSO y MFA |
| **Apps móviles** | React Native (Expo) | Flutter, nativo puro, PWA | Comparte TS y dominio con la web |
| **Infraestructura** | Contenedores en AWS (ECS Fargate) + Terraform | GCP / Azure, Kubernetes | IaC desde el día 1; K8s si crece la complejidad |
| **CI/CD** | GitHub Actions | GitLab CI, CircleCI | Pipelines por entorno con despliegue automatizado |
| **Pagos / ****billing** | Stripe (Billing + usage) + AFIP (factura AR) | Mercado Pago, Paddle | Suscripción + medición de uso |
| **Observabilidad** | OpenTelemetry + Grafana (Loki/Tempo) | Datadog, New Relic, ELK | Trazas, métricas y logs correlacionados |

> **Mapa objetivo → Fase 1.** El stack de esta tabla es el objetivo productivo. En la Fase 1 gratuita (sección 19) se usa una implementación equivalente y de costo cero que preserva las mismas piezas: NestJS (idéntico) para el backend, PostgreSQL + RLS servido por Supabase (que además aporta Auth OIDC y storage S3-compatible), Next.js en Vercel para la web, y despliegue del backend en Render. La caché/colas (Redis) y la observabilidad avanzada se difieren a la fase de escala.

8. Modularidad y diseño de la API

Se recomienda arrancar con un monolito modular: un único despliegue de backend organizado internamente en módulos con fronteras claras (Tasador, Tablero, To Do List, Núcleo de plataforma, Facturación, Notificaciones). Esto entrega velocidad de desarrollo y simplicidad operativa en las primeras fases, evitando la complejidad prematura de microservicios.

Cada módulo expone su sección de la API bajo un contrato OpenAPI versionado, comparte el núcleo (tenants, usuarios, roles, catálogo de propiedades) y publica eventos de dominio hacia una cola para procesos asíncronos y para la medición de uso. Cuando un módulo justifique escalar o desplegarse por separado, se lo extrae como servicio independiente sin reescribir su lógica.

- Contratos primero: la API se define con OpenAPI y de ahí se generan clientes tipados para web y móvil.

- Versionado explícito para no romper apps ya instaladas en dispositivos.

- Eventos de dominio (por ejemplo, "tasación generada", "operación cerrada") alimentan tableros, notificaciones y facturación por uso.

- API pública / webhooks para integraciones de terceros y extensibilidad.

9. Identidad, roles y permisos (RBAC)

La autenticación se resuelve con un proveedor de identidad basado en OIDC/OAuth 2.0 que emite tokens JWT con el tenant y los roles del usuario. La autorización usa RBAC sensible al tenant: los permisos se evalúan siempre en el contexto de la inmobiliaria a la que pertenece el usuario, y las consultas a datos quedan acotadas por RLS.

Matriz de acceso por rol (ejemplo inicial)

| **Rol** | **Tablero** | **Tasador** | **To Do List** | **Usuarios/****Config** | **Facturación** |
| --- | --- | --- | --- | --- | --- |
| **Agente / Vendedor** | Propio | Crear/editar propias | Propio (su agenda) | — | — |
| Team Leader | Equipo | Ver equipo | Equipo (agenda propia + visibilidad del equipo) | — | — |
| **Dirección / CEO** | Total (tenant) | Total (tenant) | Total (tenant) | Ver | Ver |
| **Admin**** del ****tenant** | Ver | Ver | Ver | Gestionar | Gestionar plan |
| **Admin**** de plataforma** | Soporte | Soporte | Soporte | Global | Global |

Recomendaciones: aplicar MFA al menos para roles con privilegios (dirección, administración), soportar SSO para inmobiliarias que lo requieran, y registrar en auditoría los accesos y las acciones sensibles (incluida la impersonación de soporte).

> **Decisión para Fase 1 — identidad: comprar/gestionado.** En lugar de operar Keycloak self-host desde el inicio, se arranca con un proveedor gestionado (Supabase Auth) para eliminar carga de DevOps y aprovechar su integración nativa con RLS de PostgreSQL. La lógica de autenticación se mantiene detrás de una capa de abstracción para poder migrar a Keycloak o Auth0 más adelante sin tocar los módulos de negocio.

10. Estrategia de apps móviles

El requisito es doble: acceso web desde cualquier dispositivo y apps dedicadas para vendedor, supervisor y CEO en Android e iOS. Se comparan los enfoques principales.

| **Enfoque** | **Ventajas** | **Contras** |
| --- | --- | --- |
| **PWA (web instalable)** | Un solo código; despliegue inmediato; sin tiendas | Límites en iOS (push, hardware, background) |
| **React**** Native (recomendado)** | Experiencia nativa; comparte TS/dominio con la web; push y offline | Requiere builds y publicación en tiendas |
| **Flutter** | Alto rendimiento y UI muy pulida | Otro lenguaje (Dart); no reaprovecha React |
| **Nativo puro (Swift/****Kotlin****)** | Máximo control y rendimiento | Doble base de código; mayor costo y tiempo |

**Recomendación: **estrategia en dos tiempos. Primero, una web responsive/PWA que ya cubre todos los dispositivos y permite validar rápido. Luego, una app en React Native (Expo) para los roles de campo, compartiendo la capa de dominio en TypeScript y sumando notificaciones push y modo offline parcial. Se evita mantener dos apps nativas separadas.

> **Decisión para Fase 1 — la app va después de la PWA.** El orden de CODE (sección 19) construye primero la web responsive/PWA con Home + Tablero, y recién después inicia la app React Native, reutilizando la capa de dominio ya probada.

11. Modelo de datos (núcleo)

El modelo se ancla en el tenant. Toda entidad de negocio referencia a un tenant y queda sujeta a RLS. Las entidades centrales iniciales son:

- Tenant (inmobiliaria): datos, plan contratado, configuración y marca.

- Usuario: pertenece a un tenant, con uno o más roles; credenciales gestionadas por el proveedor de identidad.

- Rol y Permiso: definición de qué puede hacer cada perfil por módulo.

- Propiedad: catálogo de inmuebles del tenant (base para tasaciones y operaciones).

- Tasación: informe con su historial, estado (en proceso, presentada, captada, etc.) y valores.

- Operación: venta o alquiler asociada a una propiedad y a un agente.

- Tarea / Evento (To Do List): actividad de un usuario con fecha y hora, sincronizada con su Google Calendar; base de las vistas semanales.

- Suscripción y Uso: plan del tenant y eventos de consumo para la facturación.

El estado de captación de las tasaciones —qué tasación pasó a formar parte de la oferta— ya está modelado en el MVP y se traslada al esquema definitivo como un atributo de estado con su historial de cambios.

12. Facturación por uso y multi-tenant

El negocio es un SaaS que se cobra a cada inmobiliaria. Se recomienda un modelo híbrido: una suscripción base por plan (que puede incluir una cantidad de usuarios/asientos) más componentes medidos por uso.

Medición de uso (metering)

Cada acción facturable emite un evento de dominio que se registra de forma idempotente y se agrega por tenant y período. Ejemplos de métricas: cantidad de tasaciones generadas, usuarios activos, almacenamiento de PDFs/fotos, llamadas a la API y módulos habilitados.

Planes y cobro

- Planes por niveles (por ejemplo: Básico, Profesional, Enterprise) con límites y módulos incluidos.

- Asientos por usuario más excedentes medidos por uso.

- Motor de suscripciones y facturación con Stripe Billing (suscripción + usage-based).

- Para Argentina, integración con AFIP para la emisión de factura electrónica; alternativa vía proveedor local (por ejemplo, Mercado Pago) según el circuito fiscal.

- Backoffice para gestión de planes, control de límites, dunning (reintentos de cobro) y reportes de consumo por tenant.

**Aislamiento y facturación van juntos: **el mismo tenant_id que aísla los datos es la unidad sobre la que se mide el consumo y se emite la factura.

> **Fuera de Fase 1.** La facturación es una capacidad de la fase de comercialización (Fase 4). En la Fase 1 gratuita no se implementa, pero sí se dejan emitidos los eventos de dominio que luego alimentarán el metering, para no reescribir los módulos.

13. Seguridad y cumplimiento

- Cifrado en tránsito (TLS) y en reposo (base de datos y object storage).

- Aislamiento de tenants mediante Row-Level Security y validación de tenant en cada request.

- Autenticación con OIDC, MFA para roles privilegiados y SSO opcional para empresas.

- Mínimo privilegio y gestión centralizada de secretos (no credenciales en el código).

- Registro de auditoría de accesos y acciones sensibles, incluida la impersonación de soporte.

- Protección de datos personales conforme a la Ley 25.326 (Argentina) y alineación con buenas prácticas tipo GDPR: consentimiento, minimización, derechos de acceso y borrado.

- Backups automáticos con pruebas de restauración y un plan de recuperación ante desastres (DR).

- Gestión de vulnerabilidades: análisis de dependencias, revisiones de código y pruebas de seguridad periódicas.

La estrategia de aislamiento (pooled + RLS) debe acompañarse de pruebas automatizadas que verifiquen, en cada despliegue, que ningún tenant puede acceder a datos de otro.

> **Aplicable desde Fase 1.** Aun en la fase gratuita se mantienen como innegociables: TLS, RLS con test automatizado de aislamiento entre tenants, secretos fuera del código (variables de entorno del hosting) y protección de datos personales. MFA/SSO y DR formal se activan al entrar en producción con tenants pagos.

14. Observabilidad, DevOps y entornos

- Infraestructura como código (Terraform) para entornos reproducibles: desarrollo, staging y producción.

- CI/CD con despliegues automatizados, migraciones controladas y release segura (blue/green o canary).

- Observabilidad con OpenTelemetry: logs, métricas y trazas correlacionadas, con alertas sobre indicadores clave.

- Contenedores para portabilidad; escalado horizontal de la API detrás de un balanceador.

- Pruebas automatizadas (unitarias, integración y end-to-end) como puerta de calidad en el pipeline.

> **Decisión para Fase 1 — nube diferida.** No se adopta AWS + Terraform al inicio. Se usa PaaS con free tier (Render para el backend, Vercel para la web, Supabase para datos/identidad/almacenamiento) y CI/CD con GitHub Actions. La migración a AWS + IaC es un disparador de la fase de escala, no un prerequisito para empezar a codear. Las pruebas automatizadas sí se incorporan desde el día 1.

15. Escalabilidad y disponibilidad

El diseño escala horizontalmente: la API es sin estado y crece con réplicas; PostgreSQL escala con réplicas de lectura y, más adelante, particionado por tenant si hiciera falta; los procesos pesados (PDF, agregaciones, metering) corren de forma asíncrona en colas para no impactar la experiencia interactiva. La caché (Redis) alivia lecturas frecuentes de tableros. El modelo pooled permite absorber muchos tenants pequeños con costo controlado, promoviendo a infraestructura dedicada solo a los clientes que lo justifiquen.

16. Roadmap por fases

Camino sugerido desde el MVP actual hacia el sistema definitivo. Las fases son incrementales y cada una deja valor utilizable.

| **Fase** | **Foco** | **Entregables clave** |
| --- | --- | --- |
| **Fase 0 — Actual** | Validación funcional | Prototipos HTML/React: home (3 módulos), tablero y tasador con historial y captación |
| **Fase 1 — Fundaciones (free)** | Base de plataforma sin costo | Monorepo TS, identidad + multi-tenant (RLS), design system, backend NestJS y **Tablero Comercial** productivo con datos reales; Home autenticada; hosting free (ver sección 19) |
| **Fase 2 — Núcleo comercial** | Datos reales y accesos | RBAC completo, web responsive/PWA endurecida, Tablero consolidado con objetivos y ranking en vivo |
| **Fase 3 — Movilidad** | Trabajo de campo | App React Native, notificaciones push, offline parcial |
| **Fase 4 — Módulos y comercialización** | Sumar módulos y convertirlo en SaaS | **Tasador** productivo, **To Do List** con integración Google Calendar, facturación por uso, backoffice de plataforma, onboarding self-service, planes |
| **Fase 5 — Escala** | Crecer y endurecer | Migración a AWS + IaC, nuevos módulos (CRM, Documentación), observabilidad avanzada, hardening y certificaciones |

> **Orden de los módulos.** El primer módulo productivo es el Tablero Comercial (su MVP ya está listo). El Tasador se incorpora una vez cerrado su MVP, y el To Do List una vez cerrado el suyo. El detalle de la secuencia de implementación está en la sección 19.

17. Decisiones abiertas para el equipo

Puntos a debatir y cerrar antes de iniciar el desarrollo definitivo. Se marca el estado tras la revisión v0.2.

| **Tema** | **Opciones a evaluar** | **Estado (v0.2)** |
| --- | --- | --- |
| **Proveedor de nube** | AWS (recomendado por madurez) vs GCP vs Azure | **Diferido** — arrancar en PaaS free; decidir nube al escalar |
| **Identidad: construir vs comprar** | Keycloak self-host vs Auth0 / Cognito / Supabase Auth (gestionado) | **Cerrado (Fase 1)** — comprar/gestionado (Supabase Auth), abstraído para migrar luego |
| **Momento de la app nativa** | Ahora en paralelo vs después de consolidar la PWA | **Cerrado** — después de la PWA |
| **Facturación en Argentina** | Integración AFIP directa vs proveedor local (Mercado Pago, etc.) | Abierto — se resuelve en Fase 4 |
| **Umbral monolito → microservicios** | Cuándo y qué módulos extraer primero | Abierto — revisar al final de Fase 2 |
| **Alcance del modo offline** | Qué funciones deben operar sin conexión en la app móvil | Abierto — se define en Fase 3 |
| **Residencia de datos** | Región de alojamiento y requisitos de los clientes | Abierto — revisar antes de captar tenants regulados |

18. Próximos pasos

- Revisar este documento con el equipo técnico y registrar acuerdos y objeciones.

- Cerrar las decisiones abiertas restantes de la sección 17.

- Terminar de madurar el MVP funcional (alcance de módulos, campos y flujos).

- Definir el modelo de datos detallado y los contratos de API de los primeros módulos.

- Ejecutar la Fase 1 según el plan de pasaje a CODE de la sección 19.

19. Plan de pasaje a CODE — Fase 1 (MVP productivo)

Esta sección traduce la arquitectura objetivo en un plan de arranque concreto, de costo cero, para pasar del prototipo al primer sistema productivo. La regla es: **implementar un subconjunto pragmático que respete los principios estructurales** (API-first, multi-tenant con RLS, RBAC, TypeScript full-stack) para que nada deba deshacerse al escalar.

19.1 Principio innegociable desde el día 1

Aunque Vacker sea el único tenant al inicio, se implementan desde el primer commit: (1) `tenant_id` en todas las entidades, (2) Row-Level Security en PostgreSQL, y (3) RBAC con los roles reales (vendedor, team leader, dirección, admin del tenant). Retrofitear multi-tenancy y RLS más tarde es caro y riesgoso; hacerlo al inicio es barato.

19.2 Stack de arranque (free) y su equivalencia con la arquitectura objetivo

| **Pieza** | **Fase 1 (free)** | **Rol / equivalencia objetivo** | **Notas y límites** |
| --- | --- | --- | --- |
| Base de datos + Auth + Storage | **Supabase (free)** | PostgreSQL + RLS (secc. 6, 11), Auth OIDC/JWT (secc. 9), object storage S3-compatible para PDFs (secc. 7) | Free: ~500 MB de BD, 50k usuarios activos/mes en Auth, 1 GB de storage. El proyecto se **pausa tras ~1 semana sin actividad**; se evita con un ping diario por cron. Escala: Supabase Pro (~US$25/mes) elimina la pausa, o migración a PostgreSQL gestionado/AWS |
| Backend / API | **NestJS** (idéntico al objetivo) sobre **Render (free)** | Monolito modular, contratos OpenAPI (secc. 8) | Free: 512 MB RAM, TLS y dominio incluidos; el servicio **se duerme por inactividad** y el primer request tarda ~1 min en despertar. Aceptable para demo, no para SLA |
| Frontend web | **Next.js** en **Vercel (free)** | Web responsive/PWA (secc. 7, 10); reutiliza el React del MVP | Hobby tier para Home + Tablero |
| CI/CD | **GitHub Actions** | Igual al objetivo (secc. 14) | Pipelines por entorno; pruebas como puerta de calidad |
| Caché/colas, IaC, observabilidad avanzada | **Diferidos** | Redis/BullMQ, Terraform/AWS, OpenTelemetry | Se incorporan en la fase de escala |

Nota sobre alternativas de hosting: se descartan para el arranque **Railway** (hoy es un trial de US$5, no un free tier permanente) y **Fly.io** (ya no ofrece free tier para cuentas nuevas). Para la base de datos, **Neon** es una alternativa válida (Postgres serverless con scale-to-zero), pero se prefiere Supabase porque además aporta Auth y storage en el mismo paquete, cubriendo tres piezas de la arquitectura con un solo servicio.

19.3 Secuencia de implementación

El orden respeta la estrategia acordada (backend → Home → Tablero → web → app; luego Tasador y To Do List), con la aclaración de que el núcleo de identidad/tenant/RBAC es prerequisito tanto de la Home como del Tablero.

1. **Fundaciones.** Monorepo (pnpm + Turborepo), design system con los tokens del rojo Vacker (Tailwind + Radix), configuración de CI/CD con GitHub Actions y entornos dev/prod.

2. **Núcleo del backend.** Modelo de datos con `tenant_id` + RLS; Auth (Supabase/OIDC) integrada; RBAC con los cuatro roles; contrato OpenAPI base. Test automatizado que verifique el aislamiento entre tenants.

3. **Módulo Tablero Comercial (API).** Entidades de operaciones, vendedores y objetivos; endpoints de KPIs, ranking y seguimiento de objetivos. Emisión de eventos de dominio (aunque el metering llegue después).

4. **Home autenticada (shell).** Login y visibilidad de módulos por rol; es la puerta de entrada única. La home ya diseñada (3 módulos) se convierte en el shell autenticado.

5. **Tablero web con datos reales.** Migrar el prototipo offline del tablero a consumir la API real.

6. **Endurecimiento PWA/responsive** y, a continuación, **App React Native (Expo)** reutilizando la capa de dominio en TypeScript.

7. **Tasador** (una vez cerrado su MVP) y luego **To Do List** (OAuth con Google Calendar por vendedor/Team Leader + vista semanal).

19.4 Recomendación de modelo de Claude para el desarrollo

Para un proyecto greenfield con carga arquitectónica alta conviene combinar modelos según la tarea, orquestados con Claude Code:

- **Claude Opus 4.8** — el más capaz; usarlo para el trabajo estructural: diseño del esquema con RLS multi-tenant, auth/RBAC, contratos de API, decisiones de arquitectura y debugging complejo. Arrancar cada módulo nuevo con Opus para fijar esqueleto y patrones.

- **Claude Sonnet 5** — driver del día a día para implementar tareas bien especificadas (CRUD, endpoints, componentes de UI, tests). Más rápido y económico; es donde se concentra el volumen de trabajo.

- **Claude Haiku 4.5** — ediciones triviales, renombrados y formateo.

En una frase: **arquitectura y lo difícil con Opus 4.8; la implementación rutinaria con Sonnet 5.**

19.5 Disparadores de escala

Señales que indican que llegó el momento de dejar el free tier y avanzar hacia la arquitectura objetivo:

- **Primer tenant que paga** → salir del free tier (Supabase Pro / PostgreSQL gestionado) para eliminar la pausa por inactividad y los cold starts.

- **Necesidad de SLA / disponibilidad** (acercarse al 99,9%) → migrar a AWS + IaC (Terraform) y balanceo horizontal.

- **Procesos pesados o picos** (generación masiva de PDFs, agregaciones, metering) → incorporar Redis + BullMQ.

- **Crecimiento de tenants/usuarios** → réplicas de lectura de PostgreSQL y, si hiciera falta, particionado por tenant.

- **Requisitos empresariales** (SSO, residencia de datos, auditoría avanzada) → evaluar Keycloak/Auth0 y, para clientes grandes, promoción a modelo silo.

*Documento de trabajo · **Vacker** — Inmobiliaria Inteligente 2.0 · v0.2*
