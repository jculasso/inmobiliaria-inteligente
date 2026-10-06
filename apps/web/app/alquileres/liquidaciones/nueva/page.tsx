import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { listCandidatos } from '../../../../lib/alquileres-api';
import { LiquidacionForm } from '../../../../components/alquileres/liquidacion-form';
import { hoyIso } from '../../../../lib/format';

export const metadata = { title: 'Liquidar · Alquileres' };

/** Hoy en Argentina (UTC−3): la fecha de la liquidación. */

export default async function NuevaLiquidacionPage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [propietarios, { persona }] = await Promise.all([listCandidatos(ctx.accessToken, 'propietario'), searchParams]);
  const inicial = persona && propietarios.some((c) => c.persona.id === persona) ? persona : null;
  return <LiquidacionForm propietarios={propietarios} personaInicial={inicial} hoy={hoyIso()} />;
}
