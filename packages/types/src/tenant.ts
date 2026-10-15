// Forma de un tenant (inmobiliaria) compartida entre auth (/me) y admin.
import { z } from 'zod';

export const PlanTenantSchema = z.enum(['basico', 'profesional', 'enterprise']);
export type PlanTenant = z.infer<typeof PlanTenantSchema>;

/**
 * Configuración propia de cada inmobiliaria: su marca, y su criterio de
 * tasación.
 *
 * Los coeficientes valen 1 y 0,3 por defecto porque ese es el criterio con el
 * que se escribió el sistema —el de Vacker— y así una inmobiliaria que no los
 * toca sigue calculando exactamente igual que antes, sin migrar un solo dato.
 */
export const TenantConfigSchema = z.object({
  logoUrl: z.string().url().nullish(),
  colorPrimario: z.string().nullish(),
  colorPrimarioOscuro: z.string().nullish(),
  nombreCorto: z.string().nullish(),
  /**
   * Cuánto pesa cada metro semicubierto, de 0 a 1. Vacker lo cuenta entero.
   *
   * El máximo es 1 y no más: un metro semicubierto que valiera más que uno
   * cubierto no es un criterio de tasación, es un error de carga.
   */
  coefSemicubierta: z.number().min(0).max(1).default(1),
  /** Cuánto pesa cada metro descubierto, de 0 a 1. Vacker usa 0,3. */
  coefDescubierta: z.number().min(0).max(1).default(0.3),
  /**
   * IVA que la inmobiliaria le suma a sus honorarios y gastos administrativos
   * en el módulo Alquileres (regla 12). 21 por defecto: Vacker es responsable
   * inscripta, y en Gexion un 8% de honorarios se cobra 9,68%. Una
   * monotributista pone 0.
   */
  ivaHonorariosPct: z.number().min(0).max(27).default(21),
  /**
   * Cargos de ingreso de un contrato de alquiler (Javier, 6/10/2026: «la
   * comisión la podemos dejar parametrizable»). Por defecto, como Vacker: 5%
   * del valor total del contrato, más IVA, en 2 cuotas, a cargo del inquilino.
   */
  comisionInicialPct: z.number().min(0).max(20).default(5),
  comisionInicialCuotas: z.number().int().min(1).max(12).default(2),
  comisionInicialConIva: z.boolean().default(true),
  /**
   * Sellado de antes del 15/10/2026: UNA alícuota para todos los contratos.
   * Ya no se escribe; se lee solo para traducirla a las tres de abajo en una
   * configuración guardada antes (`selladoDeLaInmobiliaria`, regla 103).
   */
  selladoPct: z.number().min(0).max(5).optional(),
  /**
   * Sellado por tipo de contrato (regla 103; Florencia, Vacker, 15/10/2026):
   * particulares exentos; comerciales 1%, o 0,25% si el inquilino tiene
   * certificado MiPyme; sobre el valor total del contrato. Sin `.default()` a
   * propósito: un campo ausente quiere decir «nunca se configuró», y en ese
   * caso manda la alícuota vieja si había una (ver `selladoDeLaInmobiliaria`).
   */
  selladoViviendaPct: z.number().min(0).max(5).optional(),
  selladoComercialPct: z.number().min(0).max(5).optional(),
  selladoComercialMipymePct: z.number().min(0).max(5).optional(),
  /** Qué parte del sellado paga el inquilino; el resto, el propietario. Florencia: el 100%. */
  selladoInquilinoPct: z.number().min(0).max(100).default(100),
  /**
   * Lo que se propone al cargar un contrato nuevo (regla 99; Florencia,
   * Vacker, 15/10/2026: «que cada inmobiliaria tenga sus valores»). Cada
   * contrato los puede cambiar. Los valores por defecto son los que el
   * formulario proponía antes, así una inmobiliaria que no configura nada ve
   * lo mismo que ayer; los de Vacker (punitorio 0,3% diario) se cargan en su
   * configuración, no acá.
   */
  contratoHonorariosPct: z.number().min(0).max(100).default(8),
  contratoGastosAdmPct: z.number().min(0).max(100).default(2),
  contratoPunitorioDiarioPct: z.number().min(0).max(10).default(0),
  contratoDiaVencimiento: z.number().int().min(1).max(28).default(5),
  contratoDiaPagoPropietario: z.number().int().min(1).max(28).default(10),
  /** El depósito en garantía: Javier, 6/10/2026, «se le entrega al propietario». */
  depositoGestion: z
    .enum(['entrega_propietario', 'retiene_inmobiliaria'])
    .default('entrega_propietario'),
  /**
   * Días para pagar la diferencia de la liquidación final, desde que se
   * confirma la indexación (regla 133). 5 por defecto: lo pidió Vacker para
   * el IPC que sale atrasado (Florencia, 15/10/2026).
   */
  diasDiferenciaFinal: z.number().int().min(0).max(60).default(5),
  /**
   * Honorarios sobre una seña retenida que se le entrega al propietario
   * (regla 171; Florencia, Vacker, 15/10/2026). 0 por defecto: la seña pasa
   * entera.
   */
  honorariosSenaRetenidaPct: z.number().min(0).max(100).default(0),
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

/** Las alícuotas de sellado por tipo de contrato, en Alquileres (regla 103). */
export interface SelladoDeLaInmobiliaria {
  viviendaPct: number;
  comercialPct: number;
  comercialMipymePct: number;
  inquilinoPct: number;
}

/** Lo que dice la ley de sellos que relevó Florencia (Vacker), 15/10/2026. */
export const SELLADO_POR_DEFECTO = {
  viviendaPct: 0,
  comercialPct: 1,
  comercialMipymePct: 0.25,
  inquilinoPct: 100,
} as const;

/**
 * Las alícuotas de sellado de una inmobiliaria (regla 103), traduciendo una
 * configuración guardada antes del 15/10/2026.
 *
 * Antes había UNA alícuota (`selladoPct`) para todo contrato. Si una
 * inmobiliaria la había puesto en algo mayor que cero, fue una decisión suya:
 * se conserva para los tres casos, así su propuesta no cambia hasta que entre
 * a Configuración y la separe. En cero —que era el valor por defecto y quería
 * decir «no se calcula»— no había decisión que respetar, y rigen las
 * alícuotas de la regla.
 */
export function selladoDeLaInmobiliaria(c: TenantConfig): SelladoDeLaInmobiliaria {
  const vieja = c.selladoPct != null && c.selladoPct > 0 ? c.selladoPct : null;
  const nueva =
    c.selladoViviendaPct != null ||
    c.selladoComercialPct != null ||
    c.selladoComercialMipymePct != null;
  return {
    viviendaPct: c.selladoViviendaPct ?? vieja ?? SELLADO_POR_DEFECTO.viviendaPct,
    comercialPct: c.selladoComercialPct ?? vieja ?? SELLADO_POR_DEFECTO.comercialPct,
    comercialMipymePct:
      c.selladoComercialMipymePct ?? vieja ?? SELLADO_POR_DEFECTO.comercialMipymePct,
    // El reparto viejo (50% por defecto) solo decía algo si había sellado: con
    // la alícuota en cero se guardaba igual, sin que nadie lo eligiera.
    inquilinoPct: nueva || vieja != null ? c.selladoInquilinoPct : SELLADO_POR_DEFECTO.inquilinoPct,
  };
}

/** La alícuota de un contrato: particular, o comercial con o sin certificado MiPyme. */
export function alicuotaDeSellado(
  s: Pick<SelladoDeLaInmobiliaria, 'viviendaPct' | 'comercialPct' | 'comercialMipymePct'>,
  tipo: 'vivienda' | 'comercial',
  inquilinoMipyme: boolean,
): number {
  if (tipo === 'vivienda') return s.viviendaPct;
  return inquilinoMipyme ? s.comercialMipymePct : s.comercialPct;
}

/**
 * Lo que se puede ESCRIBIR: los coeficientes son opcionales, porque quien manda
 * una configuración parcial —el que sube un logo, por ejemplo— no tiene por qué
 * repetir el criterio de tasación.
 *
 * Al leer, en cambio, siempre están: `TenantConfigSchema` les pone su valor por
 * defecto. Esa asimetría es a propósito — el que escribe puede omitirlos, el
 * que calcula nunca se los encuentra en `undefined`.
 */
export type TenantConfigInput = z.input<typeof TenantConfigSchema>;

/** Una configuración con todo en su valor por defecto (el criterio de Vacker). */
export function configPorDefecto(): TenantConfig {
  return TenantConfigSchema.parse({});
}

export const MODULO_KEYS = [
  'tablero',
  'tasador',
  'todo',
  'protocolo',
  'publicacion',
  'alquileres',
] as const;
export type ModuloKey = (typeof MODULO_KEYS)[number];

/**
 * Módulos habilitados de un tenant. Cada uno se prende/apaga por separado desde
 * el admin ("habilitado / pagado"): es la fuente de verdad de qué ve cada
 * inmobiliaria. `plan` quedó como etiqueta comercial, sin efecto en permisos.
 *
 * Todas las claves son obligatorias: la columna tiene default en la base y cada
 * módulo nuevo trae su propia migración agregando la clave a las filas que ya
 * existen (como hicieron `protocolo` y `publicacion`).
 */
export const ModulosTenantSchema = z.object({
  tablero: z.boolean(),
  tasador: z.boolean(),
  todo: z.boolean(),
  protocolo: z.boolean(),
  publicacion: z.boolean(),
  /**
   * Con `.default(false)` y no obligatoria como las demás, a propósito: la web
   * (Vercel) se publica antes que la API (Render). En esos minutos la API vieja
   * devuelve los módulos sin esta clave, y una clave obligatoria rompería la
   * Home de todas las inmobiliarias. La migración la completa en la base.
   */
  alquileres: z.boolean().default(false),
});
export type ModulosTenant = z.infer<typeof ModulosTenantSchema>;

/** Módulos con los que se da de alta un tenant nuevo si no se indica otra cosa. */
export const MODULOS_DEFAULT: ModulosTenant = {
  tablero: true,
  tasador: false,
  todo: false,
  protocolo: false,
  publicacion: false,
  alquileres: false,
};

/** Lista de claves habilitadas, para iterar (la Home arma las tarjetas con esto). */
export function modulosHabilitados(modulos: ModulosTenant): ModuloKey[] {
  return MODULO_KEYS.filter((k) => modulos[k]);
}

/**
 * Backfill de tenants existentes: qué módulos correspondían a cada plan antes
 * de que el licenciamiento pasara a checks independientes. Se usa una sola vez
 * en la migración; no decide permisos en runtime.
 */
export const MODULOS_POR_PLAN_LEGACY: Record<PlanTenant, ModuloKey[]> = {
  basico: ['tablero'],
  profesional: ['tablero', 'tasador', 'todo'],
  enterprise: ['tablero', 'tasador', 'todo'],
};
