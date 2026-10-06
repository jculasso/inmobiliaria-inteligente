import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  TenantConfigSchema,
  type CargoIngreso,
  type CompletoContratoDto,
  type DepositoDto,
  type Garantia,
  type GarantiaDto,
  type MonedaAlquiler,
} from '@vacker/types';
import { repartir, sumarMesesIso } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Los meses que dura el contrato: del inicio hasta pasar el fin. */
export function mesesDeContrato(inicio: string, fin: string): number {
  let n = 1;
  while (sumarMesesIso(inicio, n) <= fin && n < 600) n++;
  return n;
}

const CONTRATO = {
  id: true,
  codigo: true,
  estado: true,
  moneda: true,
  inicio: true,
  fin: true,
  fechaFirma: true,
  depositoImporte: true,
  depositoMoneda: true,
  depositoDevolucion: true,
  depositoGestion: true,
  partes: { select: { personaId: true, papel: true, porcentaje: true } },
  tramos: { select: { numero: true, importe: true }, orderBy: { numero: 'asc' as const } },
} satisfies Prisma.AlqContratoSelect;
type FilaContrato = Prisma.AlqContratoGetPayload<{ select: typeof CONTRATO }>;

/** A quién se le carga: el inquilino titular (el de menor id, como la generación del mes), o los propietarios por porcentaje. */
function reparto(c: FilaContrato, papel: 'inquilino' | 'propietario', importe: number): { personaId: string; importe: number }[] {
  const lado = c.partes.filter((p) => p.papel === papel).sort((a, b) => (a.personaId < b.personaId ? -1 : 1));
  if (papel === 'inquilino') return lado.slice(0, 1).map((p) => ({ personaId: p.personaId, importe }));
  const importes = repartir(importe, lado.map((p) => (p.porcentaje == null ? 100 : decToNum(p.porcentaje))));
  return lado.map((p, i) => ({ personaId: p.personaId, importe: importes[i]! }));
}

/**
 * Lo que completa un contrato (entrega 14, puntos 7, 11 y 12 de Javier): los
 * cargos de ingreso al firmar, el depósito en garantía con su entrega al
 * propietario y su devolución, y las garantías con su informe.
 *
 * Todo lo que mueve plata son conceptos: se cobran con Cobros, se descuentan
 * en la liquidación y salen en la cuenta corriente, como el resto.
 */
@Injectable()
export class ContratoCompletoService {
  constructor(private readonly db: TenantPrismaService) {}

