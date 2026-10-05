// Contratos del módulo Alquileres (administración de contratos).
// Ver docs/specs/alquileres-fase-1.md.
import { z } from 'zod';

/**
 * Cuánto tiene cargado la inmobiliaria en el módulo. Lo usa la página de
 * entrada para decidir si muestra el tablero o cómo empezar: una inmobiliaria
 * que recién prende el módulo no ve tarjetas en cero (regla 32).
 */
export const ResumenAlquileresSchema = z.object({
  contratos: z.number().int().nonnegative(),
  contratosVigentes: z.number().int().nonnegative(),
  personas: z.number().int().nonnegative(),
  propiedades: z.number().int().nonnegative(),
});
export type ResumenAlquileres = z.infer<typeof ResumenAlquileresSchema>;

// --- Personas -----------------------------------------------------------------

export const TipoPersonaSchema = z.enum(['fisica', 'juridica']);
export type TipoPersona = z.infer<typeof TipoPersonaSchema>;

/**
 * El documento se guarda solo con dígitos: «20-12345678-9», «20.123.456» y
 * «20123456» son el mismo. Si no se normalizara, la restricción única por
 * inmobiliaria dejaría cargar a la misma persona dos veces con distinto
 * formato, y sus cuentas quedarían partidas en dos.
 */
export function normalizarDocumento(doc: string | null | undefined): string | null {
  const limpio = (doc ?? '').replace(/\D/g, '');
  return limpio === '' ? null : limpio;
}

/** Texto opcional: vacío o solo espacios se guarda como null, no como ''. */
const textoOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

export const PersonaInputSchema = z.object({
  tipo: TipoPersonaSchema.default('fisica'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.'),
  documento: z
    .string()
    .nullish()
    .transform(normalizarDocumento)
    // DNI (7–8 dígitos) o CUIT/CUIL (11). Otra cantidad es un error de tipeo.
    .refine((d) => d === null || /^\d{7,8}$|^\d{11}$/.test(d), 'El documento tiene que ser un DNI (7 u 8 dígitos) o un CUIT (11).'),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, 'El email no es válido.'),
  telefono: textoOpcional,
  domicilio: textoOpcional,
  obs: textoOpcional,
});
export type PersonaInput = z.input<typeof PersonaInputSchema>;
export type Persona = z.output<typeof PersonaInputSchema>;

export const PersonaDtoSchema = z.object({
  id: z.string().uuid(),
  tipo: TipoPersonaSchema,
  nombre: z.string(),
  documento: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  domicilio: z.string().nullable(),
  obs: z.string().nullable(),
});
export type PersonaDto = z.infer<typeof PersonaDtoSchema>;

// --- Propiedades --------------------------------------------------------------

export const TipoPropiedadAlquilerSchema = z.enum(['vivienda', 'local', 'oficina', 'cochera', 'otro']);
export type TipoPropiedadAlquiler = z.infer<typeof TipoPropiedadAlquilerSchema>;

export const PropiedadAlquilerInputSchema = z.object({
  direccion: z.string().trim().min(1, 'La dirección es obligatoria.'),
  unidad: textoOpcional,
  ciudad: textoOpcional,
  tipo: TipoPropiedadAlquilerSchema.nullish().transform((v) => v ?? null),
  obs: textoOpcional,
});
export type PropiedadAlquilerInput = z.input<typeof PropiedadAlquilerInputSchema>;
export type PropiedadAlquiler = z.output<typeof PropiedadAlquilerInputSchema>;

export const PropiedadAlquilerDtoSchema = z.object({
  id: z.string().uuid(),
  direccion: z.string(),
  unidad: z.string().nullable(),
  ciudad: z.string().nullable(),
  tipo: TipoPropiedadAlquilerSchema.nullable(),
  obs: z.string().nullable(),
});
export type PropiedadAlquilerDto = z.infer<typeof PropiedadAlquilerDtoSchema>;

// --- Contratos ----------------------------------------------------------------
// Las reglas de forma van acá; las que miran el contrato entero —tramos sin
// huecos (regla 1), porcentajes que suman 100 (regla 4)— viven en
// @vacker/domain, para que la web las muestre mientras se carga y la API las
// aplique al guardar con el mismo código.

