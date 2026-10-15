import type { ContratoDto, ReservaDto } from '@vacker/types';
import { generarTramos, sumarDiasIso, sumarMesesIso } from '@vacker/domain';

/**
 * Lo que precarga el alta de contrato: un contrato que se edita (completo) o
 * el borrador que sale de una reserva, que trae solo lo que la reserva sabe.
 * Lo que falta —honorarios, días de vencimiento— queda con lo que el
 * formulario ponga por defecto.
 */
export type PrecargaContrato = Partial<Omit<ContratoDto, 'propiedad' | 'partes' | 'tramos'>> &
  Pick<ContratoDto, 'partes' | 'tramos'> & { propiedad: { id: string } };

/** El fin propuesto: el inicio más la duración, menos un día (del 1/11/2026 por 24 meses, el 31/10/2028). */
export function finDeReserva(inicio: string | null, meses: number | null): string | null {
  return inicio && meses ? sumarDiasIso(sumarMesesIso(inicio, meses), -1) : null;
}

/**
 * Regla 159: el contrato que sale de una reserva aprobada, precargado con
 * todo lo que la reserva tiene —propiedad, partes, condiciones, depósito—.
 *
 * Sin módulo `'use client'`: lo llama la página del servidor, y una función
 * de un módulo cliente no se puede llamar desde ahí (`server-imports.test.ts`).
 */
export function contratoDesdeReserva(r: ReservaDto): PrecargaContrato {
  const fin = finDeReserva(r.inicio, r.duracionMeses);
  // Los tramos con la periodicidad propuesta; si no hay, uno solo por todo el plazo.
  const bases =
    r.inicio && fin
      ? r.periodicidadMeses
        ? generarTramos(r.inicio, fin, r.periodicidadMeses)
        : [{ numero: 1, desde: r.inicio, hasta: fin }]
      : [];
  return {
    propiedad: { id: r.propiedad.id },
    tipo: r.tipo,
    moneda: r.moneda,
    inicio: r.inicio ?? undefined,
    fin: fin ?? undefined,
    ajuste: r.ajuste,
    indice: r.indice ?? undefined,
    periodicidadMeses: r.periodicidadMeses ?? undefined,
    // Florencia (Vacker), 15/10/2026: «se pide un mes de seña, que coincide
    // con el depósito». Sin depósito propuesto, el de la seña cobrada.
    depositoImporte: r.depositoImporte ?? (r.sena?.recibida ? r.sena.importe : undefined),
    depositoMoneda: r.depositoMoneda ?? (r.sena?.recibida ? r.sena.moneda : undefined),
    obs: r.obs ?? undefined,
    partes: r.partes.map((p) => ({ ...p, porcentaje: null })),
    tramos: bases.map((t, i) => ({
      ...t,
      // El alquiler inicial va en el primero; los demás se indexan (o se completan, si es escalonado).
      importe: i === 0 ? r.alquilerInicial : null,
      confirmadoEl: null,
      indiceBase: null,
      indiceRequerido: null,
      importePropuesto: null,
    })),
  };
}
