import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  CATALOGO_SUGERIDO,
  LIMITE_LISTA_CON_SONDA,
  NOMBRE_COBERTURA,
  type AdelantadoBoletasDto,
  type BoletaDto,
  type MonedaAlquiler,
  type ClaseServicio,
  type CoberturaPoliza,
  type CuentaServicio,
  type CuentaServicioDto,
  type LoteBoletas,
  type LoteBoletasResultado,
  type MedioCobro,
  type PlanillaBoletasDto,
  type Poliza,
  type PolizaDto,
  type QuienPaga,
  type ServicioDto,
  type ServicioInput,
} from '@vacker/types';
import { redondear2, repartir, sumarDiasIso, sumarMesesIso } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { repartoDe } from './conceptos.service';
import { nombresDeUsuarios, plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA, saldoDeConcepto } from './imputacion-activa';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];
type Parte = 'inquilino' | 'propietario';
type PartesContrato = { personaId: string; papel: string; porcentaje: Prisma.Decimal | null }[];

/** Los contratos que pueden recibir cargos: los que tuvieron vida. */
const CON_CUENTA = { notIn: ['borrador', 'anulado'] };
const CONTRATOS_DE_PROPIEDAD = {
  where: { estado: CON_CUENTA },
  select: {
    id: true,
    codigo: true,
    estado: true,
    inicio: true,
    fin: true,
    rescindidoEl: true,
    moneda: true,
    partes: { select: { personaId: true, papel: true, porcentaje: true } },
  },
  orderBy: { inicio: 'desc' },
} satisfies Prisma.AlqPropiedad$contratosArgs;
const INCLUIR_CUENTA = {
  servicio: { select: { id: true, nombre: true, clase: true } },
  propiedad: {
    select: { id: true, direccion: true, unidad: true, contratos: CONTRATOS_DE_PROPIEDAD },
  },
} satisfies Prisma.AlqCuentaServicioInclude;
type FilaCuenta = Prisma.AlqCuentaServicioGetPayload<{ include: typeof INCLUIR_CUENTA }>;
type ContratoDePropiedad = FilaCuenta['propiedad']['contratos'][number];

const INCLUIR_BOLETA = {
  cuenta: {
    select: {
      numeroCuenta: true,
      servicio: { select: { nombre: true, clase: true } },
      propiedad: { select: { direccion: true, unidad: true } },
    },
  },
  poliza: {
    select: {
      aseguradora: true,
      numero: true,
      contrato: { select: { propiedad: { select: { direccion: true, unidad: true } } } },
    },
  },
} satisfies Prisma.AlqBoletaInclude;
type FilaBoleta = Prisma.AlqBoletaGetPayload<{ include: typeof INCLUIR_BOLETA }>;

const direccion = (p: { direccion: string; unidad: string | null }) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');
const clavePeriodo = (cuentaId: string, periodo: string, cuota: string | null) =>
  `cuenta|${cuentaId}|${periodo}|${cuota ?? ''}`;

/**
 * El contrato al que se le carga una boleta: el de la propiedad que estaba en
 * curso en ese mes (el más nuevo, si se pisan). Sin contrato, la boleta queda
 * para control y no se le carga a nadie.
 */
export function contratoDelMes<T extends { inicio: Date; fin: Date; rescindidoEl: Date | null }>(
  contratos: T[],
  periodo: string,
): T | null {
  const desde = `${periodo}-01`;
  const hasta = sumarDiasIso(sumarMesesIso(desde, 1), -1);
  const candidatos = contratos.filter(
    (c) => fromDate(c.inicio)! <= hasta && fromDate(c.rescindidoEl ?? c.fin)! >= desde,
  );
  return candidatos.sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0] ?? null;
}

/**
 * Los conceptos de una boleta. Quien la debe y quien la paga (Gexion: «la
 * contraparte»):
 * - Si la paga quien la debe, no hay nada que cargar: solo se controla.
 * - Si la paga la inmobiliaria, se le cobra a quien la debe, adelantado (al
 *   propietario se le descuenta al liquidar).
 * - Si la paga la otra parte, se le carga a quien la debe y se le reconoce a
 *   quien la pagó, enlazados (`origenId`), como un gasto suelto.
 */
