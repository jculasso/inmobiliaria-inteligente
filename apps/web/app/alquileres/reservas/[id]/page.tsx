import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { hoyIso } from '../../../../lib/format';
import { listPlantillas } from '../../../../lib/alquileres-api';
import { getReserva } from '../../../../lib/reservas-api';
import { GenerarReserva } from '../../../../components/alquileres/generar-reserva';
import { Historial } from '../../../../components/alquileres/historial';
import { ReservaFicha } from '../../../../components/alquileres/reserva-ficha';

export const metadata = { title: 'Reserva · Alquileres' };

/** La ficha de una reserva, con su Word y la línea de tiempo (reglas 155 a 163). */
export default async function ReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [reserva, plantillas] = await Promise.all([
    getReserva(ctx.accessToken, id),
    listPlantillas(ctx.accessToken),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <ReservaFicha reserva={reserva} hoy={hoyIso()} />
      <GenerarReserva reserva={reserva} plantillas={plantillas} />
      <Historial eventos={reserva.historial} />
    </div>
  );
}
