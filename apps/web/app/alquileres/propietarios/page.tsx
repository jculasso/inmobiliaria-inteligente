import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getInformePropietarios } from '../../../lib/alquileres-api';
import { hoyIso } from '../../../lib/format';
import { leerPeriodoInforme, rangoDelPeriodo } from '../../../lib/periodo-tablero';
import { InformePropietarios } from '../../../components/alquileres/informe-propietarios';

export const metadata = { title: 'Informe de propietarios · Alquileres' };

/**
 * Regla 96: todos los propietarios del período. Abre en el mes anterior, que
 * ya cerró (regla 84); el período viene en la dirección, como en el Dashboard.
 */
export default async function InformePropietariosPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; periodo?: string; mes?: string; q?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const hoy = hoyIso();
  const elegido = leerPeriodoInforme(await searchParams, hoy);
  const datos = await getInformePropietarios(
    ctx.accessToken,
    rangoDelPeriodo(elegido.periodo, elegido.anio),
  );
  return <InformePropietarios datos={datos} hoy={hoy} elegido={elegido} />;
}