export function conceptosDeBoleta(
  b: {
    id: string;
    tenantId: string;
    contratoId: string;
    periodo: string;
    vencimiento: string;
    importe: number;
    moneda: string;
    aCargoDe: Parte;
    paga: QuienPaga;
  },
  partes: PartesContrato,
  tipo: string,
  descripcion: string,
  creadoPorId: string,
): Prisma.AlqConceptoCreateManyInput[] {
  if (b.paga === b.aCargoDe) return [];
  const base = {
    tenantId: b.tenantId,
    contratoId: b.contratoId,
    tipo,
    moneda: b.moneda,
    periodo: b.periodo,
    vencimiento: toDate(b.vencimiento)!,
    descripcion,
    creadoPorId,
  };
  const cargos = repartoDe(partes, b.aCargoDe, b.importe);
  if (cargos.length === 0) return [];
  const filas: Prisma.AlqConceptoCreateManyInput[] = cargos.map(({ personaId, importe }) => ({
    ...base,
    id: randomUUID(),
    personaId,
    sentido: 'a_cobrar',
    importe,
    adelantadoPorInmobiliaria: b.paga === 'inmobiliaria',
    claveGeneracion: `bol|${b.id}|c|${personaId}`,
  }));
  if (b.paga !== 'inmobiliaria') {
    for (const { personaId, importe } of repartoDe(partes, b.paga, b.importe)) {
      filas.push({
        ...base,
        id: randomUUID(),
        personaId,
        sentido: 'a_pagar',
        importe,
        origenId: filas[0]!.id,
        claveGeneracion: `bol|${b.id}|r|${personaId}`,
      });
    }
  }
  return filas;
}

/** Lo cargado a las partes por estas boletas que ya se cobró, pagó o liquidó. */
const APLICADO = {
  anuladoEn: null,
  OR: [{ liquidacionId: { not: null } }, { imputaciones: { some: IMPUTACION_ACTIVA } }],
} satisfies Prisma.AlqConceptoWhereInput;
// Por `clave_origen` (columna generada con índice): el prefijo de la clave no usa índice.
const deBoletas = (ids: string[]) =>
  ({ claveOrigen: { in: ids } }) satisfies Prisma.AlqConceptoWhereInput;

/**
 * Impuestos, servicios y pólizas (entrega 19). El catálogo de la inmobiliaria
 * (API, TGI, EPE…), cuáles tiene cada propiedad con su número de cuenta, las
 * boletas de cada mes —cargadas de a muchas, copiando el mes anterior— y las
 * pólizas, cuyas cuotas son boletas. Lo que paga la inmobiliaria se controla
 * en el mismo lugar.
 *
 * Ninguna operación hace más consultas con más filas: la planilla, la carga
 * en lote y la lista leen todo de una vez y escriben con `createMany`.
 */
@Injectable()
export class ImpuestosService {
  constructor(private readonly db: TenantPrismaService) {}

  // --- Catálogo -------------------------------------------------------------------

