import Link from 'next/link';
import type { ReservaDelContratoDto } from '@vacker/types';
import { textoSena } from './reservas-piezas';

/**
 * Regla 161: en la ficha del contrato que salió de una reserva, la seña que
 * se dejó y el enlace a la reserva. Solo se muestra: qué se hace con la seña
 * (si se aplica al primer mes, si se le pasa al propietario) lo define la
 * inmobiliaria, y el sistema no lo contabiliza.
 */
export function ReservaDelContrato({ reserva }: { reserva: ReservaDelContratoDto['reserva'] }) {
  if (!reserva) return null;
  return (
    <p className="rounded-brand border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm">
      <span aria-hidden className="mr-1.5">
        🔖
      </span>
      Salió de la{' '}
      <Link
        href={`/alquileres/reservas/${reserva.id}`}
        className="font-semibold text-brand-red hover:underline"
      >
        reserva {reserva.numero}
      </Link>
      .{' '}
      {reserva.sena ? (
        <>
          <span className="font-semibold">Seña de la reserva {reserva.numero}:</span>{' '}
          {textoSena(reserva.sena)}.
        </>
      ) : (
        'Sin seña.'
      )}
    </p>
  );
}
