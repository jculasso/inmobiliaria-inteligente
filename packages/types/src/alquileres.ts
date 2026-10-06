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

const FechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida, se espera AAAA-MM-DD.');

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

/**
 * Un CUIT/CUIL con su dígito verificador correcto (módulo 11, pesos
 * 5-4-3-2-7-6-5-4-3-2). Atrapa el error de tipeo más común: un dígito cambiado.
 */
export function cuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(cuit[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(cuit[10]);
}

/**
 * Un CBU con sus dos dígitos verificadores (BCRA): el del bloque del banco y
 * sucursal, y el de la cuenta. Un CBU mal copiado es plata transferida a otra
 * persona: se rechaza antes de guardarlo.
 */
export function cbuValido(cbu: string): boolean {
  if (!/^\d{22}$/.test(cbu)) return false;
  const dv = (digitos: string, pesos: number[]) => (10 - (pesos.reduce((s, p, i) => s + p * Number(digitos[i]), 0) % 10)) % 10;
  const bloque1 = cbu.slice(0, 8);
  const bloque2 = cbu.slice(8);
  return dv(bloque1, [7, 1, 3, 9, 7, 1, 3]) === Number(bloque1[7]) && dv(bloque2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === Number(bloque2[13]);
}

/** El alias de una cuenta: de 6 a 20 caracteres, letras, números, puntos y guiones. */
export function aliasValido(alias: string): boolean {
  return /^[a-z0-9.-]{6,20}$/i.test(alias);
}

export const CondicionIvaSchema = z.enum(['consumidor_final', 'responsable_inscripto', 'monotributista', 'exento', 'no_responsable']);
export type CondicionIva = z.infer<typeof CondicionIvaSchema>;
export const NOMBRE_CONDICION_IVA: Record<CondicionIva, string> = {
  consumidor_final: 'Consumidor final',
  responsable_inscripto: 'Responsable inscripto',
  monotributista: 'Monotributista',
  exento: 'Exento',
  no_responsable: 'No responsable',
};

export const EstadoCivilSchema = z.enum(['soltero', 'casado', 'divorciado', 'viudo', 'union_convivencial']);
export type EstadoCivil = z.infer<typeof EstadoCivilSchema>;
export const NOMBRE_ESTADO_CIVIL: Record<EstadoCivil, string> = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
  union_convivencial: 'Unión convivencial',
};

/** El CUIT/CUIL, normalizado y con su dígito verificador. */
const CuitOpcional = z
  .string()
  .nullish()
  .transform(normalizarDocumento)
  .refine((d) => d === null || cuitValido(d), 'El CUIT/CUIL no es válido: revisá los 11 números.');

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
  // Información básica completa, como la ficha de clientes de Gexion (punto 14).
  cuit: CuitOpcional,
  condicionIva: CondicionIvaSchema.nullish().transform((v) => v ?? null),
  localidad: textoOpcional,
  provincia: textoOpcional,
  codigoPostal: textoOpcional,
  // Datos personales (personas físicas).
  fechaNacimiento: FechaIso.nullish().transform((v) => v ?? null),
  nacionalidad: textoOpcional,
  estadoCivil: EstadoCivilSchema.nullish().transform((v) => v ?? null),
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
  // Con `default` por el orden de despliegue: la web nueva puede hablar un rato con la API anterior.
  cuit: z.string().nullable().default(null),
  condicionIva: CondicionIvaSchema.nullable().default(null),
  localidad: z.string().nullable().default(null),
  provincia: z.string().nullable().default(null),
  codigoPostal: z.string().nullable().default(null),
  fechaNacimiento: FechaIso.nullable().default(null),
  nacionalidad: z.string().nullable().default(null),
  estadoCivil: EstadoCivilSchema.nullable().default(null),
});
export type PersonaDto = z.infer<typeof PersonaDtoSchema>;

/**
 * Una cuenta bancaria de la persona (Gexion, «Gestión administrativa»): a
 * dónde se le transfiere al propietario. CBU y alias se validan.
 */
export const CuentaBancariaInputSchema = z
  .object({
    banco: z.string().trim().min(1, 'Falta el banco.').max(80),
    tipo: z.enum(['caja_ahorro', 'cuenta_corriente']).default('caja_ahorro'),
    moneda: z.enum(['ARS', 'USD']).default('ARS'),
    numero: textoOpcional,
    cbu: z
      .string()
      .nullish()
      .transform(normalizarDocumento)
      .refine((v) => v === null || cbuValido(v), 'El CBU no es válido: son 22 números y los dígitos verificadores no cierran.'),
    alias: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v.toLowerCase() : null))
      .refine((v) => v === null || aliasValido(v), 'El alias tiene de 6 a 20 caracteres: letras, números, puntos o guiones.'),
    titular: textoOpcional,
    cuitTitular: CuitOpcional,
    principal: z.boolean().default(false),
  })
  .refine((c) => c.cbu || c.alias, { message: 'Cargá el CBU o el alias.', path: ['cbu'] });
