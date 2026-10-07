import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import {
  getCuentaCorriente,
  getFichaPersona,
  getHistorialPersona,
  listCobros,
  listLiquidaciones,
} from '../../../../lib/alquileres-api';
import { hoyIso } from '../../../../lib/format';
import { leerPeriodoInforme } from '../../../../lib/periodo-tablero';
import { leerSolapa } from '../../../../lib/solapas-persona';
import { CuentaCorriente } from '../../../../components/alquileres/cuenta-corriente';

export const metadata = { title: 'Persona · Alquileres' };

export default async function CuentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    solapa?: string;
    anio?: string;
    periodo?: string;
    mes?: string;
    q?: string;
  }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const sp = await searchParams;
  const [cuenta, ficha, cobros, liquidaciones, historial] = await Promise.all([
    getCuentaCorriente(ctx.accessToken, id),
    getFichaPersona(ctx.accessToken, id),
    listCobros(ctx.accessToken, id),
    listLiquidaciones(ctx.accessToken, id),
    getHistorialPersona(ctx.accessToken, id),
  ]);
  // Reglas 83 y 84: «Informe de propietarios» abre esta ficha en su solapa,
  // con el mismo período (`?solapa=informe&anio=2026&periodo=mes&mes=8`).
  const hoy = hoyIso();
  return (
    <CuentaCorriente
      cuenta={cuenta}
      persona={ficha.persona}
      ficha={ficha}
      cobros={cobros}
      liquidaciones={liquidaciones}
      historial={historial}
      solapaInicial={leerSolapa(sp.solapa)}
      informe={{ hoy, inicial: leerPeriodoInforme(sp, hoy) }}
    />
  );
}
