import { PeriodoSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listConceptos, listContratos } from '../../../lib/alquileres-api';
import { ConceptosMes } from '../../../components/alquileres/conceptos-mes';
import { hoyIso } from '../../../lib/format';

export const metadata = { title: 'Conceptos · Alquileres' };

/** El mes de hoy en Argentina (UTC−3). */

export default async function ConceptosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso»; esto evita pedir datos que la API negaría.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const pedido = PeriodoSchema.safeParse((await searchParams).periodo);
  const periodo = pedido.success ? pedido.data : hoyIso().slice(0, 7);
  const [conceptos, contratos] = await Promise.all([
    listConceptos(ctx.accessToken, periodo),
    listContratos(ctx.accessToken),
  ]);
  return (
    <ConceptosMes key={periodo} periodo={periodo} conceptos={conceptos} contratos={contratos} />
  );
}
