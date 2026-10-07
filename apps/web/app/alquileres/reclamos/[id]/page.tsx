import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getReclamo, listProveedores } from '../../../../lib/alquileres-api';
import { ReclamoFicha } from '../../../../components/alquileres/reclamo-ficha';

export const metadata = { title: 'Reclamo · Alquileres' };

export default async function ReclamoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  // Los proveedores: para elegir quién lo arregla y para cargar el gasto del arreglo.
  const [reclamo, proveedores] = await Promise.all([
    getReclamo(ctx.accessToken, id),
    listProveedores(ctx.accessToken),
  ]);
  return <ReclamoFicha reclamo={reclamo} proveedores={proveedores} />;
}
