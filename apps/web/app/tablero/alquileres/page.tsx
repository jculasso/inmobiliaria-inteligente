import type { OperacionFiltro } from '@vacker/types';
import { listOperaciones, listVendedores } from '../../../lib/tablero-api';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeEscribirOperaciones, puedeVerTodo } from '../../../lib/rbac';
import { FiltroOperaciones } from '../../../components/tablero/filtro-operaciones';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { OperacionesTable } from '../../../components/tablero/operaciones-table';

export default async function AlquileresPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; trimestre?: string; verTodo?: string; orden?: string; dir?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : undefined;
  const mes = params.mes ? Number(params.mes) : undefined;
  const trimestre = params.trimestre ? Number(params.trimestre) : undefined;
  const verTodo = params.verTodo === '1';
  // Sin validar acá a propósito: el schema Zod de la API es el que manda,
  // y rechaza cualquier columna que no sea ordenable.
  const orden = params.orden as OperacionFiltro['orden'];
  const dir = params.dir as OperacionFiltro['dir'];

  const [operaciones, vendedores] = await Promise.all([
    listOperaciones(ctx.accessToken, { anio, mes, trimestre, verTodo, orden, dir, tipo: 'alquiler' }),
    listVendedores(ctx.accessToken).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Alquileres</h2>
        <div className="flex flex-wrap items-center gap-3">
          {puedeVerTodo(ctx.principal.roles) && <ToggleVerTodo />}
          <FiltroOperaciones anio={anio} mes={mes} trimestre={trimestre} />
        </div>
      </div>
      <OperacionesTable
        tipo="alquiler"
        operaciones={operaciones}
        vendedores={vendedores}
        puedeEscribir={puedeEscribirOperaciones(ctx.principal.roles)}
      />
    </div>
  );
}
