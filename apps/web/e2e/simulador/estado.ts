import { reservasIniciales, type Reserva } from './datos/reservas';

/**
 * Lo que cada prueba cambia, guardado aparte por escenario (viaja en el
 * token, ver `identidad.ts`). Una prueba que cobra una seña ve el recibo al
 * refrescar; la que corre al lado sigue viendo la seña sin cobrar.
 *
 * Vive en memoria y muere con el simulador: cada corrida empieza de cero.
 */
export interface Estado {
  reservas: Reserva[];
}

const ESTADOS = new Map<string, Estado>();

export function estadoDe(escenario: string): Estado {
  let e = ESTADOS.get(escenario);
  if (!e) {
    e = { reservas: reservasIniciales() };
    ESTADOS.set(escenario, e);
  }
  return e;
}
