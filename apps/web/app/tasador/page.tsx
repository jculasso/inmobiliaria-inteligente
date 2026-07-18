import type { EstadoTasacion, TasacionDto } from '@vacker/types';
import { listTasaciones } from '../../lib/tasador-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { puedeBorrarTasaciones } from '../../lib/rbac';
import { FiltroAnio } from '../../components/tablero/filtro-anio';
import { FiltroEstado } from '../../components/tasador/filtro-estado';
import { TasacionesTable } from '../../components/tasador/tasaciones-table';

export default async function TasadorPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; estado?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : undefined;
  const estado = params.estado as EstadoTasacion | undefined;

  const tasaciones: TasacionDto[] = await listTasaciones(ctx.accessToken, { anio, estado });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Tasaciones</h2>
        <div className="flex items-center gap-2">
          <FiltroAnio anio={anio} />
          <FiltroEstado estado={estado} />
        </div>
      </div>
      <TasacionesTable tasaciones={tasaciones} puedeBorrar={puedeBorrarTasaciones(ctx.principal.roles)} />
    </div>
  );
}
