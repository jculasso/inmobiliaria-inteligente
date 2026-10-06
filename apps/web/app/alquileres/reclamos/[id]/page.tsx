import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getReclamo } from '../../../../lib/alquileres-api';
import { ReclamoFicha } from '../../../../components/alquileres/reclamo-ficha';

export const metadata = { title: 'Reclamo · Alquileres' };

export default async function ReclamoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  return <ReclamoFicha reclamo={await getReclamo(ctx.accessToken, id)} />;
}
