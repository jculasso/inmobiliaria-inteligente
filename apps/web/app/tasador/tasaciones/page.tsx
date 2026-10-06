import type { EstadoTasacion } from '@vacker/types';
import { listTasacionesResumen } from '../../../lib/tasador-api';
import { sesionServidor } from '../../../lib/server-principal';
import { puedeBorrarTasaciones, puedeVerTodo } from '../../../lib/rbac';
import { FiltroAnio } from '../../../components/tablero/filtro-anio';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { FiltroEstado } from '../../../components/tasador/filtro-estado';
import { TasacionesTable } from '../../../components/tasador/tasaciones-table';
import { EncabezadoPagina } from '../../../components/piezas';

export default async function TasacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; estado?: string; agenteId?: string; verTodo?: string }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : undefined;
  const estado = params.estado as EstadoTasacion | undefined;
  const agenteId = params.agenteId;
  const verTodo = params.verTodo === '1';

  // Liviano: la tabla de historial no usa comparables/fotos/análisis (solo
  // fecha, cliente, dirección, tipo, sup. total, agente y estado) — pedir el
  // DTO completo era traer esos JOINs y JSON por cada fila para descartarlos.
  //
  // El perfil va en paralelo: el rol solo decide qué botones se ven (borrar,
  // ver todo), no qué se pide — el alcance lo resuelve la API.
  const [principal, tasaciones] = await Promise.all([
    s.principal,
    listTasacionesResumen(s.accessToken, { anio, estado, agenteId, verTodo }),
  ]);
  if (!principal) return null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Tasaciones">
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
        <FiltroAnio anio={anio} />
        <FiltroEstado estado={estado} />
      </EncabezadoPagina>
      <TasacionesTable
        tasaciones={tasaciones}
        puedeBorrar={puedeBorrarTasaciones(principal.roles)}
      />
    </div>
  );
}
