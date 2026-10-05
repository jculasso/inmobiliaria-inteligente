import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getBandejaIndexacion } from '../../../lib/alquileres-api';
import { BandejaIndexacion } from '../../../components/alquileres/bandeja-indexacion';

export const metadata = { title: 'A indexar · Alquileres' };

export default async function IndexacionesPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <BandejaIndexacion bandeja={await getBandejaIndexacion(ctx.accessToken)} />;
}
