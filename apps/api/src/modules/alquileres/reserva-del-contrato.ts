import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * Regla 160: si se borra el contrato en borrador que salió de una reserva,
 * la reserva vuelve a «aprobada» y se puede convertir de nuevo. Se llama
 * desde el borrado del contrato, en su transacción.
 *
 * En archivo propio y no en `reservas.service.ts`: aquel importa
 * `ContratosService`, y si este lo importara de vuelta, Nest recibiría la
 * clase sin cargar al armar las dependencias.
 */
export async function devolverReservaDelContrato(
  tx: Tx,
  ctx: TenantContext,
  contratoId: string,
  codigo: string,
): Promise<void> {
  const r = await tx.alqReserva.findUnique({
    where: { contratoId },
    select: { id: true, numero: true },
  });
  if (!r) return;
  await tx.alqReserva.update({
    where: { id: r.id },
    data: { estado: 'aprobada', contratoId: null },
  });
  await registrarEventos(tx, ctx, {
    entidad: 'reserva',
    entidadId: r.id,
    accion: 'estado',
    resumen: `Reserva ${r.numero}: se borró el contrato ${codigo}, que estaba en borrador; vuelve a aprobada`,
  });
}
