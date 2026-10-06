import type { IndiceAlquiler, PapelContrato } from '@vacker/types';

// Nombres para leer de claves que viajan en la API. Deberían vivir en
// `@vacker/types` junto a `NOMBRE_ESTADO_CONTRATO`; mientras tanto, una sola
// copia acá en vez de una por pantalla.

/** «CCP» no lo entiende nadie: es Casa Propia. */
export const NOMBRE_INDICE: Record<IndiceAlquiler, string> = { ICL: 'ICL', IPC: 'IPC', CCP: 'Casa Propia' };

/** El papel de cada parte en un contrato, como se dice. */
export const NOMBRE_PAPEL: Record<PapelContrato, string> = { propietario: 'Propietario', inquilino: 'Inquilino', garante: 'Garante' };
