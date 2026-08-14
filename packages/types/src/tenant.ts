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
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

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

export const MODULO_KEYS = ['tablero', 'tasador', 'todo', 'protocolo', 'publicacion'] as const;
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
});
export type ModulosTenant = z.infer<typeof ModulosTenantSchema>;

/** Módulos con los que se da de alta un tenant nuevo si no se indica otra cosa. */
export const MODULOS_DEFAULT: ModulosTenant = {
  tablero: true,
  tasador: false,
  todo: false,
  protocolo: false,
  publicacion: false,
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
