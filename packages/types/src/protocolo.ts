// Contratos del módulo Protocolo 5 Semanas (seguimiento de la comercialización).
// Ver docs/MODULO_PROTOCOLO_5_SEMANAS.md.
import { z } from 'zod';
import { IsoDateSchema, MontoSchema } from './tablero';

export const EstadoProtocoloSchema = z.enum(['activa', 'archivada']);
export type EstadoProtocolo = z.infer<typeof EstadoProtocoloSchema>;

export const EstadoAccionSchema = z.enum(['pendiente', 'en_proceso', 'realizada', 'no_corresponde']);
export type EstadoAccion = z.infer<typeof EstadoAccionSchema>;

export const ESTADO_ACCION_LABEL: Record<EstadoAccion, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  realizada: 'Realizada',
  no_corresponde: 'No corresponde',
};

export const MotivoArchivoSchema = z.enum(['vendida', 'retirada', 'vencida', 'otro']);
export type MotivoArchivo = z.infer<typeof MotivoArchivoSchema>;

export const MOTIVO_ARCHIVO_LABEL: Record<MotivoArchivo, string> = {
  vendida: 'Vendida',
  retirada: 'Retirada por el propietario',
  vencida: 'Autorización vencida',
  otro: 'Otro',
};

/** Las 5 semanas del protocolo. */
export const SEMANAS = [1, 2, 3, 4, 5] as const;
export const TOTAL_SEMANAS = 5;

export const DESCRIPCION_SEMANA: Record<number, string> = {
  1: 'Preparación, producción y lanzamiento de la propiedad.',
  2: 'Activación de bases de datos y seguimiento inicial.',
  3: 'Difusión dirigida y trabajo colaborativo con colegas.',
  4: 'Refuerzo de comunicación, reposicionamiento y revisión.',
  5: 'Análisis de resultados, devolución y decisión estratégica.',
};

/**
 * Plantilla fija del protocolo (29 acciones). Es el protocolo comercial de la
 * inmobiliaria, igual para todos los tenants: se copia a la ficha al iniciar,
 * y desde ahí cada propiedad lleva su propia copia (histórica).
 *
 * `clave` es estable: no cambiarla aunque se reformule el título, porque es lo
 * que permite comparar la misma acción entre protocolos.
 */
export const PLANTILLA_ACCIONES: { clave: string; semana: number; titulo: string }[] = [
  { clave: 'recepcion-documentacion', semana: 1, titulo: 'Recepción de documentación' },
  { clave: 'estudio-titulos', semana: 1, titulo: 'Estudio de títulos' },
  { clave: 'produccion-fotografica', semana: 1, titulo: 'Producción fotográfica' },
  { clave: 'produccion-video', semana: 1, titulo: 'Producción de video' },
  { clave: 'publicacion-portales', semana: 1, titulo: 'Publicación en portales' },
  { clave: 'publicacion-redes', semana: 1, titulo: 'Publicación en redes' },
  { clave: 'carteleria', semana: 1, titulo: 'Cartelería / señalización' },
  { clave: 'control-calidad-publicacion', semana: 1, titulo: 'Control de calidad de la publicación' },

  { clave: 'difusion-base-propia', semana: 2, titulo: 'Difusión en base de datos propia' },
  { clave: 'difusion-base-inmobiliaria', semana: 2, titulo: 'Difusión en base de datos de la inmobiliaria' },
  { clave: 'contacto-interesados-similares', semana: 2, titulo: 'Contacto con interesados en propiedades similares' },
  { clave: 'seguimiento-consultas-iniciales', semana: 2, titulo: 'Seguimiento de consultas iniciales' },

  { clave: 'difusion-whatsapp-colegas', semana: 3, titulo: 'Difusión en grupos de WhatsApp de colegas' },
  { clave: 'envio-dirigido-colegas', semana: 3, titulo: 'Envío dirigido a colegas con potenciales compradores' },
  { clave: 'ronda-negocios-colegas', semana: 3, titulo: 'Ronda de negocios con colegas' },
  { clave: 'seguimiento-colegas', semana: 3, titulo: 'Seguimiento a colegas interesados' },

  { clave: 'nuevo-video-contenido', semana: 4, titulo: 'Nuevo video o pieza de contenido' },
  { clave: 'nuevas-publicaciones', semana: 4, titulo: 'Nuevas publicaciones' },
  { clave: 'reposicionamiento-portales', semana: 4, titulo: 'Reposicionamiento en portales' },
  { clave: 'repaso-base-propia', semana: 4, titulo: 'Repaso de base de datos propia' },
  { clave: 'repaso-base-inmobiliaria', semana: 4, titulo: 'Repaso de base de datos de la inmobiliaria' },
  { clave: 'seguimiento-consultas-visitas', semana: 4, titulo: 'Seguimiento de consultas y visitas' },
  { clave: 'revision-precio-posicionamiento', semana: 4, titulo: 'Revisión de precio y posicionamiento' },

  { clave: 'consolidacion-consultas-visitas', semana: 5, titulo: 'Consolidación de consultas y visitas' },
  { clave: 'devoluciones-compradores', semana: 5, titulo: 'Registro de devoluciones de compradores' },
  { clave: 'devoluciones-colegas', semana: 5, titulo: 'Registro de devoluciones de colegas' },
  { clave: 'analisis-objeciones', semana: 5, titulo: 'Análisis de objeciones del mercado' },
  { clave: 'recomendacion-estrategia', semana: 5, titulo: 'Recomendación de estrategia' },
  { clave: 'reunion-decision-propietario', semana: 5, titulo: 'Reunión y decisión con el propietario' },
];