export type CuentaBancariaInput = z.input<typeof CuentaBancariaInputSchema>;
export type CuentaBancaria = z.output<typeof CuentaBancariaInputSchema>;
export const CuentaBancariaDtoSchema = z.object({
  id: z.string().uuid(),
  banco: z.string(),
  tipo: z.enum(['caja_ahorro', 'cuenta_corriente']),
  moneda: z.enum(['ARS', 'USD']),
  numero: z.string().nullable(),
  cbu: z.string().nullable(),
  alias: z.string().nullable(),
  titular: z.string().nullable(),
  cuitTitular: z.string().nullable(),
  principal: z.boolean(),
});
export type CuentaBancariaDto = z.infer<typeof CuentaBancariaDtoSchema>;

/** Un contacto adicional de la persona: el hijo que paga, el contador, el administrador. */
export const ContactoInputSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre.').max(120),
  relacion: textoOpcional,
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, 'El email no es válido.'),
  telefono: textoOpcional,
  principal: z.boolean().default(false),
});
export type ContactoInput = z.input<typeof ContactoInputSchema>;
export type Contacto = z.output<typeof ContactoInputSchema>;
export const ContactoDtoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  relacion: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  principal: z.boolean(),
});
export type ContactoDto = z.infer<typeof ContactoDtoSchema>;

export const CuentasBancariasInputSchema = z.object({ cuentas: z.array(CuentaBancariaInputSchema).max(10) });
export const ContactosInputSchema = z.object({ contactos: z.array(ContactoInputSchema).max(20) });

/** Mandar un recibo o una liquidación por mail (punto 14, con Resend). */
export const EnviarPorMailSchema = z.object({
  para: z
    .array(z.string().trim().toLowerCase().email('Hay un email que no es válido.'))
    .min(1, 'Elegí a quién mandarlo.')
    .max(5),
});
export type EnviarPorMail = z.infer<typeof EnviarPorMailSchema>;
export const EnvioMailDtoSchema = z.object({ enviado: z.boolean(), para: z.array(z.string()) });
export type EnvioMailDto = z.infer<typeof EnvioMailDtoSchema>;

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

/**
 * `anulado`: se cargó por error y se deshizo, con motivo (decidido con Javier
 * el 6/10/2026: lo que tiene historia no se borra, se anula).
 */
export const EstadoContratoSchema = z.enum(['borrador', 'vigente', 'finalizado', 'rescindido', 'anulado']);
export type EstadoContrato = z.infer<typeof EstadoContratoSchema>;

export const TipoContratoSchema = z.enum(['vivienda', 'comercial']);
export type TipoContrato = z.infer<typeof TipoContratoSchema>;

/**
 * Cómo se llama cada tipo en pantalla: «Particular» y «Comercial», como en
 * Gexion (decidido con Javier el 6/10/2026). En la base sigue `vivienda`.
 */
export const NOMBRE_TIPO_CONTRATO: Record<TipoContrato, string> = { vivienda: 'Particular', comercial: 'Comercial' };

/**
 * El prefijo de los códigos de contrato de una inmobiliaria: las tres primeras
 * letras de su nombre corto, o de su nombre. «Alteva Propiedades» → «ALT»,
 * «Vacker» → «VAC» (pedido de Javier del 6/10/2026). La migración
 * `alquileres_trazabilidad` hace la misma cuenta en SQL.
 */
export function prefijoDeContratos(nombre: string): string {
  const letras = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '');
  return letras.slice(0, 3).toUpperCase() || 'CTO';
}

