import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listContratos } from '../../../lib/alquileres-api';
import { ContratosLista } from '../../../components/alquileres/contratos-lista';
import { hoyIso } from '../../../lib/format';

export const metadata = { title: 'Contratos · Alquileres' };

/** Hoy en Argentina (UTC−3): para marcar las indexaciones vencidas. */

export default async function ContratosPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <ContratosLista contratos={await listContratos(ctx.accessToken)} hoy={hoyIso()} />;
}
