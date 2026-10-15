import { redirect } from 'next/navigation';
import { puedeAdministrarAlquileres, reservaAbierta } from '@vacker/types';
import { requireServerPrincipal } from '../../../../../lib/server-principal';
import {
  listContratos,
  listPersonas,
  listPropiedadesAlquiler,
} from '../../../../../lib/alquileres-api';
import { getReserva } from '../../../../../lib/reservas-api';
import { ReservaForm } from '../../../../../components/alquileres/reserva-form';

export const metadata = { title: 'Editar reserva · Alquileres' };

export default async function EditarReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [reserva, personas, propiedades, contratos] = await Promise.all([
    getReserva(ctx.accessToken, id),
    listPersonas(ctx.accessToken),
    listPropiedadesAlquiler(ctx.accessToken),
    listContratos(ctx.accessToken),
  ]);
  // Regla 158: una reserva cerrada ya no se edita; la API lo rechazaría igual.
  if (!reservaAbierta(reserva.estado)) redirect(`/alquileres/reservas/${id}`);
  return (
    <ReservaForm
      personas={personas}
      propiedades={propiedades}
      contratos={contratos}
      reserva={reserva}
    />
  );
}
