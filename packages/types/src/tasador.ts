// Contratos base del módulo Tasador de Propiedades (Sprint 0). Vocabulario
// tomado de docs/prototipos/tasador_de_propiedades.html — Sprint 1 agrega los
// DTOs completos de alta/edición reusando estos enums.
import { z } from 'zod';

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
