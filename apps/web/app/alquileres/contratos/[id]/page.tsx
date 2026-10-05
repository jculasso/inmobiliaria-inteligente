import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getContrato } from '../../../../lib/alquileres-api';
import { ContratoFicha } from '../../../../components/alquileres/contrato-ficha';

export const metadata = { title: 'Contrato · Alquileres' };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  return <ContratoFicha contrato={await getContrato(ctx.accessToken, id)} />;
}
