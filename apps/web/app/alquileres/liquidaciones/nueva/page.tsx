import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { listPersonas } from '../../../../lib/alquileres-api';
import { LiquidacionForm } from '../../../../components/alquileres/liquidacion-form';

export const metadata = { title: 'Liquidar · Alquileres' };

/** Hoy en Argentina (UTC−3): la fecha de la liquidación. */
const hoyArgentina = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export default async function NuevaLiquidacionPage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [personas, { persona }] = await Promise.all([listPersonas(ctx.accessToken), searchParams]);
  const inicial = persona && personas.some((p) => p.id === persona) ? persona : null;
  return <LiquidacionForm personas={personas} personaInicial={inicial} hoy={hoyArgentina()} />;
}
