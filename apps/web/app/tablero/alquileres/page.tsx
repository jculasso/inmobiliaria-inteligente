import { DIR_ORDEN_DEFAULT, ORDEN_OPERACION_DEFAULT, type OperacionFiltro } from '@vacker/types';
import { listOperaciones, listVendedores } from '../../../lib/tablero-api';
import { sesionServidor } from '../../../lib/server-principal';
import { puedeEscribirOperaciones, puedeVerTodo, puedeVerVendedores } from '../../../lib/rbac';
import { EncabezadoPagina } from '../../../components/piezas';
import { FiltroOperaciones } from '../../../components/tablero/filtro-operaciones';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { OperacionesTable } from '../../../components/tablero/operaciones-table';

export default async function AlquileresPage({
  searchParams,
}: {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    trimestre?: string;
    verTodo?: string;
    orden?: string;
    dir?: string;
  }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : undefined;
  const mes = params.mes ? Number(params.mes) : undefined;
  const trimestre = params.trimestre ? Number(params.trimestre) : undefined;
  const verTodo = params.verTodo === '1';
  // Sin validar acá a propósito: el schema Zod de la API es el que manda,
  // y rechaza cualquier columna que no sea ordenable.
  const orden = params.orden as OperacionFiltro['orden'];
  const dir = params.dir as OperacionFiltro['dir'];

  // Las operaciones se piden EN PARALELO con `/me`: no dependen del rol. Los
  // vendedores sí: solo los usa el formulario de alta/edición, y quien no
  // puede verlos recibía un 403 en cada visita. Se piden apenas llega el rol,
  // mientras las operaciones siguen viajando.
  const vendedoresP = s.principal.then((p) =>
    p && puedeVerVendedores(p.roles) ? listVendedores(s.accessToken).catch(() => []) : [],
  );
  const [principal, operaciones, vendedores] = await Promise.all([
    s.principal,
    listOperaciones(s.accessToken, {
      anio,
      mes,
      trimestre,
      verTodo,
      orden,
      dir,
      tipo: 'alquiler',
    }),
    vendedoresP,
  ]);
  if (!principal) return null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Operaciones de alquiler">
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
        <FiltroOperaciones anio={anio} mes={mes} trimestre={trimestre} />
      </EncabezadoPagina>
      <OperacionesTable
        tipo="alquiler"
        operaciones={operaciones}
        vendedores={vendedores}
        puedeEscribir={puedeEscribirOperaciones(principal.roles)}
        orden={orden ?? ORDEN_OPERACION_DEFAULT}
        dir={dir ?? DIR_ORDEN_DEFAULT}
      />
    </div>
  );
}
