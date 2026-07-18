// Contratos del módulo Tasador de Propiedades. Vocabulario y DTOs tomados de
// docs/prototipos/tasador_de_propiedades.html.
import { z } from 'zod';
import { IsoDateSchema, TipoOperacionSchema } from './tablero';

export const TipoPropiedadSchema = z.enum([
  'Departamento',
  'PH',
  'Casa',
  'Local',
  'Terreno',
  'Cochera',
  'Oficina',
  'Galpón',
  'Otro',
]);
export type TipoPropiedad = z.infer<typeof TipoPropiedadSchema>;

export const EstadoTasacionSchema = z.enum(['En proceso', 'Presentada', 'Captada', 'No captada']);
export type EstadoTasacion = z.infer<typeof EstadoTasacionSchema>;

export const MotivoNoCaptadaSchema = z.enum([
  'Desacuerdo de precio',
  'Ya no quiere vender',
  'Prefiere otra inmobiliaria',
  'Documentación incompleta',
]);
export type MotivoNoCaptada = z.infer<typeof MotivoNoCaptadaSchema>;

/** Exclusividad exigida al pasar una tasación a "Captada". */
export const ExclusividadSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('exclusiva'), dias: z.number().int().positive() }),
  z.object({ tipo: z.literal('no') }),
]);
export type Exclusividad = z.infer<typeof ExclusividadSchema>;

// --- Vocabulario de las secciones 3 (Análisis comercial) y 6 (Estrategia
// comercial), tomado literal de las constantes *_OPS del prototipo. ---

export const NivelSchema = z.enum(['Bajo', 'Medio', 'Alto']);
export type Nivel = z.infer<typeof NivelSchema>;

export const PerfilCompradorSchema = z.enum([
  'Usuario final',
  'Inversor',
  'Primera vivienda',
  'Familia',
  'Profesional',
  'Comerciante',
  'Desarrollador',
  'Otro',
]);
export type PerfilComprador = z.infer<typeof PerfilCompradorSchema>;

export const EscenarioSchema = z.enum(['Venta rápida', 'Venta equilibrada', 'Venta aspiracional']);
export type Escenario = z.infer<typeof EscenarioSchema>;

export const PlazoEstimadoSchema = z.enum([
  '30 a 60 días',
  '60 a 90 días',
  '90 a 120 días',
  'Más de 120 días',
]);
export type PlazoEstimado = z.infer<typeof PlazoEstimadoSchema>;

export const FortalezaSchema = z.enum([
  'Excelente ubicación',
  'Buena luminosidad',
  'Ambientes amplios',
  'Buena distribución',
  'Buen estado general',
  'Edificio bien mantenido',
  'Balcón funcional',
  'Vista despejada',
  'Cochera incluida',
  'Bajas expensas',
  'Apto crédito',
  'Alta demanda para la tipología',
  'Cercanía a corredores comerciales',
  'Cercanía a espacios verdes',
  'Buena conectividad',
  'Buena relación precio-superficie',
]);
export type Fortaleza = z.infer<typeof FortalezaSchema>;

export const AspectoSchema = z.enum([
  'Necesita mejoras',
  'Expensas elevadas',
  'Falta de cochera',
  'Disposición interna',
  'Baja luminosidad',
  'Edificio antiguo',
  'Alta competencia en la zona',
  'Precio sensible para la demanda actual',
  'Documentación pendiente de revisión',
  'Ambientes chicos',
  'Estado original',
  'Falta de balcón',
  'Requiere actualización estética',
]);
export type Aspecto = z.infer<typeof AspectoSchema>;

export const EstrategiaAccionSchema = z.enum([
  'Fotografías profesionales',
  'Video / reel de la propiedad',
  'Publicación en portales inmobiliarios',
  'Destaque en portales',
  'Difusión en redes sociales',
  'Cartelería',
  'Amoblamiento virtual',
  'Cruce con base de datos interna',
  'Contacto con compradores activos',
  'Difusión entre colegas',
  'Seguimiento semanal',
  'Revisión de resultados a los 30 días',
]);
export type EstrategiaAccion = z.infer<typeof EstrategiaAccionSchema>;

