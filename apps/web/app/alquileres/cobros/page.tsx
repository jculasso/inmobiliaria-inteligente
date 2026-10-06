import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listCobros } from '../../../lib/alquileres-api';
import { CobrosLista } from '../../../components/alquileres/cobros-lista';

export const metadata = { title: 'Cobros · Alquileres' };

export default async function CobrosPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <CobrosLista cobros={await listCobros(ctx.accessToken)} />;
}
