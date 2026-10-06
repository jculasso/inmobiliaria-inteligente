import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getCuentaCorriente, getFichaPersona, getHistorialPersona, listCobros, listLiquidaciones } from '../../../../lib/alquileres-api';
import { CuentaCorriente } from '../../../../components/alquileres/cuenta-corriente';

export const metadata = { title: 'Persona · Alquileres' };

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [cuenta, ficha, cobros, liquidaciones, historial] = await Promise.all([
    getCuentaCorriente(ctx.accessToken, id),
    getFichaPersona(ctx.accessToken, id),
    listCobros(ctx.accessToken, id),
    listLiquidaciones(ctx.accessToken, id),
    getHistorialPersona(ctx.accessToken, id),
  ]);
  return (
    <CuentaCorriente
      cuenta={cuenta}
      persona={ficha.persona}
      ficha={ficha}
      cobros={cobros}
      liquidaciones={liquidaciones}
      historial={historial}
    />
  );
}
