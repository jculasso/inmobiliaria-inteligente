import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  NOMBRE_RUBRO,
  RubroProveedorSchema,
  type Comprobante,
  type ComprobanteDto,
  type GastosReporteDto,
  type MedioCobro,
  type ProveedorAlquiler,
  type ProveedorDto,
  type RubroProveedor,
} from '@vacker/types';
import { repartir } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { nombresDeUsuarios, plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];
const INCLUIR = { proveedor: { select: { id: true, nombre: true, rubro: true } } } satisfies Prisma.AlqComprobanteInclude;
type FilaComprobante = Prisma.AlqComprobanteGetPayload<{ include: typeof INCLUIR }>;

/**
 * Proveedores y sus comprobantes (entrega 18; Javier, 6/10/2026: «les paga la
 * inmobiliaria y se lo retiene al propietario»).
 *
 * Al cargar un comprobante a cargo del propietario se le carga un concepto
 * adelantado por la inmobiliaria, que se le descuenta en su próxima
 * liquidación; a cargo del inquilino, un concepto que se le cobra. Lo de la
 * inmobiliaria es gasto propio. El pago al proveedor se registra con su fecha
 * y su medio; cuando exista Caja y bancos (entrega 16), saldrá de una cuenta.
 */
@Injectable()
export class ProveedoresService {
  constructor(private readonly db: TenantPrismaService) {}

  async listar(): Promise<ProveedorDto[]> {
    return this.db.withTenant(async (tx) => {
      const [filas, pendientes] = await Promise.all([
        tx.alqProveedor.findMany({ orderBy: { nombre: 'asc' }, take: LIMITE_LISTA_CON_SONDA, include: { _count: { select: { comprobantes: true } } } }),
        tx.alqComprobante.groupBy({ by: ['proveedorId'], where: { pagadoEl: null, anuladoEn: null, moneda: 'ARS' }, _sum: { importe: true } }),
      ]);
      const deuda = new Map(pendientes.map((p) => [p.proveedorId, decToNum(p._sum.importe)]));
      return filas.map(({ _count, createdAt: _c, updatedAt: _u, tenantId: _t, ...p }) => ({
        ...p,
        rubro: p.rubro as RubroProveedor,
        pendiente: deuda.get(p.id) ?? 0,
        comprobantes: _count.comprobantes,
      }));
    });
  }