export const EstadoContratoSchema = z.enum(['borrador', 'vigente', 'finalizado', 'rescindido']);
export type EstadoContrato = z.infer<typeof EstadoContratoSchema>;

export const TipoContratoSchema = z.enum(['vivienda', 'comercial']);
export type TipoContrato = z.infer<typeof TipoContratoSchema>;

export const MonedaAlquilerSchema = z.enum(['ARS', 'USD']);
export type MonedaAlquiler = z.infer<typeof MonedaAlquilerSchema>;

export const AjusteContratoSchema = z.enum(['indexado', 'escalonado']);
export type AjusteContrato = z.infer<typeof AjusteContratoSchema>;

/** Los índices de la cartera de Vacker: 43 contratos por ICL, 32 por IPC, 1 por Casa Propia. */
export const IndiceAlquilerSchema = z.enum(['ICL', 'IPC', 'CCP']);
export type IndiceAlquiler = z.infer<typeof IndiceAlquilerSchema>;

export const PapelContratoSchema = z.enum(['propietario', 'inquilino', 'garante']);
export type PapelContrato = z.infer<typeof PapelContratoSchema>;

const FechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera AAAA-MM-DD.');
const Monto = z.number().nonnegative().max(999_999_999_999.99);
const Porcentaje = z.number().min(0).max(100);

export const ParteContratoInputSchema = z.object({
  personaId: z.string().uuid(),
  papel: PapelContratoSchema,
  /** Solo para propietarios; entre todos suman 100 (regla 4). */
  porcentaje: Porcentaje.nullish().transform((v) => v ?? null),
});
export type ParteContratoInput = z.infer<typeof ParteContratoInputSchema>;

export const TramoInputSchema = z.object({
  numero: z.number().int().min(1),
  desde: FechaIso,
  hasta: FechaIso,
  /** En un contrato indexado, solo el primero lleva importe: el resto se indexa (regla 6). */
  importe: Monto.nullish().transform((v) => v ?? null),
});
export type TramoInput = z.infer<typeof TramoInputSchema>;

export const ContratoInputSchema = z
  .object({
    /** Vacío = el siguiente número libre de la inmobiliaria. */
    codigo: z
      .string()
      .trim()
      .max(30)
      .nullish()
      .transform((v) => (v ? v : null)),
    propiedadId: z.string().uuid({ message: 'Elegí la propiedad.' }),
    tipo: TipoContratoSchema.default('vivienda'),
    moneda: MonedaAlquilerSchema.default('ARS'),
    inicio: FechaIso,
    fin: FechaIso,
    fechaFirma: FechaIso.nullish().transform((v) => v ?? null),
    // Hasta el 28 para que exista en todos los meses.
    diaVencimiento: z.number().int().min(1).max(28).default(5),
    diaPagoPropietario: z.number().int().min(1).max(28).default(10),
    ajuste: AjusteContratoSchema.default('indexado'),
    indice: IndiceAlquilerSchema.nullish().transform((v) => v ?? null),
    periodicidadMeses: z.number().int().min(1).max(24).nullish().transform((v) => v ?? null),
    honorariosPct: Porcentaje.default(0),
    gastosAdmPct: Porcentaje.default(0),
    ivaPct: Porcentaje.default(0),
    punitorioDiarioPct: z.number().min(0).max(10).default(0),
    pagoGarantizado: z.boolean().default(false),
    depositoImporte: Monto.nullish().transform((v) => v ?? null),
    depositoMoneda: MonedaAlquilerSchema.nullish().transform((v) => v ?? null),
    depositoDevolucion: FechaIso.nullish().transform((v) => v ?? null),
    obs: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
    partes: z.array(ParteContratoInputSchema).min(1),
    tramos: z.array(TramoInputSchema).min(1),
  })
  .superRefine((c, ctx) => {
    if (c.fin <= c.inicio) ctx.addIssue({ code: 'custom', path: ['fin'], message: 'El fin tiene que ser posterior al inicio.' });
    if (c.ajuste === 'indexado') {
      if (!c.indice) ctx.addIssue({ code: 'custom', path: ['indice'], message: 'Elegí el índice de ajuste.' });
      if (!c.periodicidadMeses) ctx.addIssue({ code: 'custom', path: ['periodicidadMeses'], message: 'Indicá cada cuántos meses se ajusta.' });
    }
    const primero = [...c.tramos].sort((a, b) => a.numero - b.numero)[0];
    if (primero && primero.importe == null) {
      ctx.addIssue({ code: 'custom', path: ['tramos'], message: 'El primer tramo necesita su importe.' });
    }
    if (c.ajuste === 'escalonado' && c.tramos.some((t) => t.importe == null)) {
      ctx.addIssue({ code: 'custom', path: ['tramos'], message: 'En un contrato escalonado, cada tramo lleva su importe.' });
    }
  });
