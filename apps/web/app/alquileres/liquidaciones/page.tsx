import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listLiquidaciones, listPendientesLiquidar } from '../../../lib/alquileres-api';
import { LiquidacionesBandeja } from '../../../components/alquileres/liquidaciones-bandeja';

export const metadata = { title: 'Liquidaciones · Alquileres' };

export default async function LiquidacionesPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [pendientes, liquidaciones] = await Promise.all([listPendientesLiquidar(ctx.accessToken), listLiquidaciones(ctx.accessToken)]);
  return <LiquidacionesBandeja pendientes={pendientes} liquidaciones={liquidaciones} />;
}
