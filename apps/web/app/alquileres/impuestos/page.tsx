import { PeriodoSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getPlanillaBoletas, listBoletas, listContratos, listCuentasServicio, listPolizas, listPropiedadesAlquiler, listServicios } from '../../../lib/alquileres-api';
import { ImpuestosVista } from '../../../components/alquileres/impuestos-vista';

export const metadata = { title: 'Impuestos y servicios · Alquileres' };

const mesActual = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);

export default async function ImpuestosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; ver?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const q = await searchParams;
  const pedido = PeriodoSchema.safeParse(q.periodo);
  const periodo = pedido.success ? pedido.data : mesActual();
  const ver = q.ver === 'control' ? 'control' : 'mes';
  const t = ctx.accessToken;
  const [planilla, boletas, control, servicios, cuentas, propiedades, polizas, contratos] = await Promise.all([
    getPlanillaBoletas(t, periodo),
    listBoletas(t, { periodo, ver: 'mes' }),
    listBoletas(t, { ver: 'control' }),
    listServicios(t),
    listCuentasServicio(t),
    listPropiedadesAlquiler(t),
    listPolizas(t),
    listContratos(t),
  ]);
  return (
    <ImpuestosVista
      key={periodo}
      periodo={periodo}
      ver={ver}
      planilla={planilla}
      boletas={boletas}
      control={control}
      servicios={servicios}
      cuentas={cuentas}
      propiedades={propiedades}
      polizas={polizas}
      contratos={contratos}
    />
  );
}
