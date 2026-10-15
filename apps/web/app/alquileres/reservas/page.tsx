import { FiltroReservasSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { hoyIso } from '../../../lib/format';
import { listReservas } from '../../../lib/reservas-api';
import { ReservasLista } from '../../../components/alquileres/reservas-lista';

export const metadata = { title: 'Reservas · Alquileres' };

/** Regla 164: las reservas, abiertas por defecto; `?estado=` filtra. */
export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  // Lo que no se entiende vuelve a las abiertas.
  const filtro = FiltroReservasSchema.parse((await searchParams).estado);
  const reservas = await listReservas(ctx.accessToken, filtro);
  return <ReservasLista reservas={reservas} filtro={filtro} hoy={hoyIso()} />;
}
