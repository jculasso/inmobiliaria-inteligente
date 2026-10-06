import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { listPersonas } from '../../../../lib/alquileres-api';
import { CobroForm } from '../../../../components/alquileres/cobro-form';

export const metadata = { title: 'Nuevo cobro · Alquileres' };

/** Hoy en Argentina (UTC−3): la fecha por defecto del cobro, de la que depende el punitorio. */
const hoyArgentina = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export default async function NuevoCobroPage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [personas, { persona }] = await Promise.all([listPersonas(ctx.accessToken), searchParams]);
  const inicial = persona && personas.some((p) => p.id === persona) ? persona : null;
  return <CobroForm personas={personas} personaInicial={inicial} hoy={hoyArgentina()} />;
}
