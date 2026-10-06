import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getCuentaCorriente, listCobros, listLiquidaciones, listPersonas } from '../../../../lib/alquileres-api';
import { CuentaCorriente } from '../../../../components/alquileres/cuenta-corriente';

export const metadata = { title: 'Cuenta corriente · Alquileres' };

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [cuenta, personas, cobros, liquidaciones] = await Promise.all([
    getCuentaCorriente(ctx.accessToken, id),
    listPersonas(ctx.accessToken),
    listCobros(ctx.accessToken, id),
    listLiquidaciones(ctx.accessToken, id),
  ]);
  return <CuentaCorriente cuenta={cuenta} persona={personas.find((p) => p.id === id) ?? null} cobros={cobros} liquidaciones={liquidaciones} />;
}
