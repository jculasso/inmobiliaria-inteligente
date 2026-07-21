import type { ModuloKey } from '@vacker/types';

/** Nombre visible de cada módulo — usado en el admin (badges por plan) y en la Home. */
export const NOMBRE_MODULO: Record<ModuloKey, string> = {
  tablero: 'Tablero Comercial',
  tasador: 'Tasador',
  todo: 'To Do List',
};
