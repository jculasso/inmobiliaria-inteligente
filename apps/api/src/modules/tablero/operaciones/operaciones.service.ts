import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  EstadoAlquilerSchema,
  EstadoVentaSchema,
  type CreateOperacion,
  type OperacionFiltro,
  type PuntaInput,
  type UpdateOperacion,
  LIMITE_LISTA_CON_SONDA,
  DIR_ORDEN_DEFAULT,
  ORDEN_OPERACION_DEFAULT,
} from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { scopeDePermiso, scopes, type Scope } from '../scope.util';
import { decToNum, derivarPeriodo, fromDate, toDate } from '../tablero.util';

/** Techo defensivo de filas por listado (las más recientes). Ver comentario en `list()`. */

/**
 * Traduce el orden pedido a un `orderBy` de Prisma.
 *
 * Por defecto, la operación más nueva arriba: número de operación descendente.
 *
 * Se ordena por `codigoNum` y NO por `codigo`, porque el código es texto y
 * ordenar texto no da orden numérico ("OP-999" quedaría antes que "OP-1001").
 * `codigoNum` es una columna generada por Postgres con la parte numérica.
 *
 * Las filas sin dato en la columna elegida —un código sin dígitos, una
 * operación todavía sin fecha de firma— van SIEMPRE al final, en los dos
 * sentidos: son las que menos información tienen y arriba solo estorban.
 *
 * El desempate por `codigo` mantiene el orden estable. Sin él, dos operaciones
 * firmadas el mismo día pueden intercambiarse entre recargas de la pantalla y
 * parece que la lista se mueve sola.
 */