  async crear(ctx: TenantContext, dto: ProveedorAlquiler): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqProveedor.create({ data: { ...dto, tenantId: ctx.tenantId }, select: { id: true } });
      await registrarEventos(tx, ctx, { entidad: 'proveedor', entidadId: p.id, accion: 'alta', resumen: `Alta del proveedor ${dto.nombre} (${NOMBRE_RUBRO[dto.rubro].toLowerCase()})` });
      return p;
    });
  }

  async actualizar(ctx: TenantContext, id: string, dto: ProveedorAlquiler): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqProveedor.updateMany({ where: { id }, data: dto });
      if (!count) throw new NotFoundException('El proveedor no existe.');
      await registrarEventos(tx, ctx, { entidad: 'proveedor', entidadId: id, accion: 'edicion', resumen: `Datos del proveedor ${dto.nombre} editados` });
      return { id };
    });
  }

  /** Se borra solo si nunca tuvo comprobantes: lo que tiene historia queda. */
  async borrar(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqProveedor.findUnique({ where: { id }, select: { nombre: true, _count: { select: { comprobantes: true } } } });
      if (!p) throw new NotFoundException('El proveedor no existe.');
      if (p._count.comprobantes) throw new ConflictException(`${p.nombre} tiene ${p._count.comprobantes} comprobantes: no se borra.`);
      await tx.alqProveedor.delete({ where: { id } });
      await registrarEventos(tx, ctx, { entidad: 'proveedor', entidadId: id, accion: 'borrado', resumen: `Proveedor ${p.nombre} borrado` });
      return { id };
    });
  }

  async comprobantes(q: { estado: 'pendientes' | 'todos'; proveedorId?: string; contratoId?: string }): Promise<ComprobanteDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqComprobante.findMany({
        where: {
          ...(q.estado === 'pendientes' ? { pagadoEl: null, anuladoEn: null } : {}),
          ...(q.proveedorId ? { proveedorId: q.proveedorId } : {}),
          ...(q.contratoId ? { contratoId: q.contratoId } : {}),
        },
        include: INCLUIR,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      return this.dtos(tx, filas);
    });
  }

  /**
   * Cargar un comprobante. A cargo del propietario: concepto adelantado por la
   * inmobiliaria, repartido por porcentajes, que se le descuenta en la
   * liquidación. A cargo del inquilino: concepto que se le cobra.
   */
  async cargarComprobante(ctx: TenantContext, entrada: Comprobante): Promise<ComprobanteDto> {
    // Un gasto de la inmobiliaria no es de ningún contrato: un id que viniera
    // igual se guardaba sin verificar (auditoría del 6/10/2026).
    const dto = entrada.aCargoDe === 'inmobiliaria' ? { ...entrada, contratoId: null } : entrada;
    return this.db.withTenant(async (tx) => {
      const prov = await tx.alqProveedor.findUnique({ where: { id: dto.proveedorId }, select: { nombre: true, rubro: true } });
      if (!prov) throw new NotFoundException('El proveedor no existe.');
      const id = randomUUID();
      let contratoCodigo: string | null = null;
      const conceptos: Prisma.AlqConceptoCreateManyInput[] = [];
      if (dto.aCargoDe !== 'inmobiliaria') {
        const c = await tx.alqContrato.findUnique({ where: { id: dto.contratoId! }, select: { codigo: true, estado: true, partes: { select: { personaId: true, papel: true, porcentaje: true } } } });
        if (!c) throw new NotFoundException('El contrato no existe.');
        if (c.estado === 'borrador' || c.estado === 'anulado') throw new BadRequestException(`El contrato está ${c.estado}: no se le pueden cargar gastos.`);
        contratoCodigo = c.codigo;
        const lado = c.partes.filter((p) => p.papel === dto.aCargoDe).sort((a, b) => (a.personaId < b.personaId ? -1 : 1));
        if (lado.length === 0) throw new BadRequestException(`El contrato no tiene ${dto.aCargoDe}.`);
        const reparto =
          dto.aCargoDe === 'inquilino'
            ? [{ personaId: lado[0]!.personaId, importe: dto.importe }]
            : repartir(dto.importe, lado.map((p) => (p.porcentaje == null ? 100 : decToNum(p.porcentaje)))).map((importe, i) => ({ personaId: lado[i]!.personaId, importe }));
        for (const { personaId, importe } of reparto) {
          conceptos.push({
            tenantId: ctx.tenantId,
            contratoId: dto.contratoId,
            personaId,
            tipo: 'reparacion',
            sentido: 'a_cobrar',
            moneda: dto.moneda,
            periodo: dto.fecha.slice(0, 7),
            vencimiento: toDate(dto.fecha)!,
            importe,
            // Lo paga la inmobiliaria al proveedor y se lo retiene al propietario.
            adelantadoPorInmobiliaria: dto.aCargoDe === 'propietario',
            descripcion: `${NOMBRE_RUBRO[prov.rubro as RubroProveedor]}: ${dto.descripcion} (${prov.nombre})`,
            claveGeneracion: `prov|${id}|${personaId}`,
            creadoPorId: ctx.userId,
          });
        }
      }
      await tx.alqComprobante.create({
        data: {
          id,
          tenantId: ctx.tenantId,
          proveedorId: dto.proveedorId,
          contratoId: dto.contratoId,
          fecha: toDate(dto.fecha)!,
          tipoComprobante: dto.tipoComprobante,
          numero: dto.numero,
          descripcion: dto.descripcion,
          importe: dto.importe,
          moneda: dto.moneda,
          aCargoDe: dto.aCargoDe,
          creadoPorId: ctx.userId,
          ...(dto.pagado ? { pagadoEl: toDate(dto.fecha), medio: dto.medio, pagadoPorId: ctx.userId } : {}),
        },
      });
      if (conceptos.length) await tx.alqConcepto.createMany({ data: conceptos });
      const quien = { propietario: 'a cargo del propietario', inquilino: 'a cargo del inquilino', inmobiliaria: 'gasto de la inmobiliaria' }[dto.aCargoDe];
      await registrarEventos(tx, ctx, {
        entidad: 'comprobante',
        entidadId: id,
        contratoId: dto.contratoId,
        accion: 'alta',
        resumen: `${prov.nombre}: ${dto.descripcion}, ${plata(dto.importe, dto.moneda)}, ${quien}${contratoCodigo ? ` (${contratoCodigo})` : ''}${dto.pagado ? ', pagado' : ''}`,
      });
      return this.obtenerEn(tx, id);
    });
  }

  async pagar(ctx: TenantContext, id: string, fecha: string, medio: MedioCobro): Promise<ComprobanteDto> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqComprobante.updateMany({ where: { id, pagadoEl: null, anuladoEn: null }, data: { pagadoEl: toDate(fecha), medio, pagadoPorId: ctx.userId } });
      if (!count) throw new ConflictException('El comprobante ya está pagado o anulado.');
      const c = await this.obtenerEn(tx, id);
      await registrarEventos(tx, ctx, { entidad: 'comprobante', entidadId: id, contratoId: c.contrato?.id, accion: 'estado', resumen: `Pago a ${c.proveedor.nombre}: ${plata(c.importe, c.moneda)} (${medio})` });
      return c;
    });
  }

  /** Anular un comprobante cargado por error: si lo cargado a la parte ya se cobró o liquidó, primero eso. */
  async anular(ctx: TenantContext, id: string, motivo: string): Promise<ComprobanteDto> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqComprobante.findUnique({ where: { id }, select: { anuladoEn: true, contratoId: true } });
      if (!c) throw new NotFoundException('El comprobante no existe.');
      if (c.anuladoEn) throw new ConflictException('El comprobante ya está anulado.');
      const aplicados = await tx.alqConcepto.count({
        where: { claveGeneracion: { startsWith: `prov|${id}|` }, anuladoEn: null, OR: [{ liquidacionId: { not: null } }, { imputaciones: { some: IMPUTACION_ACTIVA } }] },
      });
      if (aplicados) throw new BadRequestException('Lo que se le cargó a la parte ya se cobró o se liquidó: anulá primero ese recibo o esa liquidación.');
      const ahora = new Date();
      await tx.alqConcepto.updateMany({ where: { claveGeneracion: { startsWith: `prov|${id}|` }, anuladoEn: null }, data: { anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: `comprobante anulado: ${motivo}` } });
      await tx.alqComprobante.update({ where: { id }, data: { anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: motivo } });
      await registrarEventos(tx, ctx, { entidad: 'comprobante', entidadId: id, contratoId: c.contratoId, accion: 'anulacion', resumen: `Comprobante anulado: ${motivo}` });
      return this.obtenerEn(tx, id);
    });
  }

  /** Gastos del año por rubro, por quién los paga y mes a mes: una agregación, sin recorrer filas. */
  async reporte(anio: number): Promise<GastosReporteDto> {
    return this.db.withTenant(async (tx) => {
      const [filas, pendiente] = await Promise.all([
        tx.$queryRaw<{ rubro: string; a_cargo_de: string; mes: number; importe: Prisma.Decimal; cantidad: bigint }[]>`
          SELECT p.rubro, c.a_cargo_de, EXTRACT(MONTH FROM c.fecha)::int AS mes, SUM(c.importe) AS importe, COUNT(*) AS cantidad
            FROM alq_comprobante c
            JOIN alq_proveedor p ON p.id = c.proveedor_id
           WHERE c.anulado_en IS NULL AND c.moneda = 'ARS'
             AND c.fecha >= ${toDate(`${anio}-01-01`)} AND c.fecha < ${toDate(`${anio + 1}-01-01`)}
           GROUP BY p.rubro, c.a_cargo_de, mes`,
        tx.alqComprobante.aggregate({ where: { pagadoEl: null, anuladoEn: null, moneda: 'ARS' }, _sum: { importe: true } }),
      ]);
      const porRubro = new Map<string, { importe: number; cantidad: number }>();
      const porACargo = new Map<string, number>();
      const porMes = Array.from({ length: 12 }, () => 0);
      for (const f of filas) {
        const imp = decToNum(f.importe);
        const r = porRubro.get(f.rubro) ?? { importe: 0, cantidad: 0 };
        porRubro.set(f.rubro, { importe: r.importe + imp, cantidad: r.cantidad + Number(f.cantidad) });
        porACargo.set(f.a_cargo_de, (porACargo.get(f.a_cargo_de) ?? 0) + imp);
        porMes[f.mes - 1]! += imp;
      }
      return {
        anio,
        porRubro: [...porRubro]
          .map(([rubro, v]) => ({ rubro: RubroProveedorSchema.catch('otro').parse(rubro), importe: Math.round(v.importe * 100) / 100, cantidad: v.cantidad }))
          .sort((a, b) => b.importe - a.importe),
        porACargo: [...porACargo].map(([aCargoDe, importe]) => ({ aCargoDe: aCargoDe as GastosReporteDto['porACargo'][number]['aCargoDe'], importe: Math.round(importe * 100) / 100 })),
        porMes: porMes.map((x) => Math.round(x * 100) / 100),
        pendiente: decToNum(pendiente._sum.importe),
      };
    });
  }

  private async obtenerEn(tx: Tx, id: string): Promise<ComprobanteDto> {
    const c = await tx.alqComprobante.findUnique({ where: { id }, include: INCLUIR });
    if (!c) throw new NotFoundException('El comprobante no existe.');
    return (await this.dtos(tx, [c]))[0]!;
  }

  /** Los contratos, los nombres y si ya se aplicó: tres consultas para toda la lista. */
  private async dtos(tx: Tx, filas: FilaComprobante[]): Promise<ComprobanteDto[]> {
    const contratoIds = [...new Set(filas.map((f) => f.contratoId).filter((x): x is string => !!x))];
    const [contratos, nombres, aplicados] = await Promise.all([
      contratoIds.length ? tx.alqContrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, codigo: true, propiedad: { select: { direccion: true, unidad: true } } } }) : [],
      nombresDeUsuarios(tx, filas.map((f) => f.creadoPorId)),
      filas.length
        ? tx.alqConcepto.findMany({
            where: { OR: filas.map((f) => ({ claveGeneracion: { startsWith: `prov|${f.id}|` } })), anuladoEn: null, AND: [{ OR: [{ liquidacionId: { not: null } }, { imputaciones: { some: IMPUTACION_ACTIVA } }] }] },
            select: { claveGeneracion: true },
          })
        : [],
    ]);
    const porId = new Map(contratos.map((c) => [c.id, c]));
    const conAplicado = new Set(aplicados.map((a) => a.claveGeneracion?.split('|')[1]));
    return filas.map((f) => {
      const k = f.contratoId ? porId.get(f.contratoId) : undefined;
      return {
        id: f.id,
        proveedor: { id: f.proveedor.id, nombre: f.proveedor.nombre, rubro: f.proveedor.rubro as RubroProveedor },
        contrato: k ? { id: k.id, codigo: k.codigo, propiedad: [k.propiedad.direccion, k.propiedad.unidad].filter(Boolean).join(' ') } : null,
        fecha: fromDate(f.fecha)!,
        tipoComprobante: f.tipoComprobante as ComprobanteDto['tipoComprobante'],
        numero: f.numero,
        descripcion: f.descripcion,
        importe: decToNum(f.importe),
        moneda: f.moneda as ComprobanteDto['moneda'],
        aCargoDe: f.aCargoDe as ComprobanteDto['aCargoDe'],
        estado: f.anuladoEn ? 'anulado' : f.pagadoEl ? 'pagado' : 'pendiente',
        pagadoEl: fromDate(f.pagadoEl),
        medio: (f.medio as MedioCobro | null) ?? null,
        registradoPor: f.creadoPorId ? (nombres.get(f.creadoPorId) ?? null) : null,
        aplicado: conAplicado.has(f.id),
      };
    });
  }
}
