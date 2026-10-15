import { ConflictException } from '@nestjs/common';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * Regla 160: si se borra el contrato en borrador que salió de una reserva,
 * la reserva vuelve a «aprobada» y se puede convertir de nuevo. Se llama
 * desde el borrado del contrato, en su transacción y ANTES de que este cuente
 * los conceptos del contrato: la seña que pasó a ser el depósito (regla 170)
 * vuelve a ser de la reserva, y el reintegro de lo que sobraba se deshace.
 * Si ese reintegro ya se usó, no se puede: el borrado se frena.
 *
 * En archivo propio y no en `reservas.service.ts`: aquel importa
 * `ContratosService`, y si este lo importara de vuelta, Nest recibiría la
 * clase sin cargar al armar las dependencias.
 */
export async function devolverReservaDelContrato(
  tx: Tx,
  ctx: TenantContext,
  contratoId: string,
): Promise<void> {
  const r = await tx.alqReserva.findUnique({
    where: { contratoId },
    select: {
      id: true,
      numero: true,
      contrato: { select: { codigo: true, estado: true } },
      conceptos: {
        where: { contratoId, anuladoEn: null },
        select: {
          id: true,
          tipo: true,
          imputaciones: { where: { cobro: { anuladoEn: null } }, select: { id: true } },
        },
      },
    },
  });
  // Solo un borrador se borra; lo demás lo frena el borrado del contrato.
  if (!r || r.contrato?.estado !== 'borrador') return;
  const reintegros = r.conceptos.filter((k) => k.tipo === 'deposito');
  if (reintegros.some((k) => k.imputaciones.length))
    throw new ConflictException(
      `El reintegro de la seña de la reserva ${r.numero} ya se usó en un cobro: anulá ese cobro primero.`,
    );
  if (reintegros.length)
    await tx.alqConcepto.deleteMany({ where: { id: { in: reintegros.map((k) => k.id) } } });
  // La seña vuelve a ser de la reserva, sin contrato.
  await tx.alqConcepto.updateMany({
    where: { reservaId: r.id, contratoId, tipo: 'sena' },
    data: { contratoId: null },
  });
  await tx.alqReserva.update({
    where: { id: r.id },
    data: { estado: 'aprobada', contratoId: null },
  });
  await registrarEventos(tx, ctx, {
    entidad: 'reserva',
    entidadId: r.id,
    accion: 'estado',
    resumen: `Reserva ${r.numero}: se borró el contrato ${r.contrato.codigo}, que estaba en borrador; vuelve a aprobada`,
  });
}
