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

// --- Indexación (reglas 5 a 8) --------------------------------------------------

/**
 * Cuántos días antes de que empiece un tramo aparece en la bandeja «a
 * indexar». El ICL se publica con unos diez días de anticipación, así que un
 * tramo por ICL suele poder confirmarse antes de empezar.
 */
export const DIAS_ANTICIPACION_INDEXACION = 30;

export const EstadoIndexacionSchema = z.enum(['lista', 'pendiente_indice', 'manual']);
export type EstadoIndexacion = z.infer<typeof EstadoIndexacionSchema>;

/** Un tramo a indexar, con la propuesta del sistema (regla 6). */
export const IndexacionDtoSchema = z.object({
  tramoId: z.string().uuid(),
  contrato: z.object({ id: z.string().uuid(), codigo: z.string(), direccion: z.string(), unidad: z.string().nullable() }),
  inquilinos: z.array(z.string()),
  indice: IndiceAlquilerSchema,
  numero: z.number().int(),
  desde: FechaIso,
  hasta: FechaIso,
  importeAnterior: z.number(),
  estado: EstadoIndexacionSchema,
  fechaBase: FechaIso.nullable(),
  valorBase: z.number().nullable(),
  fechaRequerida: FechaIso.nullable(),
  valorRequerido: z.number().nullable(),
  importePropuesto: z.number().nullable(),
  /** Qué valores del índice faltan, en palabras («el IPC de agosto de 2026»). */
  falta: z.array(z.string()),
  /** El tramo ya empezó y sigue sin importe. */
  vencida: z.boolean(),
});
export type IndexacionDto = z.infer<typeof IndexacionDtoSchema>;

/** Hasta dónde llegan los valores cargados de un índice, y si hay que preocuparse (regla 8). */
export const EstadoIndiceDtoSchema = z.object({
  indice: z.enum(['ICL', 'IPC']),
  ultimaFecha: FechaIso.nullable(),
  alerta: z.string().nullable(),
});
export type EstadoIndiceDto = z.infer<typeof EstadoIndiceDtoSchema>;

export const BandejaIndexacionDtoSchema = z.object({
  indices: z.array(EstadoIndiceDtoSchema),
  tramos: z.array(IndexacionDtoSchema),
});
export type BandejaIndexacionDto = z.infer<typeof BandejaIndexacionDtoSchema>;

/**
 * Confirmar una indexación (regla 6). El importe solo viaja cuando el índice
 * no tiene fuente (Casa Propia); si no, lo calcula la API y uno distinto se
 * rechaza: lo que se confirma es lo que se mostró.
 */
export const ConfirmarIndexacionSchema = z.object({
  importe: z
    .number()
    .positive('El importe tiene que ser mayor que cero.')
    .nullish()
    .transform((v) => v ?? null),
});
export type ConfirmarIndexacion = z.infer<typeof ConfirmarIndexacionSchema>;

export const IndexacionConfirmadaDtoSchema = z.object({
  tramoId: z.string().uuid(),
  numero: z.number().int(),
  importe: z.number(),
});
export type IndexacionConfirmadaDto = z.infer<typeof IndexacionConfirmadaDtoSchema>;

// --- Conceptos y generación del período (reglas 9 a 14) --------------------------

/** Un mes calendario, `AAAA-MM`. */
export const PeriodoSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido, se espera AAAA-MM.');

export const TipoConceptoSchema = z.enum([
  'alquiler',
  'gastos_adm',
  'honorarios',
  'iva',
  'punitorio',
  'expensa',
  'impuesto',
  'servicio',
  'reparacion',
  'saldo_inicial',
  'otro',
]);
export type TipoConcepto = z.infer<typeof TipoConceptoSchema>;

export const SentidoConceptoSchema = z.enum(['a_cobrar', 'a_pagar']);
export type SentidoConcepto = z.infer<typeof SentidoConceptoSchema>;

export const GenerarPeriodoSchema = z.object({ periodo: PeriodoSchema });
export type GenerarPeriodo = z.infer<typeof GenerarPeriodoSchema>;

/** Lo que hizo «Generar el período». Correrlo dos veces da `creados: 0` la segunda (regla 10). */
export const ResultadoGeneracionDtoSchema = z.object({
  periodo: PeriodoSchema,
  contratos: z.number().int().nonnegative(),
  creados: z.number().int().nonnegative(),
  existentes: z.number().int().nonnegative(),
  /** Partes del mes que no se generaron porque su tramo no está indexado (regla 11). */
  sinIndexar: z.array(
    z.object({
      contratoId: z.string().uuid(),
      codigo: z.string(),
      direccion: z.string(),
      tramo: z.number().int(),
      desde: FechaIso,
      hasta: FechaIso,
    }),
  ),
});
export type ResultadoGeneracionDto = z.infer<typeof ResultadoGeneracionDtoSchema>;