// --- DTOs ------------------------------------------------------------------

export const ProtocoloAccionDtoSchema = z.object({
  id: z.string().uuid(),
  semana: z.number().int(),
  orden: z.number().int(),
  clave: z.string(),
  titulo: z.string(),
  estado: EstadoAccionSchema,
  fechaPrevista: IsoDateSchema.nullable(),
  fechaRealizada: IsoDateSchema.nullable(),
  observaciones: z.string().nullable(),
  resultado: z.string().nullable(),
  evidencia: z.string().nullable(),
});
export type ProtocoloAccionDto = z.infer<typeof ProtocoloAccionDtoSchema>;

/** Nivel de una alerta: rojo urge, ámbar avisa, verde confirma. */
export const NivelAlertaSchema = z.enum(['roja', 'ambar', 'verde']);
export type NivelAlerta = z.infer<typeof NivelAlertaSchema>;

export const AlertaProtocoloSchema = z.object({
  nivel: NivelAlertaSchema,
  titulo: z.string(),
  detalle: z.string(),
});
export type AlertaProtocolo = z.infer<typeof AlertaProtocoloSchema>;

/** Métricas comerciales + conversiones derivadas (embudo del informe). */
export const EmbudoProtocoloSchema = z.object({
  consultas: z.number().int(),
  consultasCalificadas: z.number().int(),
  visitas: z.number().int(),
  interesadosActivos: z.number().int(),
  ofertas: z.number().int(),
  /** visitas / consultas, 0..1 (0 si no hay consultas). */
  conversionVisita: z.number(),
  /** ofertas / visitas, 0..1 (0 si no hay visitas). */
  conversionOferta: z.number(),
});
export type EmbudoProtocolo = z.infer<typeof EmbudoProtocoloSchema>;

const AgenteProtocoloSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  email: z.string(),
  telefono: z.string().nullable(),
  fotoUrl: z.string().nullable(),
});

/** Datos de la propiedad, tomados de la tasación (no se duplican en la ficha). */
const PropiedadProtocoloSchema = z.object({
  tasacionId: z.string().uuid(),
  direccion: z.string(),
  barrio: z.string().nullable(),
  ciudad: z.string().nullable(),
  tipoPropiedad: z.string(),
  tipoOperacion: z.string(),
  superficieTotal: z.number().nullable(),
  dormitorios: z.number().int().nullable(),
  banos: z.number().int().nullable(),
  valorRecomendado: z.number().nullable(),
  fotoUrl: z.string().nullable(),
});

export const ProtocoloResumenDtoSchema = z.object({
  id: z.string().uuid(),
  estado: EstadoProtocoloSchema,
  fechaInicio: IsoDateSchema,
  /** Semana en curso (1..5), calculada desde la fecha de inicio. */
  semanaActual: z.number().int(),
  /** Días desde el inicio de la comercialización. */
  diasPublicada: z.number().int(),
  /** Acciones realizadas sobre las que corresponden, 0..1. */
  avance: z.number(),
  precioPublicado: z.number().nullable(),
  moneda: z.string(),
  vencimientoAutorizacion: IsoDateSchema.nullable(),
  archivadoEn: IsoDateSchema.nullable(),
  motivoArchivo: MotivoArchivoSchema.nullable(),
  agente: AgenteProtocoloSchema,
  propiedad: PropiedadProtocoloSchema,
  alertas: z.array(AlertaProtocoloSchema),
  /** Próxima acción pendiente (la de fecha prevista más cercana). */
  proximaAccion: z.string().nullable(),
});
export type ProtocoloResumenDto = z.infer<typeof ProtocoloResumenDtoSchema>;

