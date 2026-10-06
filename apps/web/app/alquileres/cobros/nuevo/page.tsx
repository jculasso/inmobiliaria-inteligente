import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { listCandidatos } from '../../../../lib/alquileres-api';
import { CobroForm } from '../../../../components/alquileres/cobro-form';
import { hoyIso } from '../../../../lib/format';

export const metadata = { title: 'Nuevo cobro · Alquileres' };

/** Hoy en Argentina (UTC−3): la fecha por defecto del cobro, de la que depende el punitorio. */

export default async function NuevoCobroPage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [inquilinos, propietarios, { persona }] = await Promise.all([
    listCandidatos(ctx.accessToken, 'inquilino'),
    listCandidatos(ctx.accessToken, 'propietario'),
    searchParams,
  ]);
  const inicial = persona && [...inquilinos, ...propietarios].some((c) => c.persona.id === persona) ? persona : null;
  return <CobroForm inquilinos={inquilinos} propietarios={propietarios} personaInicial={inicial} hoy={hoyIso()} />;
}