// Sin `.default([])` en los arrays: reusamos este mismo schema tal cual en
// CreateTasacionSchema y en TasacionDtoSchema — un default ahí generaría una
// divergencia Input/Output que rompe la inferencia de `apiFetch<T>` (el
// llamador siempre manda el array, aunque sea vacío).
export const AnalisisComercialSchema = z.object({
  fortalezas: z.array(FortalezaSchema),
  aspectos: z.array(AspectoSchema),
  demanda: NivelSchema.nullish(),
  competencia: NivelSchema.nullish(),
  perfilComprador: PerfilCompradorSchema.nullish(),
  observacionesComerciales: z.string().nullish(),
});
export type AnalisisComercial = z.infer<typeof AnalisisComercialSchema>;

export const EstrategiaComercialSchema = z.object({
  estrategia: z.array(EstrategiaAccionSchema),
  observacionesEstrategia: z.string().nullish(),
});
export type EstrategiaComercial = z.infer<typeof EstrategiaComercialSchema>;

/** Comparable de mercado (3..6 por tasación cuando la sección está completa). */
export const ComparableInputSchema = z.object({
  direccion: z.string().min(1),
  superficie: z.number().positive(),
  precio: z.number().positive(),
  dormitorios: z.number().int().nonnegative().nullish(),
  banos: z.number().int().nonnegative().nullish(),
  cochera: z.boolean().default(false),
  estado: z.string().nullish(),
  link: z.string().nullish(),
  observaciones: z.string().nullish(),
});
export type ComparableInput = z.infer<typeof ComparableInputSchema>;

export const ComparableDtoSchema = ComparableInputSchema.extend({
  id: z.string().uuid(),
  // Sin `.default()`: acá describe una fila ya persistida, no un input a
  // completar — evita la divergencia Input/Output que confunde la inferencia
  // de `apiFetch<T>` en el resto del código.
  cochera: z.boolean(),
  /** precio / superficie, calculado — no persistido en la base. */
  usdM2: z.number(),
});
export type ComparableDto = z.infer<typeof ComparableDtoSchema>;

// --- CRUD: secciones 1 (Datos del informe), 2 (Características), 3+5+6
// (análisis comercial, valores, estrategia) y comparables. ---

const TasacionCaracteristicasFields = {
  tipoPropiedad: TipoPropiedadSchema,
  supCubierta: z.number().nonnegative().default(0),
  supSemicubierta: z.number().nonnegative().default(0),
  supDescubierta: z.number().nonnegative().default(0),
  supTerreno: z.number().nonnegative().nullish(),
  dormitorios: z.number().int().nonnegative().nullish(),
  banos: z.number().int().nonnegative().nullish(),
  toilette: z.number().int().nonnegative().nullish(),
  ambientes: z.number().int().nonnegative().nullish(),
  antiguedad: z.number().int().nonnegative().nullish(),
  estadoInmueble: z.string().nullish(),
  disposicion: z.string().nullish(),
  orientacion: z.string().nullish(),
  cochera: z.boolean().default(false),
  balcon: z.boolean().default(false),
  terraza: z.boolean().default(false),
  patio: z.boolean().default(false),
  lavadero: z.boolean().default(false),
  piscina: z.boolean().default(false),
  amenities: z.array(z.string()).default([]),
  detalleAmenities: z.string().nullish(),
  expensas: z.number().nonnegative().nullish(),
  aptoCredito: z.string().nullish(),
  documentacion: z.string().nullish(),
};

/**
 * Sección 5 (Valores) + comparables. A diferencia de `superficieTotal`, estos
 * valores NO se recalculan en el servidor: el front sugiere un valor con
 * `@vacker/domain` cuando hay comparables, pero son inputs editables — lo que
 * llega en el `dto` es lo que se persiste, igual que cualquier otro campo.
 */
const TasacionValoresYComparablesFields = {
  comparables: z.array(ComparableInputSchema).optional(),
  valorMinimo: z.number().nonnegative().nullish(),
  valorRecomendado: z.number().nonnegative().nullish(),
  valorAspiracional: z.number().nonnegative().nullish(),
  margenNegociacion: z.number().nullish(),
  escenarioRecomendado: EscenarioSchema.nullish(),
  plazoEstimado: PlazoEstimadoSchema.nullish(),
  analisisComercial: AnalisisComercialSchema.nullish(),
  estrategiaComercial: EstrategiaComercialSchema.nullish(),
};

function comparablesValidos(comparables?: ComparableInput[]): boolean {
  if (!comparables || comparables.length === 0) return true;
  return comparables.length >= 3 && comparables.length <= 6;
}
const MENSAJE_COMPARABLES = {
  message: 'Cargá entre 3 y 6 comparables (o ninguno todavía).',
  path: ['comparables'],
};

