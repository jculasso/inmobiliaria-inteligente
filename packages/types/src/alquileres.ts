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
