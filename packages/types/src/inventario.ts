// El inventario del contrato (spec alquileres-fase-1.md, reglas 150 a 153).
// Florencia (Vacker), 15/10/2026: «quieren que en el módulo se carguen …
// Inventario … y que en base a la plantilla se genere automáticamente el
// contrato».
//
// En archivo propio y sin importar valores de `alquileres.ts`: aquel arma
// `MARCADORES_PLANTILLA` con los de acá, y un import de ida y vuelta entre
// los dos dejaría a uno de ellos a medio cargar.
import { z } from 'zod';
import type { MarcadorPlantilla } from './alquileres';

/** Cuántos ítems como mucho: el de una casa amueblada entra holgado. */
export const INVENTARIO_MAX_ITEMS = 200;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const ItemInventarioSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, 'Cada ítem del inventario lleva su descripción.')
    .max(200, 'La descripción de un ítem tiene hasta 200 caracteres.'),
  cantidad: z
    .number()
    .int('La cantidad es un número entero.')
    .min(1, 'La cantidad es al menos 1.')
    .max(9999)
    .default(1),
  /** Estado u observación del ítem: «bueno», «con una quemadura en la mesada». */
  estado: textoOpcional(200),
});
export type ItemInventarioInput = z.input<typeof ItemInventarioSchema>;
export type ItemInventario = z.output<typeof ItemInventarioSchema>;

/** Regla 150: se guarda entero; la lista que llega reemplaza a la anterior. */
export const InventarioInputSchema = z.object({
  items: z
    .array(ItemInventarioSchema)
    .max(INVENTARIO_MAX_ITEMS, `El inventario tiene hasta ${INVENTARIO_MAX_ITEMS} ítems.`),
  observaciones: textoOpcional(4000),
});
export type InventarioInput = z.input<typeof InventarioInputSchema>;
export type Inventario = z.output<typeof InventarioInputSchema>;

export const InventarioDtoSchema = z.object({
  items: z.array(
    z.object({
      descripcion: z.string(),
      cantidad: z.number().int(),
      estado: z.string().nullable(),
    }),
  ),
  observaciones: z.string().nullable(),
  /** Regla 151: en borrador y vigente; en un estado final ya no. */
  editable: z.boolean(),
});
export type InventarioDto = z.infer<typeof InventarioDtoSchema>;

/**
 * Lo que está guardado en la columna `inventario` (jsonb), leído sin
 * confiar: una fila vieja tiene `[]` (regla 153) y algo que no se entienda
 * se lee como vacío en vez de tirar la ficha entera.
 */
export function leerItemsInventario(valor: unknown): ItemInventario[] {
  const r = z.array(ItemInventarioSchema).safeParse(valor);
  return r.success ? r.data : [];
}

/** Regla 151: el inventario no toca plata, así que se edita en borrador y en vigente. */
export const ESTADOS_CONTRATO_CON_INVENTARIO_EDITABLE = ['borrador', 'vigente'] as const;

/**
 * Regla 152: los marcadores del inventario en la plantilla de contrato. Se
 * suman a `MARCADORES_PLANTILLA`, así que se validan al subir el Word y
 * aparecen en el ejemplo como cualquier otro.
 */
export const MARCADORES_INVENTARIO: readonly MarcadorPlantilla[] = [
  {
    nombre: 'contrato.inventario_observaciones',
    tipo: 'texto',
    descripcion: 'Observaciones generales del inventario (vacío si no hay)',
    ejemplo: 'Las paredes se entregan recién pintadas.',
  },
  {
    nombre: 'inventario',
    tipo: 'lista',
    descripcion:
      'Uno por cada ítem del inventario (con ^ en vez de #, lo que encierra aparece solo si no hay ítems)',
    ejemplo: '{#inventario}{cantidad} × {descripcion} ({estado}){/inventario}',
    campos: [
      { nombre: 'numero', descripcion: 'Número de ítem', ejemplo: '1' },
      { nombre: 'descripcion', descripcion: 'Qué es', ejemplo: 'Cocina de 4 hornallas' },
      { nombre: 'cantidad', descripcion: 'Cuántos', ejemplo: '1' },
      {
        nombre: 'estado',
        descripcion: 'Estado u observación (vacío si no se cargó)',
        ejemplo: 'Funcionando, sin la perilla del horno',
      },
    ],
  },
];
