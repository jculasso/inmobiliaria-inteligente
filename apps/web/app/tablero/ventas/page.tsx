import { listOperaciones, listVendedores } from '../../../lib/tablero-api';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeBorrarOperaciones } from '../../../lib/rbac';
import { FiltroAnio } from '../../../components/tablero/filtro-anio';
import { OperacionesTable } from '../../../components/tablero/operaciones-table';

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : undefined;

  const [operaciones, vendedores] = await Promise.all([
    listOperaciones(ctx.accessToken, { anio, tipo: 'venta' }),
    // Un `vendedor` puro no puede listar vendedores (403 en la API) — el form
    // de alta/edición queda igual sin selects de punta, solo sin esa opción.
    listVendedores(ctx.accessToken).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Ventas</h2>
        <FiltroAnio anio={anio} />
      </div>
      <OperacionesTable
        tipo="venta"
        operaciones={operaciones}
        vendedores={vendedores}
        puedeBorrar={puedeBorrarOperaciones(ctx.principal.roles)}
      />
    </div>
  );
}