  async obtener(ctx: TenantContext, id: string): Promise<CompletoContratoDto> {
    return this.db.withTenant(async (tx) => {
      const c = await this.contrato(tx, id);
      const [tenant, depositos, garantias, cargados] = await Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { config: true } }),
        this.conceptosDeposito(tx, id),
        tx.alqGarantia.findMany({ where: { contratoId: id }, orderBy: { createdAt: 'asc' } }),
        tx.alqConcepto.count({ where: { contratoId: id, claveGeneracion: { startsWith: `ing|${id}|` } } }),
      ]);
      const config = TenantConfigSchema.parse(tenant.config ?? {});
      const meses = mesesDeContrato(fromDate(c.inicio)!, fromDate(c.fin)!);
      const inicial = c.tramos[0]?.importe != null ? decToNum(c.tramos[0].importe) : 0;
      const valorTotal = centavos(inicial * meses);
      return {
        deposito: estadoDeposito(c, depositos),
        garantias: garantias.map(aGarantia),
        cargos: { cargados: cargados > 0, valorTotal, meses, propuesta: cargados > 0 ? [] : propuesta(c, config, valorTotal) },
      };
    });
  }

  /** Los cargos de ingreso, una sola vez por contrato: se cargan al firmar. */
  async cargarCargos(ctx: TenantContext, id: string, cargos: CargoIngreso[]): Promise<CompletoContratoDto> {
    await this.db.withTenant(async (tx) => {
      const c = await this.contrato(tx, id);
      if (c.estado !== 'vigente') throw new BadRequestException('Los cargos de ingreso se cargan con el contrato vigente.');
      const ya = await tx.alqConcepto.count({ where: { contratoId: id, claveGeneracion: { startsWith: `ing|${id}|` } } });
      if (ya) throw new ConflictException('Los cargos de ingreso de este contrato ya se cargaron. Para agregar algo, usá un gasto suelto.');
      const filas: Prisma.AlqConceptoCreateManyInput[] = [];
      cargos.forEach((cargo, i) => {
        const lado = reparto(c, cargo.aCargoDe, cargo.importe);
        if (lado.length === 0) throw new BadRequestException(`El contrato no tiene ${cargo.aCargoDe}.`);
        for (const { personaId, importe } of lado) {
          filas.push({
            id: randomUUID(),
            tenantId: ctx.tenantId,
            contratoId: id,
            personaId,
            tipo: cargo.tipo,
            sentido: 'a_cobrar',
            moneda: cargo.moneda ?? c.moneda,
            periodo: cargo.vencimiento.slice(0, 7),
            vencimiento: toDate(cargo.vencimiento)!,
            importe,
            descripcion: cargo.descripcion,
            claveGeneracion: `ing|${id}|${i}|${personaId}`,
            creadoPorId: ctx.userId,
          });
        }
      });
      await tx.alqConcepto.createMany({ data: filas });
      await registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: id,
        contratoId: id,
        accion: 'alta',
        resumen: `Cargos de ingreso de ${c.codigo}: ${cargos.map((x) => `${x.descripcion} ${plata(x.importe, x.moneda ?? c.moneda)}`).join(' · ')}`,
      });
    });
    return this.obtener(ctx, id);
  }

  /** Punto 12: lo que pagó el inquilino de depósito se le entrega al propietario en su próxima liquidación. */
  async entregarDeposito(ctx: TenantContext, id: string): Promise<CompletoContratoDto> {
    await this.db.withTenant(async (tx) => {
      const c = await this.contrato(tx, id);
      const dep = estadoDeposito(c, await this.conceptosDeposito(tx, id));
      if (dep.estado !== 'cobrado') {
        throw new BadRequestException(dep.estado === 'a_cobrar' ? 'El inquilino todavía no pagó el depósito completo.' : `El depósito está ${dep.estado}.`);
      }
      if (dep.gestion !== 'entrega_propietario') throw new BadRequestException('En este contrato el depósito lo retiene la inmobiliaria.');
      const lado = reparto(c, 'propietario', dep.cobrado);
      await tx.alqConcepto.createMany({
        data: lado.map(({ personaId, importe }) => ({
          tenantId: ctx.tenantId,
          contratoId: id,
          personaId,
          tipo: 'deposito',
          sentido: 'a_pagar',
          moneda: dep.moneda ?? c.moneda,
          vencimiento: new Date(),
          importe,
          descripcion: 'Depósito en garantía: se le entrega al propietario',
          claveGeneracion: `dep|${id}|entrega|${personaId}`,
          creadoPorId: ctx.userId,
        })),
      });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: id, contratoId: id, accion: 'alta', resumen: `Depósito de ${plata(dep.cobrado, dep.moneda ?? c.moneda)} para entregar al propietario en su liquidación` });
    });
    return this.obtener(ctx, id);
  }

  /**
   * Al terminar: se le devuelve al inquilino lo que dejó. Si lo tenía el
   * propietario, se le descuenta en la liquidación; el inquilino lo ve a su
   * favor en la cuenta corriente.
   */
  async devolverDeposito(ctx: TenantContext, id: string, fecha: string): Promise<CompletoContratoDto> {
    await this.db.withTenant(async (tx) => {
      const c = await this.contrato(tx, id);
      const dep = estadoDeposito(c, await this.conceptosDeposito(tx, id));
      if (dep.estado !== 'cobrado' && dep.estado !== 'entregado') throw new BadRequestException(`El depósito está ${dep.estado}: no hay nada para devolver.`);
      const moneda = dep.moneda ?? c.moneda;
      const filas: Prisma.AlqConceptoCreateManyInput[] = reparto(c, 'inquilino', dep.cobrado).map(({ personaId, importe }) => ({
        tenantId: ctx.tenantId,
        contratoId: id,
        personaId,
        tipo: 'deposito',
        sentido: 'a_pagar',
        moneda,
        vencimiento: toDate(fecha)!,
        importe,
        descripcion: 'Devolución del depósito en garantía',
        claveGeneracion: `dep|${id}|devolucion|${personaId}`,
        creadoPorId: ctx.userId,
      }));
      if (dep.estado === 'entregado') {
        for (const { personaId, importe } of reparto(c, 'propietario', dep.cobrado)) {
          filas.push({
            tenantId: ctx.tenantId,
            contratoId: id,
            personaId,
            tipo: 'deposito',
            sentido: 'a_cobrar',
            moneda,
            vencimiento: toDate(fecha)!,
            importe,
            descripcion: 'Devolución del depósito: lo reintegra el propietario',
            claveGeneracion: `dep|${id}|reintegro|${personaId}`,
            creadoPorId: ctx.userId,
          });
        }
      }
      await tx.alqConcepto.createMany({ data: filas });
      await tx.alqContrato.update({ where: { id }, data: { depositoDevolucion: toDate(fecha) } });
      await registrarEventos(tx, ctx, { entidad: 'contrato', entidadId: id, contratoId: id, accion: 'alta', resumen: `Devolución del depósito: ${plata(dep.cobrado, moneda)} al inquilino` });
    });
    return this.obtener(ctx, id);
  }

  /** Punto 11: las garantías del contrato, todas juntas. */
  async guardarGarantias(ctx: TenantContext, id: string, garantias: Garantia[]): Promise<GarantiaDto[]> {
    return this.db.withTenant(async (tx) => {
      const c = await this.contrato(tx, id);
      await tx.alqGarantia.deleteMany({ where: { contratoId: id } });
      if (garantias.length) {
        await tx.alqGarantia.createMany({
          data: garantias.map((g) => ({ ...g, aprobadaEl: toDate(g.aprobadaEl), tenantId: ctx.tenantId, contratoId: id })),
        });
      }
      await registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: id,
        contratoId: id,
        accion: 'edicion',
        resumen: `Garantías de ${c.codigo}: ${garantias.length ? garantias.map((g) => `${g.tipo}${g.garante ? ` (${g.garante})` : ''} ${g.estado}`).join(', ') : 'ninguna'}`,
      });
      return (await tx.alqGarantia.findMany({ where: { contratoId: id }, orderBy: { createdAt: 'asc' } })).map(aGarantia);
    });
  }

  private async contrato(tx: Tx, id: string): Promise<FilaContrato> {
    const c = await tx.alqContrato.findUnique({ where: { id }, select: CONTRATO });
    if (!c) throw new NotFoundException('Contrato no encontrado.');
    return c;
  }

  private conceptosDeposito(tx: Tx, contratoId: string) {
    return tx.alqConcepto.findMany({
      where: { contratoId, tipo: 'deposito', anuladoEn: null },
      select: { sentido: true, importe: true, moneda: true, claveGeneracion: true, imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } } },
    });
  }
}

