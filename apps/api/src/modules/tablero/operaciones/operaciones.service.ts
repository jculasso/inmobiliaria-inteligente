import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateOperacion,
  OperacionFiltro,
  PuntaInput,
  UpdateOperacion,
} from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../scope.util';
import { decToNum, derivarPeriodo, fromDate, toDate } from '../tablero.util';

const operacionInclude = {
  puntas: { include: { usuario: { select: { id: true, nombre: true } } } },
} satisfies Prisma.OperacionInclude;

type OperacionConPuntas = Prisma.OperacionGetPayload<{ include: typeof operacionInclude }>;

/** CRUD de operaciones (ventas y alquileres) con puntas normalizadas. */
@Injectable()
export class OperacionesService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Lista operaciones del tenant, acotadas por el scope del rol y los filtros. */
  async list(filtro: OperacionFiltro, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const where: Prisma.OperacionWhereInput = {};
      if (filtro.tipo) where.tipo = filtro.tipo;
      if (filtro.anio != null) where.anio = filtro.anio;
      if (filtro.mes != null) where.mes = filtro.mes;
      // Alcance por rol: solo operaciones con al menos una punta del conjunto.
      if (scope.usuarioIds !== null) {
        where.puntas = { some: { usuarioId: { in: scope.usuarioIds } } };
      }
      const rows = await tx.operacion.findMany({
        where,
        include: operacionInclude,
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { codigo: 'asc' }],
      });
      return rows.map(toDto);
    });
  }

  /** Devuelve una operación por id (RLS + scope). */
  async getOne(id: string, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const row = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!row) throw new NotFoundException('Operación no encontrada.');
      assertEnScope(row, await resolverScope(ctx, tx));
      return toDto(row);
    });
  }

  /** Crea una venta (con 1-2 puntas) o un alquiler (sin puntas). */
  async create(dto: CreateOperacion, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const { anio, mes } = derivarPeriodo(dto.fechaFirma, dto.fechaReserva);
      const base = {
        tenantId: ctx.tenantId,
        codigo: dto.codigo,
        tipo: dto.tipo,
        direccion: dto.direccion,
        moneda: dto.moneda,
        estado: dto.estado,
        fechaReserva: toDate(dto.fechaReserva),
        fechaFirma: toDate(dto.fechaFirma),
        anio,
        mes,
        obs: dto.obs ?? null,
      };

      await this.assertCodigoLibre(tx, dto.codigo);

      let data: Prisma.OperacionUncheckedCreateInput;
      if (dto.tipo === 'venta') {
        await this.assertPuntasEnTenant(tx, dto.puntas);
        data = {
          ...base,
          precio: dto.precio,
          cantPuntas: dto.puntas.length,
          comTotal: sumaComision(dto.puntas),
          puntas: { create: dto.puntas.map((p) => ({ ...p, tenantId: ctx.tenantId })) },
        };
      } else {
        data = {
          ...base,
          valorMensual: dto.valorMensual,
          cantPuntas: 0,
          comTotal: dto.comision,
        };
      }

      const row = await tx.operacion.create({ data, include: operacionInclude });
      return toDto(row);
    });
  }

  /** Edita una operación. Si se envían `puntas`, reemplazan el set completo. */
  async update(id: string, dto: UpdateOperacion, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!actual) throw new NotFoundException('Operación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));

      const fechaFirma = dto.fechaFirma !== undefined ? dto.fechaFirma : fromDate(actual.fechaFirma);
      const fechaReserva =
        dto.fechaReserva !== undefined ? dto.fechaReserva : fromDate(actual.fechaReserva);
      const { anio, mes } = derivarPeriodo(fechaFirma, fechaReserva);

      const data: Prisma.OperacionUncheckedUpdateInput = {
        anio,
        mes,
        fechaFirma: toDate(fechaFirma),
        fechaReserva: toDate(fechaReserva),
      };
      if (dto.codigo !== undefined && dto.codigo !== actual.codigo) {
        await this.assertCodigoLibre(tx, dto.codigo, id);
        data.codigo = dto.codigo;
      }
      if (dto.direccion !== undefined) data.direccion = dto.direccion;
      if (dto.moneda !== undefined) data.moneda = dto.moneda;
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.precio !== undefined) data.precio = dto.precio;
      if (dto.valorMensual !== undefined) data.valorMensual = dto.valorMensual;
      if (dto.obs !== undefined) data.obs = dto.obs;

      if (dto.puntas !== undefined) {
        await this.assertPuntasEnTenant(tx, dto.puntas);
        await tx.operacionPunta.deleteMany({ where: { operacionId: id } });
        data.cantPuntas = dto.puntas.length;
        data.comTotal = sumaComision(dto.puntas);
        data.puntas = { create: dto.puntas.map((p) => ({ ...p, tenantId: actual.tenantId })) };
      } else if (dto.comision !== undefined) {
        // Alquiler (sin puntas): la comisión total se setea directo.
        data.comTotal = dto.comision;
      }

      const row = await tx.operacion.update({ where: { id }, data, include: operacionInclude });
      return toDto(row);
    });
  }

  /** Elimina una operación (las puntas caen por cascade). */
  async remove(id: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!actual) throw new NotFoundException('Operación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));
      await tx.operacion.delete({ where: { id } });
      return { id };
    });
  }

  private async assertCodigoLibre(
    tx: Prisma.TransactionClient,
    codigo: string,
    exceptId?: string,
  ): Promise<void> {
    const existe = await tx.operacion.findFirst({
      where: { codigo, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existe) throw new BadRequestException(`Ya existe una operación con código ${codigo}.`);
  }

  /** Verifica que los usuarios de las puntas pertenezcan al tenant (visible por RLS). */
  private async assertPuntasEnTenant(
    tx: Prisma.TransactionClient,
    puntas: PuntaInput[],
  ): Promise<void> {
    const ids = [...new Set(puntas.map((p) => p.usuarioId))];
    if (ids.length === 0) return;
    const encontrados = await tx.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (encontrados.length !== ids.length) {
      throw new BadRequestException('Alguna punta referencia un usuario inexistente en el tenant.');
    }
  }
}

function sumaComision(puntas: PuntaInput[]): number {
  return puntas.reduce((acc, p) => acc + p.comision, 0);
}

/** Rechaza el acceso si la operación no cae en el alcance del rol. */
function assertEnScope(
  row: OperacionConPuntas,
  scope: { usuarioIds: string[] | null },
): void {
  if (scope.usuarioIds === null) return;
  const set = new Set(scope.usuarioIds);
  const visible = row.puntas.some((p) => set.has(p.usuarioId));
  if (!visible) throw new NotFoundException('Operación no encontrada.');
}

/** Mapea la fila (Decimal/Date) a la forma JSON de la API. */
function toDto(row: OperacionConPuntas) {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    direccion: row.direccion,
    precio: row.precio == null ? null : decToNum(row.precio),
    valorMensual: row.valorMensual == null ? null : decToNum(row.valorMensual),
    moneda: row.moneda,
    cantPuntas: row.cantPuntas,
    comTotal: decToNum(row.comTotal),
    estado: row.estado,
    fechaReserva: fromDate(row.fechaReserva),
    fechaFirma: fromDate(row.fechaFirma),
    anio: row.anio,
    mes: row.mes,
    obs: row.obs,
    puntas: row.puntas.map((p) => ({
      id: p.id,
      lado: p.lado,
      usuarioId: p.usuarioId,
      nombre: p.usuario.nombre,
      comision: decToNum(p.comision),
    })),
  };
}
