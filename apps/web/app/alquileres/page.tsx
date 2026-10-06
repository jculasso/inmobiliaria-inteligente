import { FiltroTipoContratoSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../lib/server-principal';
import { getResumenAlquileres, getTableroAlquileres } from '../../lib/alquileres-api';
import { ComoEmpezar } from '../../components/alquileres/como-empezar';
import { TableroAlquileres } from '../../components/alquileres/tablero-alquileres';

export const metadata = { title: 'Alquileres' };

/** Entrada del módulo. El acceso por rol lo resuelve el layout. */
export default async function AlquileresPage({ searchParams }: { searchParams: Promise<{ anio?: string; tipo?: string }> }) {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso». Esto evita además pedirle datos a
  // la API, que respondería 403: Next renderiza layout y página en paralelo.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;

  const resumen = await getResumenAlquileres(ctx.accessToken);

  // Regla 32: una inmobiliaria que recién prende el módulo no ve tarjetas en
  // cero, que se leen como un error. Ve cómo empezar.
  if (resumen.contratos === 0) return <ComoEmpezar resumen={resumen} />;
  const params = await searchParams;
  const anio = Number(params.anio) || undefined;
  const tipo = FiltroTipoContratoSchema.catch('todos').parse(params.tipo);
  return <TableroAlquileres tablero={await getTableroAlquileres(ctx.accessToken, anio, tipo)} />;
}