type ConceptoDeposito = Awaited<ReturnType<ContratoCompletoService['conceptosDeposito']>>[number];

/** Dónde está el depósito, a partir de sus conceptos. */
export function estadoDeposito(c: Pick<FilaContrato, 'depositoImporte' | 'depositoMoneda' | 'depositoDevolucion' | 'depositoGestion'>, ks: ConceptoDeposito[]): DepositoDto {
  const delInquilino = ks.filter((k) => k.sentido === 'a_cobrar' && k.claveGeneracion?.startsWith('ing|'));
  const cobrado = centavos(delInquilino.reduce((s, k) => s + k.imputaciones.reduce((t, i) => t + decToNum(i.importe), 0), 0));
  const debe = centavos(delInquilino.reduce((s, k) => s + decToNum(k.importe), 0));
  const entregado = ks.some((k) => k.claveGeneracion?.includes('|entrega|'));
  const base = {
    importe: c.depositoImporte == null ? null : decToNum(c.depositoImporte),
    moneda: (delInquilino[0]?.moneda ?? c.depositoMoneda ?? null) as MonedaAlquiler | null,
    gestion: c.depositoGestion as DepositoDto['gestion'],
    cobrado,
    devueltoEl: fromDate(c.depositoDevolucion),
  };
  if (c.depositoDevolucion) return { ...base, estado: 'devuelto' };
  if (entregado) return { ...base, estado: 'entregado' };
  if (delInquilino.length === 0) return { ...base, estado: base.importe ? 'a_cobrar' : 'sin_deposito' };
  return { ...base, estado: cobrado >= debe && debe > 0 ? 'cobrado' : 'a_cobrar' };
}