  async servicios(): Promise<ServicioDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqServicio.findMany({
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { cuentas: true } } },
      });
      return filas.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        clase: s.clase as ClaseServicio,
        cuentas: s._count.cuentas,
      }));
    });
  }

  /** Los habituales de Rosario, de una vez; los que ya estaban no se repiten. */
  async cargarSugeridos(ctx: TenantContext): Promise<{ creados: number }> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqServicio.createMany({
        data: CATALOGO_SUGERIDO.map((s) => ({ ...s, tenantId: ctx.tenantId })),
        skipDuplicates: true,
      });
      if (count)
        await registrarEventos(tx, ctx, {
          entidad: 'servicio',
          entidadId: ctx.tenantId,
          accion: 'alta',
          resumen: `Cargó ${count} impuestos y servicios habituales`,
        });
      return { creados: count };
    });
  }

  async guardarServicio(
    ctx: TenantContext,
    id: string | null,
    dto: ServicioInput,
  ): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const repetido = await tx.alqServicio.findFirst({
        where: {
          nombre: { equals: dto.nombre, mode: 'insensitive' },
          ...(id ? { id: { not: id } } : {}),
        },
        select: { id: true },
      });
      if (repetido) throw new ConflictException(`Ya existe «${dto.nombre}».`);
      if (id) {
        const { count } = await tx.alqServicio.updateMany({ where: { id }, data: dto });
        if (!count) throw new NotFoundException('No existe.');
      }
      const s = id
        ? { id }
        : await tx.alqServicio.create({
            data: { ...dto, tenantId: ctx.tenantId },
            select: { id: true },
          });
      await registrarEventos(tx, ctx, {
        entidad: 'servicio',
        entidadId: s.id,
        accion: id ? 'edicion' : 'alta',
        resumen: `${id ? 'Editó' : 'Alta de'} «${dto.nombre}»`,
      });
      return s;
    });
  }

  /** Se borra solo si ninguna propiedad lo tiene. */
  async borrarServicio(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const s = await tx.alqServicio.findUnique({
        where: { id },
        select: { nombre: true, _count: { select: { cuentas: true } } },
      });
      if (!s) throw new NotFoundException('No existe.');
      if (s._count.cuentas)
        throw new ConflictException(
          `«${s.nombre}» lo tienen ${s._count.cuentas} propiedades: no se borra.`,
        );
      await tx.alqServicio.delete({ where: { id } });
      await registrarEventos(tx, ctx, {
        entidad: 'servicio',
        entidadId: id,
        accion: 'borrado',
        resumen: `Borró «${s.nombre}» del catálogo`,
      });
      return { id };
    });
  }

  // --- Cuentas de cada propiedad ------------------------------------------------------

  async cuentas(propiedadId?: string): Promise<CuentaServicioDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqCuentaServicio.findMany({
        where: propiedadId ? { propiedadId } : {},
        include: INCLUIR_CUENTA,
        orderBy: [{ propiedad: { direccion: 'asc' } }, { servicio: { nombre: 'asc' } }],
        take: LIMITE_LISTA_CON_SONDA * 4,
      });
      const periodo = hoyArgentina().slice(0, 7);
      return filas.map((f) => cuentaDto(f, periodo));
    });
  }

  async guardarCuenta(
    ctx: TenantContext,
    id: string | null,
    dto: CuentaServicio,
  ): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const [propiedad, servicio] = await Promise.all([
        tx.alqPropiedad.findUnique({
          where: { id: dto.propiedadId },
          select: { direccion: true, unidad: true },
        }),
        tx.alqServicio.findUnique({ where: { id: dto.servicioId }, select: { nombre: true } }),
      ]);
      if (!propiedad) throw new NotFoundException('La propiedad no existe.');
      if (!servicio) throw new NotFoundException('El impuesto o servicio no existe.');
      if (id) {
        const { count } = await tx.alqCuentaServicio.updateMany({ where: { id }, data: dto });
        if (!count) throw new NotFoundException('Ese impuesto no está asignado a la propiedad.');
      }
      const c = id
        ? { id }
        : await tx.alqCuentaServicio.create({
            data: { ...dto, tenantId: ctx.tenantId },
            select: { id: true },
          });
      await registrarEventos(tx, ctx, {
        entidad: 'servicio',
        entidadId: c.id,
        accion: id ? 'edicion' : 'alta',
        resumen: `${servicio.nombre} de ${direccion(propiedad)}${dto.numeroCuenta ? ` (cuenta ${dto.numeroCuenta})` : ''}: lo debe el ${dto.aCargoDe}, paga ${dto.paga === 'inmobiliaria' ? 'la inmobiliaria' : `el ${dto.paga}`}`,
      });
      return c;
    });
  }

  /** Se borra solo si nunca tuvo boletas: lo que tiene historia queda. */
  async borrarCuenta(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqCuentaServicio.findUnique({
        where: { id },
        select: { servicio: { select: { nombre: true } }, _count: { select: { boletas: true } } },
      });
      if (!c) throw new NotFoundException('Ese impuesto no está asignado a la propiedad.');
      if (c._count.boletas)
        throw new ConflictException(
          `Tiene ${c._count.boletas} ${c._count.boletas === 1 ? 'boleta cargada' : 'boletas cargadas'}: no se quita.`,
        );
      await tx.alqCuentaServicio.delete({ where: { id } });
      await registrarEventos(tx, ctx, {
        entidad: 'servicio',
        entidadId: id,
        accion: 'borrado',
        resumen: `Borró la cuenta de ${c.servicio.nombre}`,
      });
      return { id };
    });
  }

  // --- Boletas ------------------------------------------------------------------------

  /**
   * La planilla del mes: cada cuenta con lo ya cargado y lo del mes anterior
   * para copiar. Tres consultas, sean diez cuentas o mil.
   */
  async planilla(periodo: string): Promise<PlanillaBoletasDto> {
    const anterior = sumarMesesIso(`${periodo}-01`, -1).slice(0, 7);
    return this.db.withTenant(async (tx) => {
      const [cuentas, boletas] = await Promise.all([
        tx.alqCuentaServicio.findMany({
          include: INCLUIR_CUENTA,
          orderBy: [{ propiedad: { direccion: 'asc' } }, { servicio: { nombre: 'asc' } }],
        }),
        tx.alqBoleta.findMany({
          where: { cuentaId: { not: null }, periodo: { in: [periodo, anterior] } },
          select: {
            id: true,
            cuentaId: true,
            periodo: true,
            cuota: true,
            importe: true,
            vencimiento: true,
            pagadaEl: true,
            anuladoEn: true,
          },
          orderBy: { vencimiento: 'asc' },
        }),
      ]);
      const delMes = new Map<string, typeof boletas>();
      const delAnterior = new Map<string, (typeof boletas)[number]>();
      for (const b of boletas) {
        if (b.periodo === periodo) delMes.set(b.cuentaId!, [...(delMes.get(b.cuentaId!) ?? []), b]);
        else if (!b.anuladoEn) delAnterior.set(b.cuentaId!, b); // la última del mes anterior
      }
      return {
        periodo,
        filas: cuentas.map((c) => {
          const prev = delAnterior.get(c.id);
          return {
            cuenta: cuentaDto(c, periodo),
            cargadas: (delMes.get(c.id) ?? []).map((b) => ({
              id: b.id,
              cuota: b.cuota,
              importe: decToNum(b.importe),
              vencimiento: fromDate(b.vencimiento)!,
              estado: b.anuladoEn
                ? ('anulada' as const)
                : b.pagadaEl
                  ? ('pagada' as const)
                  : ('pendiente' as const),
            })),
            anterior: prev
              ? {
                  cuota: prev.cuota,
                  importe: decToNum(prev.importe),
                  vencimiento: fromDate(prev.vencimiento)!,
                }
              : null,
          };
        }),
      };
    });
  }

  /**
   * Carga de varias boletas juntas. La misma cuenta, mes y cuota no se carga
   * dos veces. Cada una se le carga al contrato que estaba en curso ese mes.
   */
  async cargarLote(ctx: TenantContext, dto: LoteBoletas): Promise<LoteBoletasResultado> {
    return this.db.withTenant(async (tx) => {
      const ids = [...new Set(dto.boletas.map((b) => b.cuentaId))];
      const cuentas = new Map(
        (
          await tx.alqCuentaServicio.findMany({
            where: { id: { in: ids } },
            include: INCLUIR_CUENTA,
          })
        ).map((c) => [c.id, c]),
      );
      const faltan = ids.filter((id) => !cuentas.has(id));
      if (faltan.length)
        throw new NotFoundException('Alguno de los impuestos ya no está asignado a su propiedad.');
      const claves = dto.boletas.map((b) => clavePeriodo(b.cuentaId, dto.periodo, b.cuota));
      if (new Set(claves).size !== claves.length)
        throw new BadRequestException(
          'Hay dos boletas iguales en la planilla: el mismo impuesto de la misma propiedad, con la misma cuota.',
        );
      const ya = new Set(
        (
          await tx.alqBoleta.findMany({ where: { clave: { in: claves } }, select: { clave: true } })
        ).map((b) => b.clave),
      );

      const boletas: Prisma.AlqBoletaCreateManyInput[] = [];
      const conceptos: Prisma.AlqConceptoCreateManyInput[] = [];
      const porContrato = new Map<string, { n: number; total: number; moneda: string }>();
      let sinContrato = 0;
      dto.boletas.forEach((item, i) => {
        if (ya.has(claves[i]!)) return;
        const cuenta = cuentas.get(item.cuentaId)!;
        const contrato = contratoDelMes(cuenta.propiedad.contratos, dto.periodo);
        const id = randomUUID();
        const moneda = 'ARS';
        boletas.push({
          id,
          tenantId: ctx.tenantId,
          cuentaId: cuenta.id,
          contratoId: contrato?.id ?? null,
          clave: claves[i]!,
          periodo: dto.periodo,
          cuota: item.cuota,
          vencimiento: toDate(item.vencimiento)!,
          importe: item.importe,
          moneda,
          aCargoDe: cuenta.aCargoDe,
          paga: cuenta.paga,
          creadoPorId: ctx.userId,
        });
        if (!contrato) {
          sinContrato++;
          return;
        }
        conceptos.push(
          ...conceptosDeBoleta(
            {
              id,
              tenantId: ctx.tenantId,
              contratoId: contrato.id,
              periodo: dto.periodo,
              vencimiento: item.vencimiento,
              importe: item.importe,
              moneda,
              aCargoDe: cuenta.aCargoDe as Parte,
              paga: cuenta.paga as QuienPaga,
            },
            contrato.partes,
            cuenta.servicio.clase,
            `${cuenta.servicio.nombre}${item.cuota ? ` cuota ${item.cuota}` : ''}${cuenta.numeroCuenta ? ` · cuenta ${cuenta.numeroCuenta}` : ''}`,
            ctx.userId,
          ),
        );
        const p = porContrato.get(contrato.id) ?? { n: 0, total: 0, moneda };
        porContrato.set(contrato.id, { n: p.n + 1, total: p.total + item.importe, moneda });
      });
      if (boletas.length) await tx.alqBoleta.createMany({ data: boletas });
      if (conceptos.length) await tx.alqConcepto.createMany({ data: conceptos });
      await registrarEventos(
        tx,
        ctx,
        [...porContrato].map(([contratoId, p]) => ({
          entidad: 'boleta' as const,
          entidadId: contratoId,
          contratoId,
          accion: 'alta' as const,
          resumen: `Cargó ${p.n} ${p.n === 1 ? 'boleta' : 'boletas'} de impuestos y servicios de ${dto.periodo} por ${plata(Math.round(p.total * 100) / 100, p.moneda)}`,
        })),
      );
      return {
        creadas: boletas.length,
        repetidas: dto.boletas.length - boletas.length,
        sinContrato,
      };
    });
  }

  /** Las boletas de un mes, o las pendientes vencidas o por vencer en 7 días («control»). */
  async boletas(q: {
    periodo?: string;
    ver: 'mes' | 'control';
    contratoId?: string;
  }): Promise<BoletaDto[]> {
    const hoy = hoyArgentina();
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqBoleta.findMany({
        where: {
          ...(q.ver === 'control'
            ? {
                pagadaEl: null,
                anuladoEn: null,
                vencimiento: { lte: toDate(sumarDiasIso(hoy, 7))! },
              }
            : q.periodo
              ? { periodo: q.periodo }
              : {}),
          ...(q.contratoId ? { contratoId: q.contratoId } : {}),
        },
        include: INCLUIR_BOLETA,
        orderBy: [{ vencimiento: 'asc' }, { createdAt: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      return this.dtos(tx, filas);
    });
  }

  /**
   * Registra que se pagó: la inmobiliaria la pagó, o la parte que la paga
   * presentó el comprobante.
   */
  async pagarBoleta(
    ctx: TenantContext,
    id: string,
    fecha: string,
    medio: MedioCobro,
  ): Promise<BoletaDto> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqBoleta.updateMany({
        where: { id, pagadaEl: null, anuladoEn: null },
        data: { pagadaEl: toDate(fecha), medio, pagadaPorId: ctx.userId },
      });
      if (!count) throw new ConflictException('La boleta ya está pagada o anulada.');
      const b = await this.obtenerEn(tx, id);
      await registrarEventos(tx, ctx, {
        entidad: 'boleta',
        entidadId: id,
        contratoId: b.contrato?.id,
        accion: 'estado',
        resumen:
          b.paga === 'inmobiliaria'
            ? `Pagó ${b.nombre} ${b.periodo} por ${plata(b.importe, b.moneda)}`
            : `${b.paga === 'inquilino' ? 'El inquilino' : 'El propietario'} presentó el comprobante de ${b.nombre} ${b.periodo}`,
      });
      return b;
    });
  }

  /** Anular una boleta cargada por error, con lo que se les cargó a las partes. */
  async anularBoleta(ctx: TenantContext, id: string, motivo: string): Promise<BoletaDto> {
    return this.db.withTenant(async (tx) => {
      const b = await tx.alqBoleta.findUnique({
        where: { id },
        select: { anuladoEn: true, contratoId: true, periodo: true },
      });
      if (!b) throw new NotFoundException('La boleta no existe.');
      if (b.anuladoEn) throw new ConflictException('La boleta ya está anulada.');
      if (await tx.alqConcepto.count({ where: { ...deBoletas([id]), ...APLICADO } })) {
        throw new BadRequestException(
          'Lo que se les cargó a las partes ya se cobró o se liquidó: anulá primero ese recibo o esa liquidación.',
        );
      }
      const ahora = new Date();
      await tx.alqConcepto.updateMany({
        where: { ...deBoletas([id]), anuladoEn: null },
        data: {
          anuladoEn: ahora,
          anuladoPorId: ctx.userId,
          motivoAnulacion: `boleta anulada: ${motivo}`,
        },
      });
      await tx.alqBoleta.update({
        where: { id },
        data: { anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: motivo },
      });
      await registrarEventos(tx, ctx, {
        entidad: 'boleta',
        entidadId: id,
        contratoId: b.contratoId,
        accion: 'anulacion',
        resumen: `Boleta de ${b.periodo} anulada: ${motivo}`,
      });
      return this.obtenerEn(tx, id);
    });
  }

  // --- Pólizas ------------------------------------------------------------------------

  async polizas(contratoId?: string): Promise<PolizaDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqPoliza.findMany({
        where: contratoId ? { contratoId } : {},
        include: {
          contrato: {
            select: {
              id: true,
              codigo: true,
              propiedad: { select: { direccion: true, unidad: true } },
            },
          },
          _count: { select: { boletas: { where: { pagadaEl: { not: null }, anuladoEn: null } } } },
        },
        orderBy: [{ hasta: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      });
      const nombres = await nombresDeUsuarios(
        tx,
        filas.map((f) => f.creadoPorId),
      );
      return filas.map((p) => ({
        id: p.id,
        contrato: {
          id: p.contrato.id,
          codigo: p.contrato.codigo,
          propiedad: direccion(p.contrato.propiedad),
        },
        aseguradora: p.aseguradora,
        numero: p.numero,
        cobertura: p.cobertura as CoberturaPoliza,
        desde: fromDate(p.desde)!,
        hasta: fromDate(p.hasta)!,
        sumaAsegurada: p.sumaAsegurada == null ? null : decToNum(p.sumaAsegurada),
        premio: decToNum(p.premio),
        cuotas: p.cuotas,
        cuotasPagadas: p._count.boletas,
        moneda: p.moneda as PolizaDto['moneda'],
        aCargoDe: p.aCargoDe as Parte,
        paga: p.paga as QuienPaga,
        anulada: p.anuladoEn != null,
        registradoPor: p.creadoPorId ? (nombres.get(p.creadoPorId) ?? null) : null,
      }));
    });
  }

  /**
   * Alta de una póliza: sus cuotas son boletas, una por mes desde el primer
   * vencimiento, con el premio repartido sin perder centavos.
   */
  async crearPoliza(ctx: TenantContext, dto: Poliza): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({
        where: { id: dto.contratoId },
        select: {
          codigo: true,
          estado: true,
          partes: { select: { personaId: true, papel: true, porcentaje: true } },
        },
      });
      if (!c) throw new NotFoundException('El contrato no existe.');
      if (c.estado === 'borrador' || c.estado === 'anulado')
        throw new BadRequestException(
          `El contrato está ${c.estado}: no se le pueden cargar pólizas.`,
        );
      const id = randomUUID();
      await tx.alqPoliza.create({
        data: {
          id,
          tenantId: ctx.tenantId,
          contratoId: dto.contratoId,
          aseguradora: dto.aseguradora,
          numero: dto.numero,
          cobertura: dto.cobertura,
          desde: toDate(dto.desde)!,
          hasta: toDate(dto.hasta)!,
          sumaAsegurada: dto.sumaAsegurada,
          premio: dto.premio,
          cuotas: dto.cuotas,
          moneda: dto.moneda,
          aCargoDe: dto.aCargoDe,
          paga: dto.paga,
          creadoPorId: ctx.userId,
        },
      });
      const importes = repartir(
        dto.premio,
        Array.from({ length: dto.cuotas }, () => 100 / dto.cuotas),
      );
      const nombre = `Póliza ${NOMBRE_COBERTURA[dto.cobertura].toLowerCase()} ${dto.aseguradora}${dto.numero ? ` N° ${dto.numero}` : ''}`;
      const boletas: Prisma.AlqBoletaCreateManyInput[] = [];
      const conceptos: Prisma.AlqConceptoCreateManyInput[] = [];
      importes.forEach((importe, i) => {
        const vencimiento = sumarMesesIso(dto.primerVencimiento, i);
        const periodo = vencimiento.slice(0, 7);
        const cuota = dto.cuotas > 1 ? `${i + 1}/${dto.cuotas}` : null;
        const bid = randomUUID();
        boletas.push({
          id: bid,
          tenantId: ctx.tenantId,
          polizaId: id,
          contratoId: dto.contratoId,
          clave: `poliza|${id}|${i + 1}`,
          periodo,
          cuota,
          vencimiento: toDate(vencimiento)!,
          importe,
          moneda: dto.moneda,
          aCargoDe: dto.aCargoDe,
          paga: dto.paga,
          creadoPorId: ctx.userId,
        });
        conceptos.push(
          ...conceptosDeBoleta(
            {
              id: bid,
              tenantId: ctx.tenantId,
              contratoId: dto.contratoId,
              periodo,
              vencimiento,
              importe,
              moneda: dto.moneda,
              aCargoDe: dto.aCargoDe,
              paga: dto.paga,
            },
            c.partes,
            'otro',
            `${nombre}${cuota ? ` cuota ${cuota}` : ''}`,
            ctx.userId,
          ),
        );
      });
      await tx.alqBoleta.createMany({ data: boletas });
      if (conceptos.length) await tx.alqConcepto.createMany({ data: conceptos });
      await registrarEventos(tx, ctx, {
        entidad: 'poliza',
        entidadId: id,
        contratoId: dto.contratoId,
        accion: 'alta',
        resumen: `${nombre}: ${plata(dto.premio, dto.moneda)} en ${dto.cuotas} ${dto.cuotas === 1 ? 'cuota' : 'cuotas'}, vigente hasta ${dto.hasta.split('-').reverse().join('/')}`,
      });
      return { id };
    });
  }

  /**
   * Anular una póliza: se anulan las cuotas que faltan (sin pagar y sin nada
   * cobrado o liquidado) con lo cargado a las partes. Lo ya pagado queda.
   */
  async anularPoliza(
    ctx: TenantContext,
    id: string,
    motivo: string,
  ): Promise<{ id: string; cuotasAnuladas: number }> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPoliza.findUnique({
        where: { id },
        select: {
          anuladoEn: true,
          contratoId: true,
          aseguradora: true,
          boletas: { where: { pagadaEl: null, anuladoEn: null }, select: { id: true } },
        },
      });
      if (!p) throw new NotFoundException('La póliza no existe.');
      if (p.anuladoEn) throw new ConflictException('La póliza ya está anulada.');
      const pendientes = p.boletas.map((b) => b.id);
      const aplicadas = pendientes.length
        ? new Set(
            (
              await tx.alqConcepto.findMany({
                where: { ...deBoletas(pendientes), ...APLICADO },
                select: { claveGeneracion: true },
              })
            ).map((k) => k.claveGeneracion!.split('|')[1]),
          )
        : new Set<string>();
      const anular = pendientes.filter((b) => !aplicadas.has(b));
      const ahora = new Date();
      const marca = { anuladoEn: ahora, anuladoPorId: ctx.userId };
      if (anular.length) {
        await tx.alqConcepto.updateMany({
          where: { ...deBoletas(anular), anuladoEn: null },
          data: { ...marca, motivoAnulacion: `póliza anulada: ${motivo}` },
        });
        await tx.alqBoleta.updateMany({
          where: { id: { in: anular } },
          data: { ...marca, motivoAnulacion: motivo },
        });
      }
      await tx.alqPoliza.update({ where: { id }, data: { ...marca, motivoAnulacion: motivo } });
      await registrarEventos(tx, ctx, {
        entidad: 'poliza',
        entidadId: id,
        contratoId: p.contratoId,
        accion: 'anulacion',
        resumen: `Póliza de ${p.aseguradora} anulada (${anular.length} cuotas sin pagar): ${motivo}`,
      });
      return { id, cuotasAnuladas: anular.length };
    });
  }

  private async obtenerEn(tx: Tx, id: string): Promise<BoletaDto> {
    const b = await tx.alqBoleta.findUnique({ where: { id }, include: INCLUIR_BOLETA });
    if (!b) throw new NotFoundException('La boleta no existe.');
    return (await this.dtos(tx, [b]))[0]!;
  }

  /**
   * Los contratos, los nombres y lo cargado a las partes —si ya se aplicó algo
   * y si se recuperó entero—: tres consultas para toda la lista.
   */
  private async dtos(tx: Tx, filas: FilaBoleta[]): Promise<BoletaDto[]> {
    const contratoIds = [
      ...new Set(filas.map((f) => f.contratoId).filter((x): x is string => !!x)),
    ];
    const [contratos, nombres, cargados] = await Promise.all([
      contratoIds.length
        ? tx.alqContrato.findMany({
            where: { id: { in: contratoIds } },
            select: { id: true, codigo: true },
          })
        : [],
      nombresDeUsuarios(
        tx,
        filas.map((f) => f.creadoPorId),
      ),
      filas.length
        ? tx.alqConcepto.findMany({
            where: { ...deBoletas(filas.map((f) => f.id)), anuladoEn: null },
            select: {
              claveGeneracion: true,
              sentido: true,
              importe: true,
              liquidacionId: true,
              imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
            },
          })
        : [],
    ]);
    const codigo = new Map(contratos.map((c) => [c.id, c.codigo]));
    const deLaBoleta = new Map<string, typeof cargados>();
    for (const k of cargados) {
      const id = k.claveGeneracion?.split('|')[1];
      if (id) deLaBoleta.set(id, [...(deLaBoleta.get(id) ?? []), k]);
    }
    return filas.map((f) => ({
      id: f.id,
      nombre: f.cuenta
        ? f.cuenta.servicio.nombre
        : `Póliza ${f.poliza!.aseguradora}${f.poliza!.numero ? ` N° ${f.poliza!.numero}` : ''}`,
      clase: f.cuenta ? (f.cuenta.servicio.clase as ClaseServicio) : 'poliza',
      cuentaId: f.cuentaId,
      polizaId: f.polizaId,
      numeroCuenta: f.cuenta?.numeroCuenta ?? null,
      propiedad: direccion(f.cuenta ? f.cuenta.propiedad : f.poliza!.contrato.propiedad),
      contrato: f.contratoId ? { id: f.contratoId, codigo: codigo.get(f.contratoId) ?? '—' } : null,
      periodo: f.periodo,
      cuota: f.cuota,
      vencimiento: fromDate(f.vencimiento)!,
      importe: decToNum(f.importe),
      moneda: f.moneda as BoletaDto['moneda'],
      aCargoDe: f.aCargoDe as Parte,
      paga: f.paga as QuienPaga,
      estado: f.anuladoEn ? 'anulada' : f.pagadaEl ? 'pagada' : 'pendiente',
      pagadaEl: fromDate(f.pagadaEl),
      medio: (f.medio as MedioCobro | null) ?? null,
      registradoPor: f.creadoPorId ? (nombres.get(f.creadoPorId) ?? null) : null,
      ...estadoDeLoCargado(deLaBoleta.get(f.id) ?? []),
    }));
  }

  /**
   * Regla 50: lo que la inmobiliaria ya pagó de boletas —cuotas de pólizas
   * incluidas— y todavía no cobró ni descontó a quien las debe: el saldo de
   * sus conceptos a cobrar adelantados, de boletas pagadas y no anuladas, de
   * todos los meses, por moneda. El saldo es el de la cuenta corriente
   * (`saldoDeConcepto`): un cobro parcial descuenta lo cobrado, una
   * liquidación lo salda. Dos consultas, sean diez boletas o mil.
   */
  async adelantado(): Promise<AdelantadoBoletasDto> {
    return this.db.withTenant(async (tx) => {
      const conceptos = await tx.alqConcepto.findMany({
        where: {
          sentido: 'a_cobrar',
          adelantadoPorInmobiliaria: true,
          anuladoEn: null,
          liquidacionId: null,
          claveGeneracion: { startsWith: 'bol|' },
        },
        select: {
          claveGeneracion: true,
          moneda: true,
          importe: true,
          liquidacionId: true,
          imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
        },
      });
      const pendientes = conceptos
        .map((k) => ({
          boletaId: k.claveGeneracion!.split('|')[1]!,
          moneda: k.moneda as MonedaAlquiler,
          saldo: saldoDeConcepto(k),
        }))
        .filter((k) => k.saldo > 0);
      if (!pendientes.length) return { porMoneda: [] };
      // Solo lo que la inmobiliaria ya pagó: lo pendiente todavía no es un adelanto.
      const pagadas = new Set(
        (
          await tx.alqBoleta.findMany({
            where: {
              id: { in: [...new Set(pendientes.map((k) => k.boletaId))] },
              pagadaEl: { not: null },
              anuladoEn: null,
            },
            select: { id: true },
          })
        ).map((b) => b.id),
      );
      const porMoneda = new Map<MonedaAlquiler, { importe: number; boletas: Set<string> }>();
      for (const k of pendientes) {
        if (!pagadas.has(k.boletaId)) continue;
        const m = porMoneda.get(k.moneda) ?? { importe: 0, boletas: new Set<string>() };
        m.importe = redondear2(m.importe + k.saldo);
        m.boletas.add(k.boletaId);
        porMoneda.set(k.moneda, m);
      }
      return {
        porMoneda: [...porMoneda]
          .sort(([a], [b]) => (a === 'ARS' ? -1 : b === 'ARS' ? 1 : a < b ? -1 : 1))
          .map(([moneda, m]) => ({ moneda, importe: m.importe, boletas: m.boletas.size })),
      };
    });
  }
}