/** «ALT-0005»: el prefijo y el número con cuatro cifras. */
export function codigoDeContrato(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(4, '0')}`;
}

/** La persona del equipo que registró algo, con el nombre que tenía ese día. */
export const RegistroSchema = z.object({ en: z.string(), por: z.string().nullable() });
export type Registro = z.infer<typeof RegistroSchema>;

/** Una anulación: cuándo, quién y por qué. */
export const AnulacionSchema = z.object({ en: z.string(), motivo: z.string(), por: z.string().nullable().default(null) });

/** El filtro del tablero: todos, o un tipo. */
export const FiltroTipoContratoSchema = z.enum(['todos', 'vivienda', 'comercial']);
export type FiltroTipoContrato = z.infer<typeof FiltroTipoContratoSchema>;

/** Cuántos días adelante mira el tablero las indexaciones y los escalones (Gexion: 60). */
export const DIAS_TABLERO_PROXIMOS = 60;

export const MonedaAlquilerSchema = z.enum(['ARS', 'USD']);
export type MonedaAlquiler = z.infer<typeof MonedaAlquilerSchema>;

export const AjusteContratoSchema = z.enum(['indexado', 'escalonado']);
export type AjusteContrato = z.infer<typeof AjusteContratoSchema>;

/** Los índices de la cartera de Vacker: 43 contratos por ICL, 32 por IPC, 1 por Casa Propia. */
export const IndiceAlquilerSchema = z.enum(['ICL', 'IPC', 'CCP']);
export type IndiceAlquiler = z.infer<typeof IndiceAlquilerSchema>;

export const PapelContratoSchema = z.enum(['propietario', 'inquilino', 'garante']);
export type PapelContrato = z.infer<typeof PapelContratoSchema>;

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
  /** Quién lo cargó y cuándo; `por` es null en los cargados antes de que se guardara. */
  registrado: RegistroSchema.default({ en: '', por: null }),
  anulado: AnulacionSchema.nullable().default(null),
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
      /** Los valores del índice con que se calculó el tramo (punto 3 de Javier). */
      indiceBase: z.number().nullable().default(null),
      indiceRequerido: z.number().nullable().default(null),
      importePropuesto: z.number().nullable().default(null),
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

/** Anular cualquier cosa con historia: el motivo es obligatorio. */
export const AnularConMotivoSchema = z.object({ motivo: z.string().trim().min(3, 'Escribí el motivo.').max(300) });
export type AnularConMotivo = z.infer<typeof AnularConMotivoSchema>;

/**
 * Lo que se edita de un contrato vigente: lo que no toca plata (decidido con
 * Javier el 6/10/2026). Importes, tramos y porcentajes, solo en borrador.
 */
export const ContratoDatosSchema = z.object({
  fechaFirma: FechaIso.nullish().transform((v) => v ?? null),
  diaVencimiento: z.number().int().min(1).max(28),
  diaPagoPropietario: z.number().int().min(1).max(28),
  obs: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type ContratoDatos = z.infer<typeof ContratoDatosSchema>;

// --- Historial (pedido de Javier del 6/10/2026: quién registró cada cosa) --------

export const EntidadEventoSchema = z.enum(['contrato', 'persona', 'propiedad', 'concepto', 'cobro', 'liquidacion', 'tramo', 'documento']);
export type EntidadEvento = z.infer<typeof EntidadEventoSchema>;

export const AccionEventoSchema = z.enum(['alta', 'edicion', 'estado', 'anulacion', 'borrado', 'indexacion', 'generacion', 'documento', 'envio']);
export type AccionEvento = z.infer<typeof AccionEventoSchema>;

export const EventoDtoSchema = z.object({
  id: z.string().uuid(),
  en: z.string(),
  usuario: z.string().nullable(),
  entidad: EntidadEventoSchema,
  accion: AccionEventoSchema,
  resumen: z.string(),
});
export type EventoDto = z.infer<typeof EventoDtoSchema>;

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
  // Cargos de ingreso (entrega 14): se cargan al firmar el contrato.
  'comision',
  'informe',
  'deposito',
  'sellado',
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
  anulado: AnulacionSchema.nullable(),
  /** Lo que falta cobrar o pagar. */
  saldo: z.number().default(0),
  /** Qué es la persona en ese contrato: «Cobrar a» el inquilino, «Descontar a» o «Pagar a» el propietario. */
  papel: z.enum(['inquilino', 'propietario']).nullable().default(null),
  /** Cómo está, en palabras (punto 4 de Javier): se calcula en la API. */
  estado: z.enum(['pendiente', 'parcial', 'cobrado', 'pagado', 'liquidado', 'anulado']).default('pendiente'),
  registrado: RegistroSchema.nullable().default(null),
});
export type ConceptoDto = z.infer<typeof ConceptoDtoSchema>;
export type EstadoConcepto = ConceptoDto['estado'];

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
  anulado: AnulacionSchema.nullable(),
  /** El operador que lo registró: va en el recibo (decidido con Javier el 6/10/2026). */
  registradoPor: z.string().nullable().default(null),
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
  registradoPor: z.string().nullable().default(null),
});
export type CobroResumenDto = z.infer<typeof CobroResumenDtoSchema>;

export const AnularCobroSchema = z.object({ motivo: z.string().trim().min(3, 'Escribí el motivo.') });

/**
 * A quién se le puede cobrar o liquidar (punto 6 de Javier): cada persona con
 * su papel —INQ o PROP—, sus contratos y lo que hay pendiente. Lo que se
 * busca en el selector es nombre, dirección o número de contrato.
 */
export const CandidatoDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  papel: z.enum(['inquilino', 'propietario']),
  contratos: z.array(z.object({ id: z.string().uuid(), codigo: z.string(), propiedad: z.string() })),
  /** Para cobrar: lo que debe. Para liquidar: lo que hay para liquidarle. Por moneda. */
  pendiente: z.array(z.object({ moneda: MonedaAlquilerSchema, importe: z.number() })),
});
export type CandidatoDto = z.infer<typeof CandidatoDtoSchema>;

export const CandidatosQuerySchema = z.object({ papel: z.enum(['inquilino', 'propietario']).default('inquilino') });
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
          tipo: z.enum(['concepto', 'cobro', 'liquidacion']),
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

// --- Liquidaciones al propietario (reglas 20 a 23) ---------------------------------

export const PrepararLiquidacionSchema = z.object({
  personaId: z.string().uuid(),
  moneda: MonedaAlquilerSchema.default('ARS'),
  fecha: FechaIso,
  /** Por query string: ids separados por coma. La vista previa con lo que se deja para después. */
  excluidos: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : []))
    .pipe(z.array(z.string().uuid())),
});
export type PrepararLiquidacion = z.infer<typeof PrepararLiquidacionSchema>;

/**
 * El contrato de una línea de liquidación, con lo que hace falta para leerla
 * sin abrirlo: qué propiedad es y quién la alquila (pedido de Javier del
 * 6/10/2026: «Inquilino, Propiedad, Propietario, todo bien organizado»).
 * Con `default` porque las liquidaciones guardadas antes no lo tienen.
 */
export const ContratoDeLiquidacionSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  propiedad: z.string().default(''),
  inquilinos: z.array(z.string()).default([]),
});
export type ContratoDeLiquidacion = z.infer<typeof ContratoDeLiquidacionSchema>;

/** Una línea de la liquidación: un concepto con lo que se le paga o se le descuenta. */
export const LineaLiquidacionSchema = z.object({
  conceptoId: z.string().uuid(),
  contrato: ContratoDeLiquidacionSchema.nullable(),
  tipo: TipoConceptoSchema,
  descripcion: z.string(),
  importe: z.number(),
});
export type LineaLiquidacion = z.infer<typeof LineaLiquidacionSchema>;

/** Las líneas de una liquidación de una misma propiedad, con lo que deja: lo cobrado menos lo descontado. */
export interface GrupoLiquidacion {
  contrato: ContratoDeLiquidacion | null;
  aPagar: LineaLiquidacion[];
  aDescontar: LineaLiquidacion[];
  enEspera: LineaLiquidacion[];
  subtotal: number;
}

/**
 * Agrupa las líneas por contrato, en el orden en que aparecen. Así se leen la
 * pantalla y el PDF: una propiedad, su inquilino y lo suyo, y después la otra.
 * Una sola función para los dos, para que no digan cosas distintas.
 */
export function agruparPorContrato(lineas: { aPagar: LineaLiquidacion[]; aDescontar: LineaLiquidacion[]; enEspera?: LineaLiquidacion[] }): GrupoLiquidacion[] {
  const grupos = new Map<string, GrupoLiquidacion>();
  const grupo = (l: LineaLiquidacion) => {
    const clave = l.contrato?.id ?? '';
    if (!grupos.has(clave)) grupos.set(clave, { contrato: l.contrato, aPagar: [], aDescontar: [], enEspera: [], subtotal: 0 });
    return grupos.get(clave)!;
  };
  for (const l of lineas.aPagar) grupo(l).aPagar.push(l);
  for (const l of lineas.aDescontar) grupo(l).aDescontar.push(l);
  for (const l of lineas.enEspera ?? []) grupo(l).enEspera.push(l);
  const suma = (xs: LineaLiquidacion[]) => xs.reduce((s, x) => s + Math.round(x.importe * 100), 0);
  return [...grupos.values()].map((g) => ({ ...g, subtotal: (suma(g.aPagar) - suma(g.aDescontar)) / 100 }));
}

export const PreparacionLiquidacionDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  moneda: MonedaAlquilerSchema,
  fecha: FechaIso,
  aPagar: z.array(LineaLiquidacionSchema),
  aDescontar: z.array(LineaLiquidacionSchema),
  /** Lo que espera a que pague el inquilino (regla 22): se muestra, no se liquida. */
  enEspera: z.array(LineaLiquidacionSchema),
  neto: z.number(),
});
export type PreparacionLiquidacionDto = z.infer<typeof PreparacionLiquidacionDtoSchema>;

export const LiquidacionInputSchema = z.object({
  personaId: z.string().uuid(),
  moneda: MonedaAlquilerSchema.default('ARS'),
  fecha: FechaIso,
  medio: MedioCobroSchema.default('transferencia'),
  /** Conceptos que se dejan para otra liquidación. Si se deja un alquiler, sus honorarios esperan con él. */
  excluidos: z.array(z.string().uuid()).default([]),
});
export type LiquidacionInput = z.input<typeof LiquidacionInputSchema>;
export type Liquidacion = z.output<typeof LiquidacionInputSchema>;

export const LiquidacionDtoSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  fecha: FechaIso,
  moneda: MonedaAlquilerSchema,
  medio: MedioCobroSchema,
  aPagar: z.array(LineaLiquidacionSchema),
  aDescontar: z.array(LineaLiquidacionSchema),
  neto: z.number(),
  anulado: AnulacionSchema.nullable(),
  registradoPor: z.string().nullable().default(null),
  /** A dónde se le transfiere: su cuenta principal en esa moneda (punto 14). */
  cuentaDestino: z
    .object({ banco: z.string(), cbu: z.string().nullable(), alias: z.string().nullable(), titular: z.string().nullable() })
    .nullable()
    .default(null),
});
export type LiquidacionDto = z.infer<typeof LiquidacionDtoSchema>;

export const LiquidacionResumenDtoSchema = z.object({
  id: z.string().uuid(),
  numero: z.number().int(),
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  fecha: FechaIso,
  moneda: MonedaAlquilerSchema,
  neto: z.number(),
  anulado: z.boolean(),
  registradoPor: z.string().nullable().default(null),
  /** Las propiedades que liquida, con sus inquilinos. */
  contratos: z.array(ContratoDeLiquidacionSchema).default([]),
});
export type LiquidacionResumenDto = z.infer<typeof LiquidacionResumenDtoSchema>;

/** Propietarios con algo para liquidar hoy, y lo que les espera. */
export const PendienteLiquidarDtoSchema = z.object({
  persona: z.object({ id: z.string().uuid(), nombre: z.string() }),
  moneda: MonedaAlquilerSchema,
  neto: z.number(),
  enEspera: z.number(),
  /** Las propiedades de las que tiene algo para liquidar o en espera, con sus inquilinos. */
  contratos: z.array(ContratoDeLiquidacionSchema).default([]),
});
export type PendienteLiquidarDto = z.infer<typeof PendienteLiquidarDtoSchema>;

export const AnularLiquidacionSchema = z.object({ motivo: z.string().trim().min(3, 'Escribí el motivo.') });
export type AnularLiquidacion = z.infer<typeof AnularLiquidacionSchema>;

// --- Tablero del módulo (reglas 26 a 32) -------------------------------------------

/** Una fila del detalle de un número del tablero. */
export const FilaTableroSchema = z.object({
  id: z.string(),
  /** A dónde lleva tocarla: la ficha del contrato o la cuenta de la persona. */
  href: z.string().nullable(),
  contrato: z.string().nullable(),
  persona: z.string().nullable(),
  detalle: z.string(),
  fecha: FechaIso.nullable(),
  importe: z.number().nullable(),
});
export type FilaTablero = z.infer<typeof FilaTableroSchema>;

/**
 * Un número del tablero con lo que cuenta (regla 26). Si `valor` es un importe,
 * las filas suman `valor`; si es una cantidad, hay `valor` filas. Salen del
 * mismo cálculo, así que no pueden contradecirse.
 */
export const IndicadorSchema = z.object({
  valor: z.number(),
  filas: z.array(FilaTableroSchema),
});
export type Indicador = z.infer<typeof IndicadorSchema>;

export const TRAMOS_MORA = ['1-30', '31-60', '61-90', '90+'] as const;
export type TramoMora = (typeof TRAMOS_MORA)[number];

export const TableroAlquileresDtoSchema = z.object({
  hoy: FechaIso,
  mes: PeriodoSchema,
  /** El año de los gráficos; `.default` por el orden de despliegue. */
  anio: z.number().int().default(new Date().getFullYear()),
  /** Qué contratos mira el tablero: todos, solo particulares o solo comerciales (punto 8 de Javier). */
  tipo: FiltroTipoContratoSchema.default('todos'),
  /** Regla 27. */
  cartera: z.object({
    vigentes: IndicadorSchema,
    vivienda: z.number().int(),
    comercial: z.number().int(),
    alquilerMensual: z.array(z.object({ moneda: MonedaAlquilerSchema, indicador: IndicadorSchema })),
    propietarios: IndicadorSchema,
    inquilinos: IndicadorSchema,
    /**
     * El reparto de la cartera vigente, como en Gexion: cantidad, alquiler
     * mensual en pesos y porcentaje de cada tipo. Siempre de todos los
     * contratos, aunque el tablero esté filtrado.
     */
    porTipo: z
      .array(z.object({ tipo: TipoContratoSchema, cantidad: z.number().int(), importe: z.number(), pct: z.number() }))
      .default([]),
  }),
  /**
   * Contratos nuevos (punto 8, «es fundamental»): los que empiezan en cada mes
   * del año elegido, con el alquiler inicial en pesos, y los del año anterior
   * para comparar. Como las ventas del Tablero Comercial.
   */
  nuevos: z
    .object({
      porMes: z.array(IndicadorSchema),
      importePorMes: z.array(z.number()),
      anterior: z.array(z.number()),
    })
    .default({ porMes: [], importePorMes: [], anterior: [] }),
  /** Regla 28: alquileres del mes, por moneda. Uno pagado en parte no cuenta como cobrado, pero suma lo pagado. */
  cobranza: z.array(
    z.object({
      moneda: MonedaAlquilerSchema,
      emitidos: IndicadorSchema,
      cobrados: IndicadorSchema,
      importeEmitido: IndicadorSchema,
      importeCobrado: IndicadorSchema,
    }),
  ),
  /** Regla 29: deuda de inquilinos vencida, por antigüedad. */
  morosidad: z.array(
    z.object({
      moneda: MonedaAlquilerSchema,
      total: IndicadorSchema,
      tramos: z.array(z.object({ tramo: z.enum(TRAMOS_MORA), indicador: IndicadorSchema })),
    }),
  ),
  /** Regla 29: lo emitido y lo cobrado al cierre de cada mes del año elegido. */
  evolucion: z.array(z.object({ mes: PeriodoSchema, moneda: MonedaAlquilerSchema, emitido: z.number(), cobrado: z.number() })),
  /** Regla 30: honorarios, gastos y punitorios cobrados por mes, del año elegido y del anterior. */
  ingresos: z.array(
    z.object({
      mes: PeriodoSchema,
      moneda: MonedaAlquilerSchema,
      honorarios: z.number(),
      gastos: z.number(),
      punitorios: z.number(),
      /** Comisiones iniciales e informes de garantía cobrados (entrega 14). */
      comisiones: z.number().default(0),
    }),
  ),
  /** Regla 31: lo que hay que hacer. */
  tareas: z.object({
    indexacionesVencidas: IndicadorSchema,
    indexacionesProximas: IndicadorSchema,
    vencen: z.array(z.object({ dias: z.union([z.literal(30), z.literal(60), z.literal(90)]), indicador: IndicadorSchema })),
    depositos: IndicadorSchema,
    liquidaciones: IndicadorSchema,
    deudores: IndicadorSchema,
    /** Regla 36: vigentes sin el contrato firmado cargado. `.default` por el orden de despliegue. */
    sinFirmar: IndicadorSchema.default({ valor: 0, filas: [] }),
    /** Escalones de contratos escalonados que empiezan en los próximos 60 días (Gexion). */
    escalones: IndicadorSchema.default({ valor: 0, filas: [] }),
  }),
});
export type TableroAlquileresDto = z.infer<typeof TableroAlquileresDtoSchema>;

// --- Firma del contrato (reglas 33 a 36) -------------------------------------------

export const EstadoFirmaSchema = z.enum(['sin_enviar', 'enviado', 'firmado_parcial', 'firmado', 'rechazado', 'vencido']);
export type EstadoFirma = z.infer<typeof EstadoFirmaSchema>;

export const EstadoFirmanteSchema = z.enum(['pendiente', 'firmado', 'rechazado']);
export type EstadoFirmante = z.infer<typeof EstadoFirmanteSchema>;

/** El documento de un contrato, sus firmantes y cada cambio de estado (reglas 33 y 34). */
export const DocumentoContratoDtoSchema = z.object({
  id: z.string().uuid(),
  contratoId: z.string().uuid(),
  estadoFirma: EstadoFirmaSchema,
  /** `manual` o el nombre del proveedor de firma. */
  proveedor: z.string().nullable(),
  nombreArchivo: z.string().nullable(),
  tieneFirmado: z.boolean(),
  firmantes: z.array(
    z.object({
      personaId: z.string().uuid(),
      nombre: z.string(),
      papel: PapelContratoSchema,
      estado: EstadoFirmanteSchema,
      firmadoEl: z.string().nullable(),
    }),
  ),
  eventos: z.array(
    z.object({
      fecha: z.string(),
      estadoAnterior: EstadoFirmaSchema.nullable(),
      estadoNuevo: EstadoFirmaSchema,
      /** `manual` o el proveedor que avisó. */
      origen: z.string(),
      detalle: z.string().nullable(),
    }),
  ),
});
export type DocumentoContratoDto = z.infer<typeof DocumentoContratoDtoSchema>;

export const DocumentoDeContratoDtoSchema = z.object({ documento: DocumentoContratoDtoSchema.nullable() });

/**
 * Un cambio cargado a mano (regla 34): el estado de cada firmante y, si hace
 * falta, que se envió o que venció. El estado del documento sale de los
 * firmantes (regla 33), no se elige.
 */
export const CambioFirmaManualSchema = z
  .object({
    marcar: z.enum(['enviado', 'vencido']).nullish().transform((v) => v ?? null),
    firmantes: z.array(z.object({ personaId: z.string().uuid(), estado: EstadoFirmanteSchema })).default([]),
    nota: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => v.marcar !== null || v.firmantes.length > 0, 'No hay ningún cambio para guardar.');
export type CambioFirmaManualInput = z.input<typeof CambioFirmaManualSchema>;
export type CambioFirmaManual = z.output<typeof CambioFirmaManualSchema>;

export const UrlArchivoDtoSchema = z.object({ url: z.string().url() });

// --- Índices (punto 3 de Javier: «¿dónde veo el ICL y el IPC?») -------------------

export const IndicesQuerySchema = z.object({
  indice: z.enum(['ICL', 'IPC']).default('ICL'),
  /** Solo para el ICL, que es diario: el rango a mostrar. Sin rango, los últimos 60 días cargados. */
  desde: FechaIso.optional(),
  hasta: FechaIso.optional(),
});
export type IndicesQuery = z.infer<typeof IndicesQuerySchema>;

export const IndicesDtoSchema = z.object({
  indice: z.enum(['ICL', 'IPC']),
  /** De dónde sale: BCRA para el ICL, INDEC para el IPC. */
  fuente: z.string(),
  /** El último valor cargado y cuándo se cargó. */
  ultimaFecha: FechaIso.nullable(),
  actualizado: z.string().nullable(),
  valores: z.array(
    z.object({
      fecha: FechaIso,
      valor: z.number(),
      /** IPC: contra el mes anterior, en %. */
      variacionMensual: z.number().nullable(),
      /** IPC: contra el mismo mes del año anterior, en %. */
      variacionInteranual: z.number().nullable(),
    }),
  ),
});
export type IndicesDto = z.infer<typeof IndicesDtoSchema>;

export const TableroAlquileresQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  tipo: FiltroTipoContratoSchema.default('todos'),
});
export type TableroAlquileresQuery = z.infer<typeof TableroAlquileresQuerySchema>;

// --- Ficha de la persona (punto 14 de Javier, como «Clientes» de Gexion) ----------

export const PersonaFichaDtoSchema = z.object({
  persona: PersonaDtoSchema,
  cuentas: z.array(CuentaBancariaDtoSchema),
  contactos: z.array(ContactoDtoSchema),
  /** Los contratos donde aparece, con su papel en cada uno. */
  contratos: z.array(
    z.object({
      id: z.string().uuid(),
      codigo: z.string(),
      papel: PapelContratoSchema,
      estado: EstadoContratoSchema,
      tipo: TipoContratoSchema,
      propiedad: z.string(),
      inicio: FechaIso,
      fin: FechaIso,
      moneda: MonedaAlquilerSchema,
      importeVigente: z.number().nullable(),
    }),
  ),
});
export type PersonaFichaDto = z.infer<typeof PersonaFichaDtoSchema>;

// --- Contrato completo (entrega 14: puntos 7, 11, 12 y 13 de Javier) ------------------

/** La configuración del módulo que edita la inmobiliaria: cargos de ingreso y depósito. */
export const ConfiguracionAlquileresSchema = z.object({
  ivaHonorariosPct: z.number().min(0).max(27),
  comisionInicialPct: z.number().min(0).max(20),
  comisionInicialCuotas: z.number().int().min(1).max(12),
  comisionInicialConIva: z.boolean(),
  selladoPct: z.number().min(0).max(5),
  selladoInquilinoPct: z.number().min(0).max(100),
  depositoGestion: z.enum(['entrega_propietario', 'retiene_inmobiliaria']),
});
export type ConfiguracionAlquileres = z.infer<typeof ConfiguracionAlquileresSchema>;

/** Un cargo de ingreso: comisión, informe de garantía, depósito o sellado. */
export const CargoIngresoSchema = z.object({
  tipo: z.enum(['comision', 'informe', 'deposito', 'sellado']),
  descripcion: z.string().trim().min(1).max(120),
  aCargoDe: z.enum(['inquilino', 'propietario']),
  importe: z.number().positive('El importe tiene que ser mayor a cero.'),
  vencimiento: FechaIso,
  /** El depósito puede ir en dólares aunque el contrato sea en pesos (Gexion). */
  moneda: MonedaAlquilerSchema.nullish().transform((v) => v ?? null),
});
export type CargoIngreso = z.infer<typeof CargoIngresoSchema>;

export const CargosIngresoDtoSchema = z.object({
  /** Ya se cargaron: no se propone de nuevo. */
  cargados: z.boolean(),
  /** El valor total del contrato con que se calcularon: alquiler inicial × meses. */
  valorTotal: z.number(),
  meses: z.number().int(),
  propuesta: z.array(CargoIngresoSchema),
});
export type CargosIngresoDto = z.infer<typeof CargosIngresoDtoSchema>;

export const CargarCargosIngresoSchema = z.object({ cargos: z.array(CargoIngresoSchema).min(1).max(30) });

/** El depósito en garantía y dónde está (punto 12). */
export const EstadoDepositoSchema = z.enum(['sin_deposito', 'a_cobrar', 'cobrado', 'entregado', 'devuelto']);
export type EstadoDeposito = z.infer<typeof EstadoDepositoSchema>;
export const DepositoDtoSchema = z.object({
  importe: z.number().nullable(),
  moneda: MonedaAlquilerSchema.nullable(),
  gestion: z.enum(['entrega_propietario', 'retiene_inmobiliaria']),
  estado: EstadoDepositoSchema,
  /** Lo que el inquilino ya pagó del depósito. */
  cobrado: z.number(),
  devueltoEl: FechaIso.nullable(),
});
export type DepositoDto = z.infer<typeof DepositoDtoSchema>;
export const DevolverDepositoSchema = z.object({ fecha: FechaIso });

/** Una garantía del contrato, con su informe (punto 11). */
export const TipoGarantiaSchema = z.enum(['propietaria', 'laboral', 'caucion', 'otra']);
export type TipoGarantia = z.infer<typeof TipoGarantiaSchema>;
export const NOMBRE_TIPO_GARANTIA: Record<TipoGarantia, string> = { propietaria: 'Propietaria', laboral: 'Laboral (recibo de sueldo)', caucion: 'Seguro de caución', otra: 'Otra' };
export const EstadoGarantiaSchema = z.enum(['pendiente', 'aprobada', 'rechazada']);
export type EstadoGarantia = z.infer<typeof EstadoGarantiaSchema>;
export const GarantiaInputSchema = z.object({
  tipo: TipoGarantiaSchema,
  /** El garante, si está cargado como persona; si no, su nombre. */
  personaId: z.string().uuid().nullish().transform((v) => v ?? null),
  garante: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
  /** Propietaria: la propiedad que garantiza. Caución: aseguradora y póliza. Laboral: empleador. */
  detalle: z.string().trim().max(300).nullish().transform((v) => (v ? v : null)),
  estado: EstadoGarantiaSchema.default('pendiente'),
  aprobadaEl: FechaIso.nullish().transform((v) => v ?? null),
  obs: z.string().trim().max(1000).nullish().transform((v) => (v ? v : null)),
});
export type GarantiaInput = z.input<typeof GarantiaInputSchema>;
export type Garantia = z.output<typeof GarantiaInputSchema>;
export const GarantiaDtoSchema = z.object({
  id: z.string().uuid(),
  tipo: TipoGarantiaSchema,
  personaId: z.string().uuid().nullable(),
  garante: z.string().nullable(),
  detalle: z.string().nullable(),
  estado: EstadoGarantiaSchema,
  aprobadaEl: FechaIso.nullable(),
  obs: z.string().nullable(),
});
export type GarantiaDto = z.infer<typeof GarantiaDtoSchema>;
export const GarantiasInputSchema = z.object({ garantias: z.array(GarantiaInputSchema).max(10) });

/** Extender un contrato vigente (punto 13): hasta cuándo, y el importe si es escalonado. */
export const ExtenderContratoSchema = z.object({
  nuevoFin: FechaIso,
  /** Escalonado: el importe del tramo nuevo. Indexado: se indexa como cualquier tramo. */
  importeBase: z.number().positive().nullish().transform((v) => v ?? null),
});
export type ExtenderContrato = z.infer<typeof ExtenderContratoSchema>;

export const CompletoContratoDtoSchema = z.object({
  deposito: DepositoDtoSchema,
  garantias: z.array(GarantiaDtoSchema),
  cargos: CargosIngresoDtoSchema,
});
export type CompletoContratoDto = z.infer<typeof CompletoContratoDtoSchema>;
