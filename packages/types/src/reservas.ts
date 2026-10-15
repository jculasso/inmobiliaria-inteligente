// La reserva: la etapa antes del contrato (spec alquileres-fase-1.md, reglas
// 154 a 168). Florencia (Vacker), 15/10/2026: «se cargan los datos y queda la
// reserva registrada en el sistema, y relacionada con la propiedad y luego
// sigue el contrato. Una vez reservada la propiedad se hace el estudio de
// garantías y si todo está OK sigue el contrato.»
import { z } from 'zod';
import {
  AjusteContratoSchema,
  CAMPOS_PERSONA,
  EventoDtoSchema,
  GarantiaDtoSchema,
  IndiceAlquilerSchema,
  MedioCobroSchema,
  MonedaAlquilerSchema,
  PapelContratoSchema,
  RegistroSchema,
  TipoContratoSchema,
  type MarcadorPlantilla,
} from './alquileres';

const FechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera AAAA-MM-DD.');
const Monto = z.number().nonnegative().max(999_999_999_999.99);
const opcional = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null);

// --- Estados (regla 155) ---------------------------------------------------------

export const EstadoReservaSchema = z.enum([
  'reservada',
  'en_estudio',
  'aprobada',
  'convertida',
  'rechazada',
  'vencida',
  'no_se_presento',
  'anulada',
]);
export type EstadoReserva = z.infer<typeof EstadoReservaSchema>;

export const NOMBRE_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  reservada: 'Reservada',
  en_estudio: 'En estudio de garantías',
  aprobada: 'Aprobada',
  convertida: 'Convertida en contrato',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
  no_se_presento: 'No se presentó a firmar',
  anulada: 'Anulada',
};

/**
 * Las abiertas: las que ocupan la propiedad (regla 156), las que se editan
 * (regla 158) y las que mira el Dashboard (regla 166). Una sola lista.
 */
export const ESTADOS_RESERVA_ABIERTOS = ['reservada', 'en_estudio', 'aprobada'] as const;
export const reservaAbierta = (e: EstadoReserva) =>
  (ESTADOS_RESERVA_ABIERTOS as readonly EstadoReserva[]).includes(e);

/**
 * Regla 155: a qué estado se puede pasar desde cada uno. `convertida` solo
 * llega al guardar el contrato (regla 159), no por un cambio de estado. Todos
 * los pasos son a mano: ninguna reserva cambia sola (regla 173).
 */
export const PASOS_RESERVA: Record<EstadoReserva, readonly EstadoReserva[]> = {
  reservada: ['en_estudio', 'vencida', 'anulada'],
  en_estudio: ['aprobada', 'rechazada', 'vencida', 'anulada'],
  aprobada: ['convertida', 'no_se_presento', 'vencida', 'anulada'],
  convertida: [],
  rechazada: [],
  vencida: [],
  no_se_presento: [],
  anulada: [],
};

/**
 * Regla 171 (Florencia, Vacker, 15/10/2026): «si la reserva vence, el
 * inquilino no se presenta a firmar o no logra presentar garantías adecuadas,
 * la seña se retiene y se le entrega al propietario».
 */
export const ESTADOS_QUE_RETIENEN_LA_SENA = ['rechazada', 'vencida', 'no_se_presento'] as const;
export const retieneLaSena = (e: EstadoReserva) =>
  (ESTADOS_QUE_RETIENEN_LA_SENA as readonly EstadoReserva[]).includes(e);

/** Las garantías se cargan antes de aprobar (regla 157). */
export const ESTADOS_RESERVA_CON_GARANTIAS = ['reservada', 'en_estudio'] as const;

const Motivo = z.string().trim().min(3, 'Escribí el motivo.').max(300);

/**
 * El propietario a quien se le entrega la seña retenida, si la reserva no
 * tiene uno cargado (regla 171): se suma a la reserva al cerrarla.
 */
const PropietarioParaLaSena = z.string().uuid({ message: 'Elegí el propietario.' }).nullish();