type ConceptoCargado = {
  sentido: string;
  importe: Prisma.Decimal;
  liquidacionId: string | null;
  imputaciones: { importe: Prisma.Decimal }[];
};

/**
 * De lo que una boleta les cargó a las partes (sin lo anulado): si ya se
 * aplicó algo —entonces no se anula— y si lo cargado a quien la debe se
 * recuperó entero (regla 47). Sin conceptos a cobrar, no hay nada que
 * recuperar: `null`.
 */
export function estadoDeLoCargado(conceptos: ConceptoCargado[]): {
  aplicada: boolean;
  cargoRecuperado: boolean | null;
} {
  const aCobrar = conceptos.filter((k) => k.sentido === 'a_cobrar');
  return {
    aplicada: conceptos.some((k) => k.liquidacionId != null || k.imputaciones.length > 0),
    cargoRecuperado: aCobrar.length ? aCobrar.every((k) => saldoDeConcepto(k) <= 0) : null,
  };
}

function cuentaDto(f: FilaCuenta, periodo: string): CuentaServicioDto {
  const k: ContratoDePropiedad | null = contratoDelMes(f.propiedad.contratos, periodo);
  return {
    id: f.id,
    propiedad: { id: f.propiedad.id, direccion: direccion(f.propiedad) },
    servicio: {
      id: f.servicio.id,
      nombre: f.servicio.nombre,
      clase: f.servicio.clase as ClaseServicio,
    },
    numeroCuenta: f.numeroCuenta,
    aCargoDe: f.aCargoDe as Parte,
    paga: f.paga as QuienPaga,
    contrato: k ? { id: k.id, codigo: k.codigo } : null,
  };
}