export const ConceptoDtoSchema = z.object({
  id: z.string().uuid(),
  contrato: z.object({ id: z.string().uuid(), codigo: z.string(), direccion: z.string() }).nullable(),
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  tipo: TipoConceptoSchema,
  sentido: SentidoConceptoSchema,
  moneda: MonedaAlquilerSchema,
  periodo: PeriodoSchema.nullable(),
  vencimiento: FechaIso,
  importe: z.number(),
  adelantadoPorInmobiliaria: z.boolean(),
  descripcion: z.string().nullable(),
  /** Lo creó la generación del período, no una persona. */
  generado: z.boolean(),
  /** Tiene cobros o pagos aplicados, o ya se liquidó: no se puede anular. */
  aplicado: z.boolean(),
  anulado: z.object({ en: z.string(), motivo: z.string() }).nullable(),
});
export type ConceptoDto = z.infer<typeof ConceptoDtoSchema>;

/** Los conceptos que se cargan a mano (regla 14). */
export const TipoConceptoSueltoSchema = z.enum(['expensa', 'impuesto', 'servicio', 'reparacion', 'otro']);
export type TipoConceptoSuelto = z.infer<typeof TipoConceptoSueltoSchema>;

/**
 * Un gasto suelto de un contrato (regla 14): quién lo debe y quién, si
 * alguien, ya lo pagó.
 *
 * - Lo pagó la inmobiliaria: se le cobra a quien lo debe, marcado como
 *   adelantado (al propietario se le descuenta en la liquidación).
 * - Lo pagó la otra parte —el inquilino arregló algo que era del dueño—: además
 *   del cargo, se le reconoce a quien lo pagó. Así lo registra Gexion: la
 *   reparación aparece a pagar a uno y a cobrar al otro.
 */
export const ConceptoSueltoInputSchema = z
  .object({
    contratoId: z.string().uuid(),
    tipo: TipoConceptoSueltoSchema,
    aCargoDe: z.enum(['inquilino', 'propietario']),
    pagadoPor: z.enum(['nadie', 'inmobiliaria', 'inquilino', 'propietario']).default('nadie'),
    importe: z.number().positive('El importe tiene que ser mayor que cero.'),
    vencimiento: FechaIso,
    periodo: PeriodoSchema.nullish().transform((v) => v ?? null),
    descripcion: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    if (v.pagadoPor === v.aCargoDe) {
      ctx.addIssue({ code: 'custom', path: ['pagadoPor'], message: 'Si ya lo pagó quien lo debe, no hay nada que cargar.' });
    }
    if (v.tipo === 'otro' && !v.descripcion) {
      ctx.addIssue({ code: 'custom', path: ['descripcion'], message: 'Contá de qué se trata.' });
    }
  });
export type ConceptoSueltoInput = z.input<typeof ConceptoSueltoInputSchema>;
export type ConceptoSuelto = z.output<typeof ConceptoSueltoInputSchema>;

/** Un concepto no se borra: se anula, con motivo (regla 19). */
export const AnularConceptoSchema = z.object({
  motivo: z.string().trim().min(3, 'Escribí el motivo.'),
});
export type AnularConcepto = z.infer<typeof AnularConceptoSchema>;

// --- Cobros y cuenta corriente (reglas 15 a 19, 23 y 24) ---------------------------

export const MedioCobroSchema = z.enum(['transferencia', 'efectivo', 'cheque', 'otro']);
export type MedioCobro = z.infer<typeof MedioCobroSchema>;

export const PrepararCobroSchema = z.object({
  personaId: z.string().uuid(),
  moneda: MonedaAlquilerSchema.default('ARS'),
  fecha: FechaIso,
});
export type PrepararCobro = z.infer<typeof PrepararCobroSchema>;

const ContratoMiniSchema = z.object({ id: z.string().uuid(), codigo: z.string() }).nullable();

/** Lo que la persona debe, para elegir qué se cobra. */
export const DeudaDtoSchema = z.object({
  conceptoId: z.string().uuid(),
  contrato: ContratoMiniSchema,
  tipo: TipoConceptoSchema,
  descripcion: z.string(),
  vencimiento: FechaIso,
  importe: z.number(),
  saldo: z.number(),
  /** Regla 16: el punitorio que se propone a la fecha del cobro, si corresponde. */
  punitorio: z.object({ dias: z.number().int(), importe: z.number() }).nullable(),
});
export type DeudaDto = z.infer<typeof DeudaDtoSchema>;

