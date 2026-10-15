import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ESTADOS_CONTRATO_CON_INVENTARIO_EDITABLE,
  leerItemsInventario,
  type Inventario,
  type InventarioDto,
} from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { registrarEventos } from './historial';

const editable = (estado: string) =>
  (ESTADOS_CONTRATO_CON_INVENTARIO_EDITABLE as readonly string[]).includes(estado);

/**
 * El inventario del contrato (reglas 150 a 153; Florencia, Vacker,
 * 15/10/2026). Vive en dos columnas del contrato —la lista en jsonb y las
 * observaciones— y no en una tabla: no se consulta por ítem, se lee y se
 * guarda entero, y así sale en la misma consulta que arma el Word.
 *
 * Endpoints propios en vez de sumarlo al alta del contrato: se edita también
 * con el contrato vigente (no toca plata), y el alta de un contrato no cambia.
 */
@Injectable()
export class InventarioService {
  constructor(private readonly db: TenantPrismaService) {}

  async obtener(contratoId: string): Promise<InventarioDto> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({
        where: { id: contratoId },
        select: { estado: true, inventario: true, inventarioObs: true },
      });
      if (!c) throw new NotFoundException('Contrato no encontrado.');
      return aDto(c);
    });
  }

  /** Regla 150: la lista que llega reemplaza a la anterior. Regla 151: en borrador y vigente. */
  async guardar(
    ctx: TenantContext,
    contratoId: string,
    inventario: Inventario,
  ): Promise<InventarioDto> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({
        where: { id: contratoId },
        select: { codigo: true, estado: true },
      });
      if (!c) throw new NotFoundException('Contrato no encontrado.');
      if (!editable(c.estado))
        throw new BadRequestException(
          `El contrato está ${c.estado}: el inventario ya no se edita.`,
        );
      const fila = await tx.alqContrato.update({
        where: { id: contratoId },
        data: {
          inventario: inventario.items as unknown as Prisma.InputJsonValue,
          inventarioObs: inventario.observaciones,
        },
        select: { estado: true, inventario: true, inventarioObs: true },
      });
      const n = inventario.items.length;
      await registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: contratoId,
        contratoId,
        accion: 'edicion',
        resumen: `Inventario de ${c.codigo}: ${n} ${n === 1 ? 'ítem' : 'ítems'}${inventario.observaciones ? ', con observaciones' : ''}`,
      });
      return aDto(fila);
    });
  }
}

function aDto(c: {
  estado: string;
  inventario: Prisma.JsonValue;
  inventarioObs: string | null;
}): InventarioDto {
  return {
    // Regla 153: una fila vieja tiene `[]`.
    items: leerItemsInventario(c.inventario),
    observaciones: c.inventarioObs,
    editable: editable(c.estado),
  };
}