export type ContratoInput = z.input<typeof ContratoInputSchema>;
export type Contrato = z.output<typeof ContratoInputSchema>;

const PersonaMiniSchema = z.object({ id: z.string().uuid(), nombre: z.string() });

export const ContratoResumenDtoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  estado: EstadoContratoSchema,
  tipo: TipoContratoSchema,
  moneda: MonedaAlquilerSchema,
  inicio: FechaIso,
  fin: FechaIso,
  propiedad: z.object({ id: z.string().uuid(), direccion: z.string(), unidad: z.string().nullable() }),
  propietarios: z.array(PersonaMiniSchema),
  inquilinos: z.array(PersonaMiniSchema),
  /** El importe del tramo de hoy; `null` si ese tramo todavía no se indexó. */
  importeVigente: z.number().nullable(),
  /** Cuándo empieza el próximo tramo a indexar, si lo hay. */
  proximaIndexacion: FechaIso.nullable(),
});
export type ContratoResumenDto = z.infer<typeof ContratoResumenDtoSchema>;

export const ContratoDtoSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  estado: EstadoContratoSchema,
  tipo: TipoContratoSchema,
  moneda: MonedaAlquilerSchema,
  inicio: FechaIso,
  fin: FechaIso,
  fechaFirma: FechaIso.nullable(),
  diaVencimiento: z.number().int(),
  diaPagoPropietario: z.number().int(),
  ajuste: AjusteContratoSchema,
  indice: IndiceAlquilerSchema.nullable(),
  periodicidadMeses: z.number().int().nullable(),
  honorariosPct: z.number(),
  gastosAdmPct: z.number(),
  ivaPct: z.number(),
  punitorioDiarioPct: z.number(),
  pagoGarantizado: z.boolean(),
  depositoImporte: z.number().nullable(),
  depositoMoneda: MonedaAlquilerSchema.nullable(),
  depositoDevolucion: FechaIso.nullable(),
  rescindidoEl: FechaIso.nullable(),
  obs: z.string().nullable(),
  propiedad: z.object({ id: z.string().uuid(), direccion: z.string(), unidad: z.string().nullable(), ciudad: z.string().nullable() }),
  partes: z.array(
    z.object({ personaId: z.string().uuid(), nombre: z.string(), papel: PapelContratoSchema, porcentaje: z.number().nullable() }),
  ),
  tramos: z.array(
    z.object({
      numero: z.number().int(),
      desde: FechaIso,
      hasta: FechaIso,
      importe: z.number().nullable(),
      confirmadoEl: z.string().nullable(),
    }),
  ),
});
export type ContratoDto = z.infer<typeof ContratoDtoSchema>;

/**
 * Los cambios de estado (reglas 2 y 3). Rescindir pide la fecha: desde el mes
 * siguiente no se generan alquileres, y los ya generados sin cobrar se anulan.
 */
export const CambiarEstadoContratoSchema = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('vigente') }),
  z.object({ estado: z.literal('finalizado') }),
  z.object({ estado: z.literal('rescindido'), fecha: FechaIso }),
]);
export type CambiarEstadoContrato = z.infer<typeof CambiarEstadoContratoSchema>;
