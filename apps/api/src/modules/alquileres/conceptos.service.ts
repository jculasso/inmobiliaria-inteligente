import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  TenantConfigSchema,
  type ConceptoDto,
  type ConceptoSuelto,
  type MonedaAlquiler,
  type ResultadoGeneracionDto,
  type SentidoConcepto,
  type TipoConcepto,
} from '@vacker/types';
import { diasDelMes, generarPeriodo, repartir, type ContratoParaGenerar } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { IMPUTACION_ACTIVA } from './imputacion-activa';

const INCLUIR_CONCEPTO = {
  contrato: { select: { id: true, codigo: true, propiedad: { select: { direccion: true } } } },
  persona: { select: { id: true, nombre: true } },
  _count: { select: { imputaciones: { where: IMPUTACION_ACTIVA } } },
} satisfies Prisma.AlqConceptoInclude;

type FilaConcepto = Prisma.AlqConceptoGetPayload<{ include: typeof INCLUIR_CONCEPTO }>;

/** Primer y último día de un período `AAAA-MM`. */
function limites(periodo: string): { desde: string; hasta: string } {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(diasDelMes(anio, mes)).padStart(2, '0')}` };
}

/**
 * Conceptos del módulo Alquileres: la generación del período (reglas 9 a 13),
 * los gastos sueltos (regla 14) y la anulación (regla 19).
 *
 * Las cuentas son de @vacker/domain (`generarPeriodo`), probadas contra los
 * números de Gexion. Acá solo se lee, se arma y se guarda.
 */
@Injectable()
export class ConceptosService {
  constructor(private readonly db: TenantPrismaService) {}

  /**
   * Genera el mes. Tres consultas, sean cuantos sean los contratos: la
   * configuración de la inmobiliaria, los contratos del mes y un único
   * `createMany`. La idempotencia (regla 10) la da la clave única por
   * inmobiliaria: lo que ya existe se saltea en la base, no en memoria, así que
   * dos personas generando a la vez tampoco duplican.
   */
  async generar(ctx: TenantContext, periodo: string): Promise<ResultadoGeneracionDto> {
    const { desde, hasta } = limites(periodo);
    return this.db.withTenant(async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { config: true } });
      const iva = TenantConfigSchema.parse(tenant.config ?? {}).ivaHonorariosPct;

      const contratos = await tx.alqContrato.findMany({
        where: {
          estado: { in: ['vigente', 'finalizado', 'rescindido'] },
          inicio: { lte: toDate(hasta)! },
          fin: { gte: toDate(desde)! },
        },
        include: {
          propiedad: { select: { direccion: true } },
          partes: { select: { personaId: true, papel: true, porcentaje: true } },
          tramos: { select: { numero: true, desde: true, hasta: true, importe: true }, orderBy: { numero: 'asc' } },
        },
      });

      const conceptos: Prisma.AlqConceptoCreateManyInput[] = [];
      const sinIndexar: ResultadoGeneracionDto['sinIndexar'] = [];
      for (const c of contratos) {
        const r = generarPeriodo(aParaGenerar(c), periodo, iva);
        for (const x of r.conceptos) {
          conceptos.push({
            tenantId: ctx.tenantId,
            contratoId: c.id,
            personaId: x.personaId,
            tipo: x.tipo,
            sentido: x.sentido,
            moneda: x.moneda,
            periodo: x.periodo,
            vencimiento: toDate(x.vencimiento)!,
            importe: x.importe,
            descripcion: x.descripcion,
            claveGeneracion: x.clave,
          });
        }
        for (const p of r.sinIndexar) {
          sinIndexar.push({ contratoId: c.id, codigo: c.codigo, direccion: c.propiedad.direccion, tramo: p.tramo, desde: p.desde, hasta: p.hasta });
        }
      }

      const { count } = conceptos.length ? await tx.alqConcepto.createMany({ data: conceptos, skipDuplicates: true }) : { count: 0 };
      return { periodo, contratos: contratos.length, creados: count, existentes: conceptos.length - count, sinIndexar };
    });
  }

  /** Los conceptos de un mes: los del período, más los sueltos sin período que vencen en él. */
  async listar(periodo: string): Promise<ConceptoDto[]> {
    const { desde, hasta } = limites(periodo);
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqConcepto.findMany({
        where: { OR: [{ periodo }, { periodo: null, vencimiento: { gte: toDate(desde)!, lte: toDate(hasta)! } }] },
        include: INCLUIR_CONCEPTO,
        orderBy: [{ contrato: { codigo: 'asc' } }, { vencimiento: 'asc' }, { createdAt: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      return filas.map(aDto);
    });
  }

  /**
   * Regla 14: un gasto suelto. Si lo debe el propietario y son varios, se
   * reparte por sus porcentajes, sin perder centavos. Si lo pagó la otra parte,
   * se le reconoce con un concepto a pagar enlazado al cargo (`origenId`).
   */
  async crearSuelto(ctx: TenantContext, dto: ConceptoSuelto): Promise<ConceptoDto[]> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({
        where: { id: dto.contratoId },
        select: { id: true, moneda: true, estado: true, partes: { select: { personaId: true, papel: true, porcentaje: true } } },
      });
      if (!c) throw new NotFoundException('El contrato no existe.');
      if (c.estado === 'borrador') throw new BadRequestException('Un contrato en borrador todavía no tiene cuenta: activalo primero.');

      const lado = (papel: 'inquilino' | 'propietario') => repartoDe(c.partes, papel, dto.importe);
      const cargos = lado(dto.aCargoDe);
      if (cargos.length === 0) throw new BadRequestException(`El contrato no tiene ${dto.aCargoDe}.`);

      const base = {
        tenantId: ctx.tenantId,
        contratoId: c.id,
        tipo: dto.tipo,
        moneda: c.moneda,
        periodo: dto.periodo,
        vencimiento: toDate(dto.vencimiento)!,
        descripcion: dto.descripcion,
      };
      const filas: Prisma.AlqConceptoCreateManyInput[] = cargos.map(({ personaId, importe }) => ({
        ...base,
        id: randomUUID(),
        personaId,
        sentido: 'a_cobrar',
        importe,
        adelantadoPorInmobiliaria: dto.pagadoPor === 'inmobiliaria',
      }));
      if (dto.pagadoPor === 'inquilino' || dto.pagadoPor === 'propietario') {
        const reconocimientos = lado(dto.pagadoPor);
        if (reconocimientos.length === 0) throw new BadRequestException(`El contrato no tiene ${dto.pagadoPor}.`);
        for (const { personaId, importe } of reconocimientos) {
          filas.push({ ...base, id: randomUUID(), personaId, sentido: 'a_pagar', importe, origenId: filas[0]!.id });
        }
      }
      await tx.alqConcepto.createMany({ data: filas });
      const creados = await tx.alqConcepto.findMany({ where: { id: { in: filas.map((f) => f.id!) } }, include: INCLUIR_CONCEPTO });
      return creados.map(aDto);
    });
  }

  /**
   * Regla 19: anular, nunca borrar. Solo lo que no tiene cobros ni pagos
   * aplicados ni está liquidado. Anular un cargo anula también lo que se le
   * reconoció a quien lo pagó (los enlazados por `origenId`).
   *
   * Un concepto generado y anulado conserva su clave: generar el mes de nuevo
   * no lo vuelve a crear.
   */
  async anular(ctx: TenantContext, id: string, motivo: string): Promise<{ anulados: number }> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqConcepto.findUnique({ where: { id }, select: { anuladoEn: true, liquidacionId: true, _count: { select: { imputaciones: { where: IMPUTACION_ACTIVA } } } } });
      if (!c) throw new NotFoundException('El concepto no existe.');
      if (c.anuladoEn) throw new ConflictException('El concepto ya está anulado.');
      if (c._count.imputaciones > 0 || c.liquidacionId) {
        throw new BadRequestException('El concepto tiene cobros o pagos aplicados: primero hay que anular esos movimientos.');
      }
      const { count } = await tx.alqConcepto.updateMany({
        where: { OR: [{ id }, { origenId: id }], anuladoEn: null, liquidacionId: null, imputaciones: { none: IMPUTACION_ACTIVA } },
        data: { anuladoEn: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: motivo },
      });
      if (count === 0) throw new ConflictException('El concepto cambió mientras tanto. Recargá la página.');
      return { anulados: count };
    });
  }
}

type FilaContrato = Prisma.AlqContratoGetPayload<{
  include: {
    partes: { select: { personaId: true; papel: true; porcentaje: true } };
    tramos: { select: { numero: true; desde: true; hasta: true; importe: true } };
  };
}>;

/**
 * Con más de un inquilino, los cargos van a uno solo, siempre el mismo: el de
 * menor id. Tiene que ser estable porque la clave de generación lleva la
 * persona; si cambiara entre corridas, el mismo mes se generaría dos veces.
 */
function aParaGenerar(c: FilaContrato): ContratoParaGenerar {
  const de = (papel: string) => c.partes.filter((p) => p.papel === papel).sort((a, b) => (a.personaId < b.personaId ? -1 : 1));
  return {
    id: c.id,
    moneda: c.moneda,
    inicio: fromDate(c.inicio)!,
    fin: fromDate(c.fin)!,
    rescindidoEl: c.estado === 'rescindido' ? fromDate(c.rescindidoEl) : null,
    diaVencimiento: c.diaVencimiento,
    diaPagoPropietario: c.diaPagoPropietario,
    honorariosPct: decToNum(c.honorariosPct),
    gastosAdmPct: decToNum(c.gastosAdmPct),
    ivaPct: decToNum(c.ivaPct),
    tramos: c.tramos.map((t) => ({ numero: t.numero, desde: fromDate(t.desde)!, hasta: fromDate(t.hasta)!, importe: t.importe == null ? null : decToNum(t.importe) })),
    propietarios: de('propietario').map((p) => ({ personaId: p.personaId, porcentaje: p.porcentaje == null ? 100 : decToNum(p.porcentaje) })),
    inquilinos: de('inquilino').map((p) => ({ personaId: p.personaId })),
  };
}

/** A quién se le carga un importe del lado de un papel: el inquilino titular, o los propietarios por porcentaje. */
function repartoDe(
  partes: { personaId: string; papel: string; porcentaje: Prisma.Decimal | null }[],
  papel: 'inquilino' | 'propietario',
  importe: number,
): { personaId: string; importe: number }[] {
  const lado = partes.filter((p) => p.papel === papel).sort((a, b) => (a.personaId < b.personaId ? -1 : 1));
  if (papel === 'inquilino') return lado.slice(0, 1).map((p) => ({ personaId: p.personaId, importe }));
  const importes = repartir(importe, lado.map((p) => (p.porcentaje == null ? 100 : decToNum(p.porcentaje))));
  return lado.map((p, i) => ({ personaId: p.personaId, importe: importes[i]! }));
}

function aDto(f: FilaConcepto): ConceptoDto {
  return {
    id: f.id,
    contrato: f.contrato ? { id: f.contrato.id, codigo: f.contrato.codigo, direccion: f.contrato.propiedad.direccion } : null,
    persona: { id: f.persona.id, nombre: f.persona.nombre },
    tipo: f.tipo as TipoConcepto,
    sentido: f.sentido as SentidoConcepto,
    moneda: f.moneda as MonedaAlquiler,
    periodo: f.periodo,
    vencimiento: fromDate(f.vencimiento)!,
    importe: decToNum(f.importe),
    adelantadoPorInmobiliaria: f.adelantadoPorInmobiliaria,
    descripcion: f.descripcion,
    generado: f.claveGeneracion != null,
    aplicado: f._count.imputaciones > 0 || f.liquidacionId != null,
    anulado: f.anuladoEn ? { en: f.anuladoEn.toISOString(), motivo: f.motivoAnulacion ?? '' } : null,
  };
}
