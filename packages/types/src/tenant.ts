// Forma de un tenant (inmobiliaria) compartida entre auth (/me) y admin.
import { z } from 'zod';

export const PlanTenantSchema = z.enum(['basico', 'profesional', 'enterprise']);
export type PlanTenant = z.infer<typeof PlanTenantSchema>;

/** Branding propio del tenant — pensado para no pisar la imagen de marca de cada inmobiliaria. */
export const TenantConfigSchema = z.object({
  logoUrl: z.string().url().nullish(),
  colorPrimario: z.string().nullish(),
  colorPrimarioOscuro: z.string().nullish(),
  nombreCorto: z.string().nullish(),
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

export const MODULO_KEYS = ['tablero', 'tasador', 'todo'] as const;
export type ModuloKey = (typeof MODULO_KEYS)[number];

/** Qué módulos trae cada plan. `todo` (To Do List) figura en Enterprise aunque el módulo todavía no exista. */
export const MODULOS_POR_PLAN: Record<PlanTenant, ModuloKey[]> = {
  basico: ['tablero'],
  profesional: ['tablero', 'tasador'],
  enterprise: ['tablero', 'tasador', 'todo'],
};
