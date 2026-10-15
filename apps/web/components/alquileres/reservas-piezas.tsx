import {
  NOMBRE_ESTADO_RESERVA,
  reservaAbierta,
  type EstadoReserva,
  type SenaDto,
} from '@vacker/types';
import { fmtFecha, fmtMoneda, nroDocumento } from '../../lib/format';
import { Insignia, type TonoInsignia } from './piezas';
import { NOMBRE_MEDIO } from './medios';

// Las piezas que comparten la lista y la ficha de la reserva (reglas 154 a 165).

/**
 * El tono de cada estado. Rechazada y vencida van en `peligro`, nunca en el
 * color de la marca (CONVENCIONES_TECNICAS.md §13): con una marca verde, una
 * reserva caída se vería verde.
 */
const TONO: Record<EstadoReserva, TonoInsignia> = {
  reservada: 'marca',
  en_estudio: 'aviso',
  aprobada: 'exito',
  convertida: 'neutro',
  rechazada: 'peligro',
  vencida: 'peligro',
  no_se_presento: 'peligro',
  anulada: 'neutro',
};

export function EstadoReservaBadge({ estado }: { estado: EstadoReserva }) {
  return <Insignia tono={TONO[estado]}>{NOMBRE_ESTADO_RESERVA[estado]}</Insignia>;
}

/** Los días de `desde` a `hasta`, en fechas `AAAA-MM-DD` (negativo si `hasta` ya pasó). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

/**
 * Regla 164: el vencimiento, y si pasó con la reserva abierta, «vencida hace
 * N días» en rojo (`danger`, no el color de la marca).
 */
export function VenceReserva({
  vence,
  estado,
  hoy,
}: {
  vence: string;
  estado: EstadoReserva;
  hoy: string;
}) {
  const dias = diasEntre(hoy, vence);
  if (!reservaAbierta(estado) || dias >= 0)
    return (
      <span className="tabular-nums">
        {fmtFecha(vence)}
        {reservaAbierta(estado) && dias <= 7 && (
          // En el teléfono, abajo de la fecha: en la tarjeta no entra al lado.
          <span className="block text-xs font-semibold text-warning sm:ml-1 sm:inline">
            {dias === 0 ? 'vence hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`}
          </span>
        )}
      </span>
    );
  return (
    <span className="font-semibold tabular-nums text-danger">
      {fmtFecha(vence)}
      <span className="block text-xs sm:ml-1 sm:inline sm:text-sm">
        vencida hace {-dias} {dias === -1 ? 'día' : 'días'}
      </span>
    </span>
  );
}

/** «U$S 500,00 · recibida el 15/10/2026 (Transferencia)» o «U$S 500,00 · sin recibir». */
export function textoSena(sena: SenaDto | null): string {
  if (!sena) return 'Sin seña';
  const importe = fmtMoneda(sena.importe, sena.moneda);
  if (!sena.recibida) return `${importe} · sin recibir`;
  return `${importe} · recibida${sena.recibidaEl ? ` el ${fmtFecha(sena.recibidaEl)}` : ''}${sena.medio ? ` (${NOMBRE_MEDIO[sena.medio]})` : ''}${sena.recibo ? `, recibo ${nroDocumento(sena.recibo.numero)}` : ''}`;
}

/** La seña en dos renglones, para la tarjeta del teléfono: el importe y si se recibió. */
export function SenaCorta({ sena }: { sena: SenaDto | null }) {
  if (!sena) return <>Sin seña</>;
  return (
    <>
      {fmtMoneda(sena.importe, sena.moneda)}
      <span className="block text-xs text-muted">
        {sena.recibida
          ? `recibida${sena.recibidaEl ? ` el ${fmtFecha(sena.recibidaEl)}` : ''}`
          : 'sin recibir'}
      </span>
    </>
  );
}