/** Todo lo que hace falta para armar un cobro: deudas, reintegros y saldo a favor. */
export const PreparacionCobroDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  moneda: MonedaAlquilerSchema,
  fecha: FechaIso,
  deudas: z.array(DeudaDtoSchema),
  /** Reintegros que se le deben y se compensan contra la deuda (un gasto del dueño que pagó el inquilino). */
  compensables: z.array(z.object({ conceptoId: z.string().uuid(), descripcion: z.string(), saldo: z.number() })),
  /** Lo que sobró de cobros anteriores (regla 17), del más viejo al más nuevo. */
  creditos: z.array(z.object({ cobroId: z.string().uuid(), numero: z.number().int(), disponible: z.number() })),
});
export type PreparacionCobroDto = z.infer<typeof PreparacionCobroDtoSchema>;

export const CobroInputSchema = z.object({
  personaId: z.string().uuid(),
  fecha: FechaIso,
  moneda: MonedaAlquilerSchema.default('ARS'),
  importe: z.number().positive('El importe tiene que ser mayor que cero.'),
  medio: MedioCobroSchema.default('transferencia'),
  obs: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  /** Qué conceptos se cobran. Sin elegir, todos, del más viejo al más nuevo (regla 15). */
  conceptoIds: z.array(z.string().uuid()).nullish().transform((v) => v ?? null),
  /**
   * El punitorio que se cobra por cada alquiler atrasado (regla 16). Menos que
   * lo propuesto es una condonación y pide motivo; más, no se acepta.
   */
  punitorios: z
    .array(
      z.object({
        conceptoId: z.string().uuid(),
        importe: z.number().min(0),
        motivo: z
          .string()
          .trim()
          .nullish()
          .transform((v) => (v ? v : null)),
      }),
    )
    .default([]),
});
export type CobroInput = z.input<typeof CobroInputSchema>;
export type Cobro = z.output<typeof CobroInputSchema>;

export const CobroDtoSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  fecha: FechaIso,
  moneda: MonedaAlquilerSchema,
  importe: z.number(),
  medio: MedioCobroSchema,
  obs: z.string().nullable(),
  /** Lo que se canceló al registrar este cobro, incluido lo pagado con saldo a favor anterior. */
  imputaciones: z.array(
    z.object({
      conceptoId: z.string().uuid(),
      contrato: ContratoMiniSchema,
      descripcion: z.string(),
      sentido: SentidoConceptoSchema,
      importe: z.number(),
      /** Salió del saldo a favor de este cobro anterior, no de la plata de hoy. */
      deSaldoAFavor: z.number().int().nullable(),
    }),
  ),
  /** Lo que sobró y queda a favor para el próximo cobro. */
  aFavor: z.number(),
  anulado: z.object({ en: z.string(), motivo: z.string() }).nullable(),
});
export type CobroDto = z.infer<typeof CobroDtoSchema>;

export const CobroResumenDtoSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  fecha: FechaIso,
  moneda: MonedaAlquilerSchema,
  importe: z.number(),
  medio: MedioCobroSchema,
  anulado: z.boolean(),
});
export type CobroResumenDto = z.infer<typeof CobroResumenDtoSchema>;

export const AnularCobroSchema = z.object({ motivo: z.string().trim().min(3, 'Escribí el motivo.') });
export type AnularCobro = z.infer<typeof AnularCobroSchema>;

/**
 * La cuenta corriente de una persona, por moneda (regla 18), y su estado de
 * cuenta: lo pendiente, cuyo total es exactamente el saldo (regla 24).
 * Saldo positivo: debe. Negativo: tiene a favor.
 */
export const CuentaCorrienteDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  monedas: z.array(
    z.object({
      moneda: MonedaAlquilerSchema,
      saldo: z.number(),
      movimientos: z.array(
        z.object({
          id: z.string().uuid(),
          tipo: z.enum(['concepto', 'cobro']),
          fecha: FechaIso,
          descripcion: z.string(),
          contrato: ContratoMiniSchema,
          debe: z.number(),
          haber: z.number(),
          /** Saldo después del movimiento; los anulados no lo mueven. */
          saldo: z.number(),
          anulado: z.boolean(),
          numero: z.number().int().nullable(),
        }),
      ),
      pendientes: z.array(
        z.object({
          conceptoId: z.string().uuid(),
          contrato: ContratoMiniSchema,
          descripcion: z.string(),
          sentido: SentidoConceptoSchema,
          vencimiento: FechaIso,
          importe: z.number(),
          saldo: z.number(),
        }),
      ),
      aFavor: z.array(z.object({ cobroId: z.string().uuid(), numero: z.number().int(), disponible: z.number() })),
    }),
  ),
});
export type CuentaCorrienteDto = z.infer<typeof CuentaCorrienteDtoSchema>;
