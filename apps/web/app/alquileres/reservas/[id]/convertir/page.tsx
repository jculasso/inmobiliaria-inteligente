import { redirect } from 'next/navigation';
import { defectosDeContrato, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../../lib/server-principal';
import {
  getConfiguracionAlquileres,
  listPersonas,
  listPropiedadesAlquiler,
} from '../../../../../lib/alquileres-api';
import { contratoDesdeReserva } from '../../../../../lib/reserva-a-contrato';
import { getReserva } from '../../../../../lib/reservas-api';
import { ContratoForm } from '../../../../../components/alquileres/contrato-form';

export const metadata = { title: 'Contrato desde la reserva · Alquileres' };

/**
 * Regla 159: el alta de contrato precargada con la reserva aprobada. Al
 * guardar, la API crea el contrato y convierte la reserva en una sola
 * transacción, y la seña cobrada pasa a ser el depósito (regla 170).
 */
export default async function ConvertirReservaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [reserva, personas, propiedades, configuracion] = await Promise.all([
    getReserva(ctx.accessToken, id),
    listPersonas(ctx.accessToken),
    listPropiedadesAlquiler(ctx.accessToken),
    getConfiguracionAlquileres(ctx.accessToken),
  ]);
  // Solo una aprobada; la API lo rechazaría igual (409).
  if (reserva.estado !== 'aprobada') redirect(`/alquileres/reservas/${id}`);
  // Lo que la reserva no dice (honorarios, días), con los valores de la inmobiliaria (regla 99).
  return (
    <ContratoForm
      personas={personas}
      propiedades={propiedades}
      defectos={defectosDeContrato(configuracion)}
      desdeReserva={{
        id: reserva.id,
        numero: reserva.numero,
        precarga: contratoDesdeReserva(reserva),
        sena: reserva.sena,
      }}
    />
  );
}
