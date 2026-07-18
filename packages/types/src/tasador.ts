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

// --- CRUD (Sprint 1): secciones 1 (Datos del informe) y 2 (Características) ---
// Las secciones 3/5/6 (análisis comercial, valores, estrategia) llegan en el
// Sprint 2; sus campos ya existen en TasacionDtoSchema (nullable) porque la
// fila completa se puede leer aunque todavía no se pueda escribir.

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

export const CreateTasacionSchema = z.object({
  // Sección 1 — Datos del informe
  cliente: z.string().min(1),
  fecha: IsoDateSchema,
  direccion: z.string().min(1),
  barrio: z.string().nullish(),
  ciudad: z.string().nullish(),
  tipoOperacion: TipoOperacionSchema,
  // Sección 2 — Características del inmueble
  ...TasacionCaracteristicasFields,
});
export type CreateTasacion = z.infer<typeof CreateTasacionSchema>;

/** Edición: mismos campos que el alta, todos opcionales. No permite cambiar `estado` (endpoint aparte). */
export const UpdateTasacionSchema = CreateTasacionSchema.partial();
export type UpdateTasacion = z.infer<typeof UpdateTasacionSchema>;

/** Filtro de listado. `agenteId` solo tiene efecto cuando el alcance del rol ya es todo el tenant. */
export const TasacionFiltroSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  estado: EstadoTasacionSchema.optional(),
  agenteId: z.string().uuid().optional(),
});
export type TasacionFiltro = z.infer<typeof TasacionFiltroSchema>;

/** Respuesta de la API: fila completa, incluye los campos de Sprint 2+ (nullable). */
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
  analisisComercial: z.unknown().nullable(),
  valorMinimo: z.number().nullable(),
  valorRecomendado: z.number().nullable(),
  valorAspiracional: z.number().nullable(),
  margenNegociacion: z.string().nullable(),
  escenarioRecomendado: z.string().nullable(),
  plazoEstimado: z.string().nullable(),
  estrategiaComercial: z.unknown().nullable(),
  estado: EstadoTasacionSchema,
  exclusividad: ExclusividadSchema.nullable(),
  motivoNoCaptada: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TasacionDto = z.infer<typeof TasacionDtoSchema>;