function ordenDe(filtro: OperacionFiltro): Prisma.OperacionOrderByWithRelationInput[] {
  const dir = filtro.dir ?? DIR_ORDEN_DEFAULT;
  if ((filtro.orden ?? ORDEN_OPERACION_DEFAULT) === 'fechaFirma') {
    return [{ fechaFirma: { sort: dir, nulls: 'last' } }, { codigo: dir }];
  }
  return [{ codigoNum: { sort: dir, nulls: 'last' } }, { codigo: dir }];
}

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
      const { vista, permiso } = await scopes(ctx, tx, filtro.verTodo);
      const where: Prisma.OperacionWhereInput = {};
      if (filtro.tipo) where.tipo = filtro.tipo;
      if (filtro.anio != null) where.anio = filtro.anio;
      if (filtro.mes != null) {
        where.mes = filtro.mes;
      } else if (filtro.trimestre != null) {
        // Trimestre 1..4 → los 3 meses que lo componen (excluyente con mes).
        const base = (filtro.trimestre - 1) * 3;
        where.mes = { in: [base + 1, base + 2, base + 3] };
      }
      if (filtro.estado) where.estado = filtro.estado;

      // Alcance por rol: solo operaciones con al menos una punta del conjunto.
      // Si además viene `usuarioId` (drill-down por vendedor puntual), se
      // acota a esa punta exacta — pero solo si cae dentro del alcance del
      // rol; si no, se oculta (lista vacía), mismo criterio que `assertEnScope`.
      if (filtro.usuarioId) {
        const permitido = vista.usuarioIds === null || vista.usuarioIds.includes(filtro.usuarioId);
        where.puntas = { some: { usuarioId: { in: permitido ? [filtro.usuarioId] : [] } } };
      } else if (vista.usuarioIds !== null) {
        where.puntas = { some: { usuarioId: { in: vista.usuarioIds } } };
      }
      const rows = await tx.operacion.findMany({
        where,
        include: operacionInclude,
        orderBy: ordenDe(filtro),
        // Se pide UNA FILA DE MÁS que el tope a propósito: si vuelven todas,
        // el front sabe que quedó algo afuera y lo avisa en vez de mostrar 500
        // en silencio. Ver `LIMITE_LISTA` en @vacker/types.
        take: LIMITE_LISTA_CON_SONDA,
      });
      return rows.map((r) => toDto(r, permiso));
    });
  }

  /** Devuelve una operación por id (RLS + scope). */
  async getOne(id: string, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const row = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!row) throw new NotFoundException('Operación no encontrada.');
      const permiso = await scopeDePermiso(ctx, tx);
      assertEnScope(row, permiso);
      return toDto(row, permiso);
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
      // Crear y editar son de dirección/admin: no hay nada que ocultarles.
      return toDto(row, SIN_OCULTAR);
    });
  }

  /** Edita una operación. Si se envían `puntas`, reemplazan el set completo. */
  async update(id: string, dto: UpdateOperacion, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!actual) throw new NotFoundException('Operación no encontrada.');
      assertEnScope(actual, await scopeDePermiso(ctx, tx));
      this.assertUpdateCoherente(actual.tipo, dto);

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
      return toDto(row, SIN_OCULTAR);
    });
  }

  /** Elimina una operación (las puntas caen por cascade). */
  async remove(id: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.operacion.findUnique({ where: { id }, include: operacionInclude });
      if (!actual) throw new NotFoundException('Operación no encontrada.');
      assertEnScope(actual, await scopeDePermiso(ctx, tx));
      await tx.operacion.delete({ where: { id } });
      return { id };
    });
  }

  /** Valida que la edición sea coherente con el tipo (venta vs alquiler). */
  private assertUpdateCoherente(tipo: string, dto: UpdateOperacion): void {
    if (tipo === 'alquiler') {
      if (dto.puntas !== undefined) {
        throw new BadRequestException('Los alquileres no llevan puntas.');
      }
      if (dto.estado !== undefined && !EstadoAlquilerSchema.safeParse(dto.estado).success) {
        throw new BadRequestException(`Estado inválido para un alquiler: ${dto.estado}.`);
      }
    } else {
      if (dto.puntas !== undefined && dto.puntas.length === 0) {
        throw new BadRequestException('Una venta debe tener al menos una punta.');
      }
      if (dto.estado !== undefined && !EstadoVentaSchema.safeParse(dto.estado).success) {
        throw new BadRequestException(`Estado inválido para una venta: ${dto.estado}.`);
      }
    }
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
/** Alcance que no oculta nada: para quien crea o edita, que siempre es dirección o admin. */
const SIN_OCULTAR: Scope = { mode: 'tenant', usuarioIds: null };

/**
 * Convierte la fila a DTO ocultando las puntas fuera del alcance del rol.
 *
 * Una venta puede tener una punta de tu equipo y otra de un vendedor ajeno. Esa
 * otra punta no es asunto tuyo: no se muestra el nombre y su comisión no suma.
 * Los KPIs ya lo hacían (`agregar` filtra por alcance); el listado no, así que
 * el tablero y la tabla decían cosas distintas sobre la misma operación.
 *
 * `comTotal` se recalcula SOLO si se ocultó alguna punta. Si no, se usa el valor
 * guardado, que es la fuente de verdad — y en los alquileres, que no tienen
 * puntas, recalcularlo lo dejaría en cero.
 *
 * `cantPuntas` conserva el número real. Que la operación tenga dos puntas no es
 * confidencial —el nombre sí—, y verla como "2 puntas, una tuya" explica sola
 * por qué la comisión es la que es.
 */
function toDto(row: OperacionConPuntas, scope: Scope) {
  const visibles =
    scope.usuarioIds === null
      ? row.puntas
      : row.puntas.filter((p) => scope.usuarioIds!.includes(p.usuarioId));
  const seOculto = visibles.length < row.puntas.length;

  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    direccion: row.direccion,
    precio: row.precio == null ? null : decToNum(row.precio),
    valorMensual: row.valorMensual == null ? null : decToNum(row.valorMensual),
    moneda: row.moneda,
    cantPuntas: row.cantPuntas,
    comTotal: seOculto
      ? visibles.reduce((acc, p) => acc + decToNum(p.comision), 0)
      : decToNum(row.comTotal),
    estado: row.estado,
    fechaReserva: fromDate(row.fechaReserva),
    fechaFirma: fromDate(row.fechaFirma),
    anio: row.anio,
    mes: row.mes,
    obs: row.obs,
    puntas: visibles.map((p) => ({
      id: p.id,
      lado: p.lado,
      usuarioId: p.usuarioId,
      nombre: p.usuario.nombre,
      comision: decToNum(p.comision),
    })),
  };
}
