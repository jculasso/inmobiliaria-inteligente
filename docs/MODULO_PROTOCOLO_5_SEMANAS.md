# Módulo "Protocolo 5 Semanas" — especificación

> Fuentes: `Inmobiliaria Inteligente_protocolo comercial.docx` (brief) y
> `Protocolo_Vacker_5_Semanas_Corregido.html` (prototipo de UX + informe).
> El HTML es **referencia de UX y lógica**, no código productivo (CLAUDE.md §1).

## 1. Qué es

Seguimiento de la comercialización de una propiedad durante 5 semanas, con un
checklist de 29 acciones, métricas comerciales, alertas por atraso y un informe
PDF que el vendedor / team leader / CEO usa para reunirse con el propietario.

Entrada al módulo: las tasaciones en estado **Captada**. Un botón "Iniciar
protocolo" crea la ficha y la propiedad pasa a estar **Activa**.

## 2. Decisiones cerradas (25/07/2026)

| Tema | Decisión |
|---|---|
| Estado "Activa" | Ficha **`Protocolo` aparte** (estado propio: `activa` \| `archivada`), 1:1 con la tasación. La tasación **queda en Captada** → no se tocan los KPIs del Tasador (tasa de captación, ranking) ni el historial de estados. En pantalla la propiedad se muestra como "Activa". |
| Checklist | **Fijo en código**, igual para todos los tenants (las 29 acciones del HTML). Configurable por tenant queda para más adelante. |
| Datos faltantes | Se piden en el **modal "Iniciar protocolo"**, con sugeridos: precio = `valorRecomendado` de la tasación; vencimiento = calculado según `exclusividad`; propietario = `tasacion.cliente`. No se toca el formulario del Tasador. |
| Licenciamiento | **4 checks independientes** por tenant (tablero, tasador, todo, protocolo). `plan` queda como etiqueta comercial informativa, sin efecto en permisos. |

## 3. Modelo de datos

```prisma
model Protocolo {
  id, tenantId, tasacionId @unique, agenteId      // agenteId = responsable, copiado al iniciar
  fechaInicio  Date                                // = día en que se inicia el protocolo
  estado       String @default("activa")           // activa | archivada

  // pedidos al iniciar
  precioPublicado Decimal?  / moneda String @default("USD")
  propietarioNombre / propietarioTelefono / propietarioEmail String?
  vencimientoAutorizacion Date?

  // métricas comerciales (editables en cualquier momento)
  consultas, consultasCalificadas, visitas, interesadosActivos, ofertas  Int @default(0)

  // análisis (semana 5)
  devolucionesMercado, objeciones, recomendacion,
  decisionPropietario, proximasAcciones  String?

  // archivo
  archivadoEn Date? / motivoArchivo String? / observacionArchivo String?

  acciones ProtocoloAccion[]
}

model ProtocoloAccion {
  id, protocoloId, tenantId
  semana Int / orden Int / clave String        // clave = slug estable del template
  titulo String                                 // copiado al crear (histórico)
  estado String @default("pendiente")           // pendiente | en_proceso | realizada | no_corresponde
  fechaPrevista Date? / fechaRealizada Date?
  observaciones / resultado / evidencia  String?
}
```

**RLS**: ambas tablas con `tenant_id`, policy `tenant_isolation` + lockdown de
grants, accedidas vía `TenantPrismaService.withTenant` (ver memoria
`patron-rls-multitenant`). Test de aislamiento obligatorio (CLAUDE.md §2).

## 4. Reglas de negocio (del prototipo)

- **Semana actual** = `min(5, floor(díasDesdeInicio / 7) + 1)`.
- **Fecha prevista** de cada acción = `inicio + semana*7 - 1`.
- **Avance** = realizadas / (total − no_corresponde).
- Al marcar una acción como *realizada* sin fecha, se completa con hoy.
- **Alertas** (calculadas al vuelo, sin tabla):
  - 🔴 acciones atrasadas (fecha prevista pasada y no cerradas)
  - 🔴 autorización vencida
  - 🟠 acciones que vencen hoy
  - 🟠 autorización vence en ≤10 días
  - 🟠 semana anterior incompleta
  - 🟠 sin actividad hace ≥7 días
  - 🟠 en semana 5 sin consultas ni visitas cargadas
  - 🟢 semana 5 al 100% → listo para cierre
- **Embudo**: conversión a visita = visitas/consultas; conversión visita→oferta = ofertas/visitas.
- Cumplidas las 5 semanas la propiedad **sigue activa**: cerrar es decisión humana (archivar).

## 5. Roles y alcance