/** Lo que se pide para cada paso: rechazar y anular, con motivo. */
export const CambioEstadoReservaSchema = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('en_estudio') }),
  z.object({ estado: z.literal('aprobada') }),
  z.object({ estado: z.literal('vencida'), propietarioId: PropietarioParaLaSena }),
  z.object({
    estado: z.literal('no_se_presento'),
    motivo: z.string().trim().max(300).nullish(),
    propietarioId: PropietarioParaLaSena,
  }),
  z.object({
    estado: z.literal('rechazada'),
    motivo: Motivo,
    propietarioId: PropietarioParaLaSena,
  }),
  z.object({ estado: z.literal('anulada'), motivo: Motivo }),
]);
export type CambioEstadoReserva = z.infer<typeof CambioEstadoReservaSchema>;

// --- Alta y edición (regla 154) --------------------------------------------------

/** En una reserva hay los mismos papeles que en un contrato: el interesado es el futuro inquilino. */
export const ParteReservaInputSchema = z.object({
  personaId: z.string().uuid({ message: 'Elegí la persona.' }),
  papel: PapelContratoSchema,
});
export type ParteReservaInput = z.infer<typeof ParteReservaInputSchema>;

export const ReservaInputSchema = z
  .object({
    propiedadId: z.string().uuid({ message: 'Elegí la propiedad.' }),
    fecha: FechaIso,
    vence: FechaIso,
    partes: z.array(ParteReservaInputSchema).max(20),
    // La seña acordada. Cobrarla es otro paso, que da el recibo (regla 169).
    senaImporte: opcional(Monto.positive('La seña tiene que ser mayor que cero.')),
    senaMoneda: opcional(MonedaAlquilerSchema),
    // Las condiciones propuestas: pueden quedar sin cargar.
    tipo: TipoContratoSchema.default('vivienda'),
    moneda: MonedaAlquilerSchema.default('ARS'),
    alquilerInicial: opcional(Monto.positive('El alquiler tiene que ser mayor que cero.')),
    inicio: opcional(FechaIso),
    duracionMeses: opcional(z.number().int().min(1).max(240)),
    ajuste: AjusteContratoSchema.default('indexado'),
    indice: opcional(IndiceAlquilerSchema),
    periodicidadMeses: opcional(z.number().int().min(1).max(24)),
    depositoImporte: opcional(Monto),
    depositoMoneda: opcional(MonedaAlquilerSchema),
    obs: z
      .string()
      .trim()
      .max(4000)
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((r, ctx) => {
    if (r.vence < r.fecha)
      ctx.addIssue({
        code: 'custom',
        path: ['vence'],
        message: 'El vencimiento no puede ser anterior a la fecha de la reserva.',
      });
    if (!r.partes.some((p) => p.papel === 'inquilino'))
      ctx.addIssue({
        code: 'custom',
        path: ['partes'],
        message: 'Falta el interesado (el futuro inquilino).',
      });
    const vistas = new Set<string>();
    for (const p of r.partes) {
      const clave = `${p.personaId}|${p.papel}`;
      if (vistas.has(clave))
        ctx.addIssue({
          code: 'custom',
          path: ['partes'],
          message: 'La misma persona está dos veces con el mismo papel.',
        });
      vistas.add(clave);
    }
  })
  // Sin moneda, la del alquiler.
  .transform((r) => ({
    ...r,
    senaMoneda: r.senaImporte == null ? null : (r.senaMoneda ?? r.moneda),
    depositoMoneda: r.depositoImporte ? (r.depositoMoneda ?? r.moneda) : null,
    indice: r.ajuste === 'indexado' ? r.indice : null,
  }));
export type ReservaInput = z.input<typeof ReservaInputSchema>;
export type Reserva = z.output<typeof ReservaInputSchema>;

// --- Lo que devuelve la API -------------------------------------------------------

const PersonaMini = z.object({ id: z.string().uuid(), nombre: z.string() });

/**
 * Regla 169: cobrar la seña. Da un recibo de verdad —el mismo de Cobros, con
 * número, PDF y «Mandar por mail»— a nombre del interesado.
 */
export const CobrarSenaSchema = z.object({
  fecha: FechaIso,
  medio: MedioCobroSchema.default('transferencia'),
  /** Quién la paga, entre los interesados; si no se dice, el primero. */
  personaId: opcional(z.string().uuid()),
  obs: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type CobrarSenaInput = z.input<typeof CobrarSenaSchema>;
export type CobrarSena = z.output<typeof CobrarSenaSchema>;

/**
 * La seña: la acordada y, si se cobró, su recibo. «Recibida» sale del recibo
 * vigente, no de un tilde: anular el recibo la deja sin recibir.
 */
export const SenaDtoSchema = z.object({
  importe: z.number(),
  moneda: MonedaAlquilerSchema,
  recibida: z.boolean(),
  recibidaEl: FechaIso.nullable(),
  medio: MedioCobroSchema.nullable(),
  recibo: z.object({ id: z.string().uuid(), numero: z.number().int() }).nullable().default(null),
});
export type SenaDto = z.infer<typeof SenaDtoSchema>;

export const ReservaResumenDtoSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  estado: EstadoReservaSchema,
  tipo: TipoContratoSchema,
  fecha: FechaIso,
  vence: FechaIso,
  propiedad: z.object({
    id: z.string().uuid(),
    direccion: z.string(),
    unidad: z.string().nullable(),
  }),
  interesados: z.array(PersonaMini),
  sena: SenaDtoSchema.nullable(),
  contrato: z.object({ id: z.string().uuid(), codigo: z.string() }).nullable(),
});
export type ReservaResumenDto = z.infer<typeof ReservaResumenDtoSchema>;

export const ReservaDtoSchema = ReservaResumenDtoSchema.extend({
  propiedad: z.object({
    id: z.string().uuid(),
    direccion: z.string(),
    unidad: z.string().nullable(),
    ciudad: z.string().nullable(),
  }),
  partes: z.array(
    z.object({ personaId: z.string().uuid(), nombre: z.string(), papel: PapelContratoSchema }),
  ),
  moneda: MonedaAlquilerSchema,
  alquilerInicial: z.number().nullable(),
  inicio: FechaIso.nullable(),
  duracionMeses: z.number().int().nullable(),
  ajuste: AjusteContratoSchema,
  indice: IndiceAlquilerSchema.nullable(),
  periodicidadMeses: z.number().int().nullable(),
  depositoImporte: z.number().nullable(),
  depositoMoneda: MonedaAlquilerSchema.nullable(),
  obs: z.string().nullable(),
  /** El motivo del rechazo o de la anulación. */
  motivo: z.string().nullable(),
  /** Regla 171: lo que se le entrega al propietario de la seña retenida (antes de honorarios). */
  senaRetenida: z.number().nullable().default(null),
  registrado: RegistroSchema,
  garantias: z.array(GarantiaDtoSchema),
  /** La línea de tiempo: los pasos y cambios de la reserva, lo más nuevo primero. */
  historial: z.array(EventoDtoSchema),
});
export type ReservaDto = z.infer<typeof ReservaDtoSchema>;

/** Las listas de la pantalla: las abiertas (por defecto), todas o un estado. */
export const FiltroReservasSchema = z
  .union([z.literal('abiertas'), z.literal('todas'), EstadoReservaSchema])
  .catch('abiertas');
export type FiltroReservas = z.infer<typeof FiltroReservasSchema>;

/** Regla 161: la seña de la reserva de la que salió un contrato. */
export const ReservaDelContratoDtoSchema = z.object({
  reserva: z
    .object({ id: z.string().uuid(), numero: z.number().int(), sena: SenaDtoSchema.nullable() })
    .nullable(),
});
export type ReservaDelContratoDto = z.infer<typeof ReservaDelContratoDtoSchema>;

// --- La reserva en Word (reglas 162 y 163) ----------------------------------------

/**
 * Los marcadores que se pueden usar en una plantilla de RESERVA. Es la
 * única lista: con ella se valida el Word al subirlo, se arma el ejemplo y
 * un test comprueba que el armado de datos la complete entera, igual que
 * `MARCADORES_PLANTILLA` para el contrato. Los nombres que existen en las
 * dos significan lo mismo.
 */
export const MARCADORES_RESERVA: readonly MarcadorPlantilla[] = [
  {
    nombre: 'inmobiliaria',
    tipo: 'texto',
    descripcion: 'Nombre de la inmobiliaria',
    ejemplo: 'Alteva Propiedades',
  },
  { nombre: 'reserva.numero', tipo: 'texto', descripcion: 'Número de reserva', ejemplo: '12' },
  {
    nombre: 'reserva.fecha',
    tipo: 'texto',
    descripcion: 'Fecha de la reserva',
    ejemplo: '15/10/2026',
  },
  {
    nombre: 'reserva.vence',
    tipo: 'texto',
    descripcion: 'Hasta cuándo vale la reserva',
    ejemplo: '22/10/2026',
  },
  {
    nombre: 'reserva.observaciones',
    tipo: 'texto',
    descripcion: 'Observaciones de la reserva (vacío si no hay)',
    ejemplo: 'Ingresa con una mascota.',
  },
  {
    nombre: 'propiedad.direccion',
    tipo: 'texto',
    descripcion: 'Dirección, piso y depto',
    ejemplo: 'Bv. Oroño 1452 4° B',
  },
  { nombre: 'propiedad.ciudad', tipo: 'texto', descripcion: 'Ciudad', ejemplo: 'Rosario' },
  {
    nombre: 'interesado.nombre',
    tipo: 'texto',
    descripcion: 'El interesado (el primero, si son varios)',
    ejemplo: 'Ana Gómez',
  },
  {
    nombre: 'interesado.documento',
    tipo: 'texto',
    descripcion: 'Su DNI o CUIT',
    ejemplo: '27-33344455-9',
  },
  {
    nombre: 'interesado.domicilio',
    tipo: 'texto',
    descripcion: 'Su domicilio y localidad',
    ejemplo: 'San Luis 820, Rosario',
  },
  {
    nombre: 'interesado.telefono',
    tipo: 'texto',
    descripcion: 'Su teléfono',
    ejemplo: '341 555-1234',
  },
  { nombre: 'interesado.email', tipo: 'texto', descripcion: 'Su mail', ejemplo: 'ana@mail.com' },
  {
    nombre: 'interesados.texto',
    tipo: 'texto',
    descripcion: 'Todos los interesados con documento y domicilio, separados por «;»',
    ejemplo: 'Ana Gómez, DNI/CUIT 27-33344455-9, con domicilio en San Luis 820, Rosario',
  },
  {
    nombre: 'propietarios.texto',
    tipo: 'texto',
    descripcion: 'Los propietarios, igual que arriba (vacío si no se cargaron)',
    ejemplo: 'Juan Pérez, DNI/CUIT 20.123.456',
  },
  {
    nombre: 'garantes.texto',
    tipo: 'texto',
    descripcion: 'Los garantes propuestos, igual que arriba (vacío si no hay)',
    ejemplo: 'Carlos Ruiz, DNI/CUIT 22.333.444',
  },
  {
    nombre: 'sena.importe',
    tipo: 'texto',
    descripcion: 'La seña (vacío si no hay)',
    ejemplo: 'U$S 500,00',
  },
  {
    nombre: 'sena.letras',
    tipo: 'texto',
    descripcion: 'La seña, en letras',
    ejemplo: 'dólares estadounidenses quinientos',
  },
  {
    nombre: 'sena.fecha',
    tipo: 'texto',
    descripcion: 'Cuándo se recibió la seña (vacío si todavía no)',
    ejemplo: '15/10/2026',
  },
  {
    nombre: 'sena.recibo',
    tipo: 'texto',
    descripcion: 'El número del recibo de la seña (vacío si todavía no se cobró)',
    ejemplo: '000123',
  },
  {
    nombre: 'sena.medio',
    tipo: 'texto',
    descripcion: 'Cómo se recibió: transferencia, efectivo, cheque u otro',
    ejemplo: 'transferencia',
  },
  {
    nombre: 'contrato.tipo',
    tipo: 'texto',
    descripcion: 'Particular o Comercial',
    ejemplo: 'Particular',
  },
  {
    nombre: 'contrato.destino',
    tipo: 'texto',
    descripcion: 'Para qué se alquila',
    ejemplo: 'vivienda familiar',
  },
  {
    nombre: 'contrato.inicio',
    tipo: 'texto',
    descripcion: 'Inicio propuesto del contrato («[a definir]» si no se cargó)',
    ejemplo: '01/11/2026',
  },
  {
    nombre: 'contrato.fin',
    tipo: 'texto',
    descripcion: 'Fin propuesto: el inicio más la duración',
    ejemplo: '31/10/2028',
  },
  {
    nombre: 'contrato.meses',
    tipo: 'texto',
    descripcion: 'Duración propuesta en meses',
    ejemplo: '24',
  },
  {
    nombre: 'alquiler.inicial',
    tipo: 'texto',
    descripcion: 'Alquiler inicial propuesto',
    ejemplo: '$ 600.000,00',
  },
  {
    nombre: 'alquiler.inicial.letras',
    tipo: 'texto',
    descripcion: 'El mismo, en letras',
    ejemplo: 'pesos seiscientos mil',
  },
  {
    nombre: 'ajuste',
    tipo: 'texto',
    descripcion: 'Cómo se ajustaría el alquiler',
    ejemplo: 'el Índice para Contratos de Locación (ICL) del BCRA, cada 3 meses',
  },
  {
    nombre: 'deposito.importe',
    tipo: 'texto',
    descripcion: 'Depósito en garantía propuesto (vacío si no hay)',
    ejemplo: 'U$S 600,00',
  },
  {
    nombre: 'deposito.letras',
    tipo: 'texto',
    descripcion: 'El depósito, en letras',
    ejemplo: 'dólares estadounidenses seiscientos',
  },
  { nombre: 'fecha.hoy', tipo: 'texto', descripcion: 'Fecha del día', ejemplo: '15/10/2026' },
  {
    nombre: 'sena',
    tipo: 'condicion',
    descripcion: 'La reserva tiene seña',
    ejemplo: '{#sena}Se entregan {importe} ({letras}) en concepto de seña.{/sena}',
    campos: [
      { nombre: 'importe', descripcion: 'El importe', ejemplo: 'U$S 500,00' },
      { nombre: 'letras', descripcion: 'El importe en letras', ejemplo: 'dólares quinientos' },
    ],
  },
  {
    nombre: 'sena_recibida',
    tipo: 'condicion',
    descripcion: 'La seña ya se recibió (con ^ en vez de #, todavía no)',
    ejemplo: '{#sena_recibida}Recibida el {sena.fecha} por {sena.medio}.{/sena_recibida}',
  },
  {
    nombre: 'deposito',
    tipo: 'condicion',
    descripcion: 'Se propone depósito en garantía',
    ejemplo: '{#deposito}Depósito: {importe} ({letras}).{/deposito}',
    campos: [
      { nombre: 'importe', descripcion: 'El importe', ejemplo: 'U$S 600,00' },
      { nombre: 'letras', descripcion: 'El importe en letras', ejemplo: 'dólares seiscientos' },
    ],
  },
  {
    nombre: 'indexado',
    tipo: 'condicion',
    descripcion: 'El alquiler se ajustaría por un índice',
    ejemplo: '{#indexado}Se actualiza según {ajuste}.{/indexado}',
  },
  {
    nombre: 'escalonado',
    tipo: 'condicion',
    descripcion: 'El alquiler tendría importes escalonados fijos',
    ejemplo: '{#escalonado}Con importes escalonados.{/escalonado}',
  },
  {
    nombre: 'comercial',
    tipo: 'condicion',
    descripcion: 'Es para un contrato comercial (con ^ en vez de #, uno particular)',
    ejemplo: '{#comercial}Destino comercial.{/comercial}',
  },
  {
    nombre: 'interesados',
    tipo: 'lista',
    descripcion: 'Uno por cada interesado',
    ejemplo: '{#interesados}{texto}{separador}{/interesados}',
    campos: CAMPOS_PERSONA,
  },
  {
    nombre: 'propietarios',
    tipo: 'lista',
    descripcion: 'Uno por cada propietario cargado',
    ejemplo: '{#propietarios}{nombre}{separador}{/propietarios}',
    campos: CAMPOS_PERSONA,
  },
  {
    nombre: 'garantes',
    tipo: 'lista',
    descripcion: 'Uno por cada garante propuesto (si no hay, lo que encierra no aparece)',
    ejemplo: '{#garantes}{nombre}, DNI {documento}{separador}{/garantes}',
    campos: CAMPOS_PERSONA,
  },
  {
    nombre: 'garantias',
    tipo: 'lista',
    descripcion: 'Una por cada garantía del estudio, con su informe',
    ejemplo: '{#garantias}{tipo}: {garante} ({estado}){/garantias}',
    campos: [
      { nombre: 'tipo', descripcion: 'Tipo de garantía', ejemplo: 'Propietaria' },
      { nombre: 'garante', descripcion: 'Quién garantiza', ejemplo: 'Carlos Ruiz' },
      {
        nombre: 'detalle',
        descripcion: 'Lo que garantiza (la propiedad, la póliza, el empleador)',
        ejemplo: 'Mendoza 900, Rosario',
      },
      {
        nombre: 'estado',
        descripcion: 'Estado del informe: pendiente, aprobada o rechazada',
        ejemplo: 'aprobada',
      },
    ],
  },
];
