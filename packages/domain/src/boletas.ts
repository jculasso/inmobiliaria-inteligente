// «Para pagar» de Impuestos y servicios (spec alquileres-fase-1.md, regla 48).
import { sumarDiasIso } from './alquileres';

/** Lo mínimo de una boleta para saber en qué grupo va. */
export interface BoletaParaAgrupar {
  id: string;
  estado: 'pendiente' | 'pagada' | 'anulada';
  /** `YYYY-MM-DD`. */
  vencimiento: string;
  /** `YYYY-MM`. */
  periodo: string;
}

export interface BoletasPorUrgencia<T> {
  /** Pendientes que ya vencieron, de cualquier mes. */
  vencidas: T[];
  /** Pendientes que vencen de hoy a 7 días, de cualquier mes. */
  semana: T[];
  /** Pendientes del mes elegido que vencen después de esta semana. */
  masAdelante: T[];
  /** Pagadas (o con comprobante) del mes elegido. */
  pagadas: T[];
  /** Anuladas del mes elegido: van al final, apagadas. */
  anuladas: T[];
}

/** Los días que cuenta «esta semana»: hoy y los siete siguientes. */
export const DIAS_SEMANA_BOLETAS = 7;

/**
 * Agrupa por urgencia lo que llega de dos listas que se pisan —las pendientes
 * de todos los meses que vencen hasta dentro de una semana, y las del mes
 * elegido—. Cada boleta queda en UN grupo: una del mes que ya venció va a
 * «Vencidas», no también a «Más adelante». Dentro de cada grupo, por
 * vencimiento.
 */
export function agruparPorUrgencia<T extends BoletaParaAgrupar>(
  boletas: T[],
  hoy: string,
  periodo: string,
): BoletasPorUrgencia<T> {
  const limite = sumarDiasIso(hoy, DIAS_SEMANA_BOLETAS);
  const grupos: BoletasPorUrgencia<T> = {
    vencidas: [],
    semana: [],
    masAdelante: [],
    pagadas: [],
    anuladas: [],
  };
  const vistas = new Set<string>();
  const ordenadas = [...boletas].sort((a, b) =>
    a.vencimiento < b.vencimiento ? -1 : a.vencimiento > b.vencimiento ? 1 : 0,
  );
  for (const b of ordenadas) {
    if (vistas.has(b.id)) continue;
    vistas.add(b.id);
    if (b.estado === 'pendiente') {
      if (b.vencimiento < hoy) grupos.vencidas.push(b);
      else if (b.vencimiento <= limite) grupos.semana.push(b);
      else if (b.periodo === periodo) grupos.masAdelante.push(b);
    } else if (b.periodo === periodo) {
      grupos[b.estado === 'pagada' ? 'pagadas' : 'anuladas'].push(b);
    }
  }
  return grupos;
}
