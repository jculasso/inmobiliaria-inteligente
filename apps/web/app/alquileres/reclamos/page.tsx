import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listContratos, listReclamos } from '../../../lib/alquileres-api';
import { ReclamosLista } from '../../../components/alquileres/reclamos-lista';

export const metadata = { title: 'Reclamos · Alquileres' };

export default async function ReclamosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const estado = (await searchParams).estado === 'todos' ? 'todos' : 'abiertos';
  const [reclamos, contratos] = await Promise.all([
    listReclamos(ctx.accessToken, { estado }),
    listContratos(ctx.accessToken),
  ]);
  return <ReclamosLista reclamos={reclamos} contratos={contratos} estado={estado} />;
}