export const ProtocoloDtoSchema = ProtocoloResumenDtoSchema.extend({
  propietarioNombre: z.string().nullable(),
  propietarioTelefono: z.string().nullable(),
  propietarioEmail: z.string().nullable(),
  embudo: EmbudoProtocoloSchema,
  devolucionesMercado: z.string().nullable(),
  objeciones: z.string().nullable(),
  recomendacion: z.string().nullable(),
  decisionPropietario: z.string().nullable(),
  proximasAcciones: z.string().nullable(),
  observacionArchivo: z.string().nullable(),
  acciones: z.array(ProtocoloAccionDtoSchema),
});
export type ProtocoloDto = z.infer<typeof ProtocoloDtoSchema>;

/** Tasación captada todavía sin protocolo — candidata a iniciar. */
export const CandidataDtoSchema = z.object({
  tasacionId: z.string().uuid(),
  codigo: z.string().nullable(),
  direccion: z.string(),
  barrio: z.string().nullable(),
  ciudad: z.string().nullable(),
  tipoPropiedad: z.string(),
  tipoOperacion: z.string(),
  cliente: z.string(),
  fecha: IsoDateSchema,
  valorRecomendado: z.number().nullable(),
  /** Días de exclusividad pactados, si la captación fue exclusiva. */
  diasExclusividad: z.number().int().nullable(),
  fotoUrl: z.string().nullable(),
  agente: AgenteProtocoloSchema,
});
export type CandidataDto = z.infer<typeof CandidataDtoSchema>;

// --- Inputs ----------------------------------------------------------------

export const IniciarProtocoloSchema = z.object({
  tasacionId: z.string().uuid(),
  /** Por defecto hoy; se permite fecharlo distinto si se cargó con atraso. */
  fechaInicio: IsoDateSchema.optional(),
  precioPublicado: MontoSchema.nullish(),
  moneda: z.string().default('USD'),
  propietarioNombre: z.string().trim().max(160).nullish(),
  propietarioTelefono: z.string().trim().max(60).nullish(),
  propietarioEmail: z.string().trim().email().nullish().or(z.literal('')),
  vencimientoAutorizacion: IsoDateSchema.nullish(),
});
export type IniciarProtocolo = z.infer<typeof IniciarProtocoloSchema>;

export const UpdateProtocoloSchema = z
  .object({
    precioPublicado: MontoSchema.nullable(),
    moneda: z.string(),
    propietarioNombre: z.string().trim().max(160).nullable(),
    propietarioTelefono: z.string().trim().max(60).nullable(),
    propietarioEmail: z.string().trim().max(160).nullable(),
    vencimientoAutorizacion: IsoDateSchema.nullable(),
    consultas: z.number().int().min(0),
    consultasCalificadas: z.number().int().min(0),
    visitas: z.number().int().min(0),
    interesadosActivos: z.number().int().min(0),
    ofertas: z.number().int().min(0),
    devolucionesMercado: z.string().nullable(),
    objeciones: z.string().nullable(),
    recomendacion: z.string().nullable(),
    decisionPropietario: z.string().nullable(),
    proximasAcciones: z.string().nullable(),
  })
  .partial();
export type UpdateProtocolo = z.infer<typeof UpdateProtocoloSchema>;

export const UpdateAccionSchema = z
  .object({
    estado: EstadoAccionSchema,
    fechaPrevista: IsoDateSchema.nullable(),
    fechaRealizada: IsoDateSchema.nullable(),
    observaciones: z.string().nullable(),
    resultado: z.string().nullable(),
    evidencia: z.string().nullable(),
  })
  .partial();
export type UpdateAccion = z.infer<typeof UpdateAccionSchema>;

export const ArchivarProtocoloSchema = z.object({
  motivo: MotivoArchivoSchema,
  /** Por defecto hoy. */
  fecha: IsoDateSchema.optional(),
  observacion: z.string().trim().max(600).nullish(),
});
export type ArchivarProtocolo = z.infer<typeof ArchivarProtocoloSchema>;

export const ProtocoloFiltroSchema = z.object({
  estado: EstadoProtocoloSchema.optional(),
  soloMio: z.coerce.boolean().optional(),
  anio: z.coerce.number().int().optional(),
});
export type ProtocoloFiltro = z.infer<typeof ProtocoloFiltroSchema>;

/** KPIs de cabecera del dashboard del módulo. */
export const ProtocoloKpisSchema = z.object({
  activas: z.number().int(),
  alertasCriticas: z.number().int(),
  /** Promedio de avance de las activas, 0..1. */
  avancePromedio: z.number(),
  captadasSinIniciar: z.number().int(),
  archivadas: z.number().int(),
});
export type ProtocoloKpis = z.infer<typeof ProtocoloKpisSchema>;