CEO/dirección ve todo · team leader ve lo suyo y lo de su equipo · vendedor ve
lo suyo. Se reutiliza `resolverScope(ctx, tx, soloMio)` y el toggle
**"Ver solo lo mío"** (igual que Tablero y Tasador), incluido en listados,
dashboard y drill-downs.

## 6. API (`/protocolo`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/protocolo/captadas` | tasaciones Captada **sin** protocolo (listado con botón Iniciar) |
| POST | `/protocolo` | iniciar protocolo (tasacionId + datos del modal) |
| GET | `/protocolo` | listar fichas (filtros: estado, soloMio, año) |
| GET | `/protocolo/:id` | detalle + acciones |
| PATCH | `/protocolo/:id` | métricas, análisis, datos de cabecera |
| PATCH | `/protocolo/:id/acciones/:accionId` | estado/fechas/notas de una acción |
| POST | `/protocolo/:id/archivar` | fecha + motivo (`vendida` \| `retirada` \| `vencida` \| `otro`) |
| GET | `/protocolo/kpis` | dashboard (activas, alertas críticas, avance promedio) |
| GET | `/protocolo/:id/informe` | PDF para el propietario |
| GET | `/protocolo/reporte` | reporte general (captadas / activas / archivadas) |

Cada endpoint valida con Zod y verifica rol + tenant (CLAUDE.md §8), y queda
detrás del guard de módulo habilitado (§7).

## 7. Licenciamiento por módulos

- `MODULO_KEYS` pasa a `['tablero','tasador','todo','protocolo']`.
- `Tenant.modulos Json` (fuente de verdad), backfill desde el plan actual.
- `AuthPrincipal.tenant.modulos` → la Home muestra/oculta tarjetas por ahí, en
  vez de `MODULOS_POR_PLAN`.
- **Guard `@Modulo('protocolo')`**: si el tenant no tiene el módulo, 403. Sin
  esto la API queda abierta aunque la UI oculte el módulo.
- Admin: 4 checkboxes de "habilitado / pagado" en la edición del tenant.

## 8. Informe PDF del propietario

react-pdf, **mismo header, fuentes (Montserrat) y tratamiento que el informe de
Tasaciones** (logo, kicker, divider, subrayado de secciones). 4 páginas, según
el HTML:

1. **Portada** — foto de la propiedad, dirección, tipo y precio, semana actual + % avance, preparado para / asesor responsable.
2. **Resumen ejecutivo** — KPIs (días publicados, acciones realizadas, consultas, visitas), embudo comercial, devoluciones, objeciones, recomendación de Vacker, estado actual.
3. **Trabajo realizado** — acciones realizadas agrupadas por semana, con fecha y resultado.
4. **Conclusiones** — recomendación profesional, decisión acordada, próximas acciones, contacto.

Fotos y datos salen de la tasación; las fotos vienen de bucket privado → URL
firmada (ver memoria `storage-buckets-privacidad`).

## 9. Reporte general

Pantalla con tres grupos — **Captadas** (sin protocolo), **Activas** (protocolo
en curso) y **Archivadas** — con el botón **Archivar** (fecha + motivo +
observación). Respeta scope por rol y "ver solo lo mío".

## 10. Plan de entrega (un PR por paso, CI verde antes de mergear)

| # | Alcance | Notas |
|---|---|---|
| 1 | **Licenciamiento por módulos** — types, migración + backfill, guard `@Modulo`, Home, checks en admin | Independiente; habilita el resto |
| 2 | **Admin lindo** — rediseño de edición de tenant y de usuarios | Mismo tratamiento que el form de operaciones |
| 3 | **Datos + API del protocolo** — modelo, RLS, iniciar/listar/detalle/acciones/métricas/archivar + test de aislamiento | Núcleo backend |
| 4 | **Web del protocolo** — captadas + iniciar, dashboard con alertas, detalle de 5 semanas | El grueso de la UI |
| 5 | **Informe PDF** del propietario | Reusa `fuentes.ts` del tasador |
| 6 | **Reporte general** + archivar | Cierra el módulo |

## 11. Supuestos (corregir si no aplica)

- El protocolo aplica a tasaciones de **venta y alquiler** (mismo checklist).
- Motivos de archivo: Vendida · Retirada por el propietario · Autorización vencida · Otro (con observación).
- Las **notificaciones del navegador** del prototipo quedan fuera; las alertas viven en el dashboard. Push real se evalúa con la PWA (ver `plan-mobile-pwa-primero`).
- El reporte general es una **pantalla** (con exportación), no un PDF de entrada.
- Una tasación tiene **un solo** protocolo. Reiniciar la comercialización de una propiedad archivada se resolverá cuando aparezca el caso.
