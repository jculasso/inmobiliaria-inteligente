import { FiltroTipoContratoSchema, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../lib/server-principal';
import { getResumenAlquileres, getTablerosAlquileres } from '../../lib/alquileres-api';
import { ComoEmpezar } from '../../components/alquileres/como-empezar';
import { TableroAlquileres } from '../../components/alquileres/tablero-alquileres';
import { leerPeriodoTablero } from '../../lib/periodo-tablero';

export const metadata = { title: 'Alquileres' };

/** Entrada del módulo. El acceso por rol lo resuelve el layout. */
export default async function AlquileresPage({
  searchParams,
}: {
  searchParams: Promise<{
    anio?: string;
    tipo?: string;
    periodo?: string;
    mes?: string;
    q?: string;
  }>;
}) {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso». Esto evita además pedirle datos a
  // la API, que respondería 403: Next renderiza layout y página en paralelo.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;

  const params = await searchParams;
  const anio = Number(params.anio) || undefined;
  const tipo = FiltroTipoContratoSchema.catch('todos').parse(params.tipo);
  // En paralelo: antes el tablero esperaba al resumen y eran dos esperas seguidas.
  const [resumen, tableros] = await Promise.all([
    getResumenAlquileres(ctx.accessToken),
    getTablerosAlquileres(ctx.accessToken, anio),
  ]);

  // Regla 32: una inmobiliaria que recién prende el módulo no ve tarjetas en
  // cero, que se leen como un error. Ve cómo empezar.
  if (resumen.contratos === 0) return <ComoEmpezar resumen={resumen} />;
  // Reglas 74 y 182: el período de «Cómo vamos» viene en la dirección; sin él, el año.
  const { hoy, anio: anioTablero } = tableros.todos;
  return (
    <TableroAlquileres
      key={anioTablero}
      tableros={tableros}
      tipoInicial={tipo}
      periodoInicial={leerPeriodoTablero(params, hoy, anioTablero)}
    />
  );
}