const TasacionBaseObject = z.object({
  // Sección 1 — Datos del informe
  cliente: z.string().min(1),
  fecha: IsoDateSchema,
  direccion: z.string().min(1),
  barrio: z.string().nullish(),
  ciudad: z.string().nullish(),
  tipoOperacion: TipoOperacionSchema,
  // Sección 2 — Características del inmueble
  ...TasacionCaracteristicasFields,
  // Secciones 3/5/6 — Análisis comercial, valores y estrategia
  ...TasacionValoresYComparablesFields,
});

export const CreateTasacionSchema = TasacionBaseObject.refine(
  (data) => comparablesValidos(data.comparables),
  MENSAJE_COMPARABLES,
);
export type CreateTasacion = z.infer<typeof CreateTasacionSchema>;

/** Edición: mismos campos que el alta, todos opcionales. No permite cambiar `estado` (endpoint aparte). */
export const UpdateTasacionSchema = TasacionBaseObject.partial().refine(
  (data) => comparablesValidos(data.comparables),
  MENSAJE_COMPARABLES,
);
export type UpdateTasacion = z.infer<typeof UpdateTasacionSchema>;

/** Filtro de listado. `agenteId` solo tiene efecto cuando el alcance del rol ya es todo el tenant. */
export const TasacionFiltroSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  estado: EstadoTasacionSchema.optional(),
  agenteId: z.string().uuid().optional(),
});
export type TasacionFiltro = z.infer<typeof TasacionFiltroSchema>;

/** Respuesta de la API: fila completa. */
export const TasacionDtoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().nullable(),
  agenteId: z.string().uuid(),
  agente: z.object({ id: z.string().uuid(), nombre: z.string() }),
  cliente: z.string(),
  fecha: z.string(),
  direccion: z.string(),
  barrio: z.string().nullable(),
  ciudad: z.string().nullable(),
  tipoOperacion: TipoOperacionSchema,
  tipoPropiedad: TipoPropiedadSchema,
  supCubierta: z.number(),
  supSemicubierta: z.number(),
  supDescubierta: z.number(),
  supTerreno: z.number().nullable(),
  superficieTotal: z.number(),
  dormitorios: z.number().nullable(),
  banos: z.number().nullable(),
  toilette: z.number().nullable(),
  ambientes: z.number().nullable(),
  antiguedad: z.number().nullable(),
  estadoInmueble: z.string().nullable(),
  disposicion: z.string().nullable(),
  orientacion: z.string().nullable(),
  cochera: z.boolean(),
  balcon: z.boolean(),
  terraza: z.boolean(),
  patio: z.boolean(),
  lavadero: z.boolean(),
  piscina: z.boolean(),
  amenities: z.array(z.string()),
  detalleAmenities: z.string().nullable(),
  expensas: z.number().nullable(),
  aptoCredito: z.string().nullable(),
  documentacion: z.string().nullable(),
  comparables: z.array(ComparableDtoSchema),
  analisisComercial: AnalisisComercialSchema.nullable(),
  valorMinimo: z.number().nullable(),
  valorRecomendado: z.number().nullable(),
  valorAspiracional: z.number().nullable(),
  margenNegociacion: z.number().nullable(),
  escenarioRecomendado: EscenarioSchema.nullable(),
  plazoEstimado: PlazoEstimadoSchema.nullable(),
  estrategiaComercial: EstrategiaComercialSchema.nullable(),
  estado: EstadoTasacionSchema,
  exclusividad: ExclusividadSchema.nullable(),
  motivoNoCaptada: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TasacionDto = z.infer<typeof TasacionDtoSchema>;

// --- Sprint 3: cambio de estado (captación) ---
// Discriminada por `estado`: la propia forma del contrato exige el dato que
// pide cada transición (exclusividad al captar, motivo al no captar), sin
// lógica if/else adicional en el servicio.
export const CambiarEstadoSchema = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('En proceso') }),
  z.object({ estado: z.literal('Presentada') }),
  z.object({ estado: z.literal('Captada'), exclusividad: ExclusividadSchema }),
  z.object({ estado: z.literal('No captada'), motivoNoCaptada: MotivoNoCaptadaSchema }),
]);
export type CambiarEstado = z.infer<typeof CambiarEstadoSchema>;
