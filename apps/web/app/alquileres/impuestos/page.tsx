import { PeriodoSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import {
  getAdelantadoBoletas,
  getPlanillaBoletas,
  listBoletas,
  listPropiedadesAlquiler,
  listServicios,
} from '../../../lib/alquileres-api';
import {
  ImpuestosVista,
  vistaImpuestos,
  type DatosImpuestos,
} from '../../../components/alquileres/impuestos-vista';
import { hoyIso } from '../../../lib/format';

export const metadata = { title: 'Impuestos y servicios · Alquileres' };

/**
 * Tres pestañas, tres trabajos (regla 45): pagar y controlar, cargar el mes,
 * y configurar qué tiene cada propiedad. Cada una pide solo lo suyo.
 */
export default async function ImpuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ver?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const q = await searchParams;
  const pedido = PeriodoSchema.safeParse(q.periodo);
  const periodo = pedido.success ? pedido.data : hoyIso().slice(0, 7);
  const ver = vistaImpuestos(q.ver);
  const t = ctx.accessToken;

  let datos: DatosImpuestos;
  if (ver === 'pagar') {
    const [boletas, control, adelantado] = await Promise.all([
      listBoletas(t, { periodo, ver: 'mes' }),
      listBoletas(t, { ver: 'control' }),
      getAdelantadoBoletas(t),
    ]);
    datos = { ver, boletas, control, adelantado };
  } else if (ver === 'cargar') {
    datos = { ver, planilla: await getPlanillaBoletas(t, periodo) };
  } else {
    const [planilla, servicios, propiedades] = await Promise.all([
      getPlanillaBoletas(t, periodo),
      listServicios(t),
      listPropiedadesAlquiler(t),
    ]);
    // Los impuestos de cada propiedad ya vienen en la planilla: pedirlos aparte era leerlos dos veces.
    datos = { ver, cuentas: planilla.filas.map((f) => f.cuenta), servicios, propiedades };
  }
  return <ImpuestosVista key={`${periodo}|${ver}`} periodo={periodo} datos={datos} />;
}