/**
 * Lo que se propone al firmar (punto 7, con los números de Gexion): la
 * comisión sobre el valor total del contrato, más IVA, en cuotas; el depósito;
 * y el sellado repartido entre las partes. Todo editable antes de cargarlo.
 */
export function propuesta(c: FilaContrato, config: ReturnType<typeof TenantConfigSchema.parse>, valorTotal: number): CargoIngreso[] {
  const primera = fromDate(c.fechaFirma) ?? fromDate(c.inicio)!;
  const cargos: CargoIngreso[] = [];
  if (config.comisionInicialPct > 0 && valorTotal > 0) {
    const base = valorTotal * (config.comisionInicialPct / 100);
    const total = centavos(config.comisionInicialConIva ? base * (1 + config.ivaHonorariosPct / 100) : base);
    const n = config.comisionInicialCuotas;
    repartir(total, Array.from({ length: n }, () => 100 / n)).forEach((importe, i) =>
      cargos.push({
        tipo: 'comision',
        descripcion: n > 1 ? `Comisión inicial ${i + 1} de ${n}` : 'Comisión inicial',
        aCargoDe: 'inquilino',
        importe,
        vencimiento: sumarMesesIso(primera, i),
        moneda: null,
      }),
    );
  }
  if (c.depositoImporte != null && decToNum(c.depositoImporte) > 0) {
    cargos.push({ tipo: 'deposito', descripcion: 'Depósito en garantía', aCargoDe: 'inquilino', importe: decToNum(c.depositoImporte), vencimiento: primera, moneda: (c.depositoMoneda as MonedaAlquiler | null) ?? null });
  }
  if (config.selladoPct > 0 && valorTotal > 0) {
    const total = centavos(valorTotal * (config.selladoPct / 100));
    const inquilino = centavos(total * (config.selladoInquilinoPct / 100));
    if (inquilino > 0) cargos.push({ tipo: 'sellado', descripcion: `Sellado del contrato (${config.selladoInquilinoPct}%)`, aCargoDe: 'inquilino', importe: inquilino, vencimiento: primera, moneda: null });
    if (total - inquilino > 0) cargos.push({ tipo: 'sellado', descripcion: `Sellado del contrato (${100 - config.selladoInquilinoPct}%)`, aCargoDe: 'propietario', importe: centavos(total - inquilino), vencimiento: primera, moneda: null });
  }
  return cargos;
}

function aGarantia(g: { id: string; tipo: string; personaId: string | null; garante: string | null; detalle: string | null; estado: string; aprobadaEl: Date | null; obs: string | null }): GarantiaDto {
  return { ...g, tipo: g.tipo as GarantiaDto['tipo'], estado: g.estado as GarantiaDto['estado'], aprobadaEl: fromDate(g.aprobadaEl) };
}
