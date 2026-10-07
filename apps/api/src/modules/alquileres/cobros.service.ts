import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  type Cobro,
  type CobroDto,
  type CobroResumenDto,
  type CuentaCorrienteDto,
  type DeudaDto,
  type MedioCobro,
  type MonedaAlquiler,
  type PreparacionCobroDto,
  type SentidoConcepto,
  type TipoConcepto,
} from '@vacker/types';
import { parteDeClave, planificarCobro, proponerPunitorio, redondear2 } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { nombresDeUsuarios, plata, registrarEventos } from './historial';
import { IMPUTACION_ACTIVA, saldoDeConcepto } from './imputacion-activa';
import { hoyArgentina } from '../protocolo/protocolo.calc';

/** El día (en la Argentina) de un instante, como `YYYY-MM-DD`. */
const diaDe = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

/** «1 día», «29 días». */
const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

/** `2026-11-01` → `01/11/2026`. */
const fechaCorta = (iso: string): string => iso.split('-').reverse().join('/');

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** Los reintegros que se compensan al cobrar: gastos sueltos a favor de la persona. */
const TIPOS_COMPENSABLES = ['expensa', 'impuesto', 'servicio', 'reparacion', 'otro'];

/**
 * Lo que NO se cobra por caja: los honorarios del propietario se le descuentan
 * en la liquidación (regla 20), no se le cobran aparte.
 */
const TIPOS_QUE_SE_LIQUIDAN = ['honorarios'];

const INCLUIR_COBRO = {
  persona: { select: { id: true, nombre: true } },
  // Sin filtrar: el recibo de un cobro anulado sigue mostrando lo que había cubierto.
  registradas: {
    select: {
      cobroId: true,
      importe: true,
      cobro: { select: { numero: true } },
      concepto: {
        select: {
          id: true,
          descripcion: true,
          tipo: true,
          sentido: true,
          contrato: { select: { id: true, codigo: true } },
        },
      },
    },
  },
  imputaciones: {
    where: IMPUTACION_ACTIVA,
    select: { importe: true, concepto: { select: { sentido: true } } },
  },
} satisfies Prisma.AlqCobroInclude;

type FilaCobro = Prisma.AlqCobroGetPayload<{ include: typeof INCLUIR_COBRO }>;

/** Lo que queda de un concepto: importe menos lo imputado por cobros activos. */
interface ConceptoConSaldo {
  id: string;
  tipo: string;
  sentido: string;
  moneda: string;
  importe: number;
  saldo: number;
  vencimiento: string;
  createdAt: Date;
  periodo: string | null;
  origenId: string | null;
  descripcion: string;
  contrato: { id: string; codigo: string; punitorioDiarioPct: number } | null;
  anulado: boolean;
}

/**
 * Cobros del módulo Alquileres (spec alquileres-fase-1.md, reglas 15 a 19).
 *
 * El saldo de una persona es un libro mayor: conceptos a cobrar suman,
 * conceptos a pagar y cobros restan. Las imputaciones no mueven el saldo:
 * dicen QUÉ quedó pagado. Por eso el estado de cuenta —lo pendiente— suma
 * exactamente lo mismo que la cuenta corriente (regla 24), pase lo que pase con
 * la imputación.
 */
@Injectable()
export class CobrosService {
  constructor(private readonly db: TenantPrismaService) {}

  async preparar(
    personaId: string,
    moneda: MonedaAlquiler,
    fecha: string,
  ): Promise<PreparacionCobroDto> {
    return this.db.withTenant(async (tx) => {
      const persona = await this.persona(tx, personaId);
      const { conceptos, creditos } = await this.estado(tx, personaId, moneda);
      return {
        persona,
        moneda,
        fecha,
        deudas: deudasDe(conceptos).map((c) => aDeuda(c, propuesta(c, conceptos, fecha))),
        compensables: compensablesDe(conceptos).map((c) => ({
          conceptoId: c.id,
          descripcion: c.descripcion,
          saldo: c.saldo,
        })),
        creditos,
      };
    });
  }

  /**
   * Registra un cobro (reglas 15 a 17). Todo se vuelve a calcular acá con lo
   * que hay en la base: lo que llega del navegador es qué conceptos se eligen y
   * cuánto punitorio se cobra, nunca cuánto se imputa a cada uno.
   */
  async registrar(ctx: TenantContext, dto: Cobro): Promise<CobroDto> {
    return this.db.withTenant(async (tx) => {
      await this.persona(tx, dto.personaId);
      const { conceptos, creditos } = await this.estado(tx, dto.personaId, dto.moneda);
      const cobroId = randomUUID();

      let deudas = deudasDe(conceptos);
      if (dto.conceptoIds) {
        const elegidos = new Set(dto.conceptoIds);
        const ajenos = dto.conceptoIds.filter((id) => !deudas.some((d) => d.id === id));
        if (ajenos.length)
          throw new BadRequestException(
            'Uno de los conceptos elegidos no es una deuda pendiente de esta persona.',
          );
        deudas = deudas.filter((d) => elegidos.has(d.id));
      }

      // Regla 16: punitorios. El importe se compara con lo propuesto a la fecha.
      const punitorios: Prisma.AlqConceptoCreateManyInput[] = [];
      const condonaciones: string[] = [];
      for (const p of dto.punitorios) {
        const alquiler = deudas.find((d) => d.id === p.conceptoId && d.tipo === 'alquiler');
        if (!alquiler)
          throw new BadRequestException(
            'Un punitorio tiene que ser de un alquiler que se está cobrando.',
          );
        const prop = propuesta(alquiler, conceptos, dto.fecha);
        if (p.importe > prop.importe + 0.005) {
          throw new BadRequestException(
            `El punitorio de «${alquiler.descripcion}» no puede superar lo calculado: ${prop.importe}.`,
          );
        }
        const condonado = redondear2(prop.importe - p.importe);
        if (condonado > 0) {
          if (!p.motivo || p.motivo.length < 3)
            throw new BadRequestException(
              `Para condonar el punitorio de «${alquiler.descripcion}» hace falta el motivo.`,
            );
          condonaciones.push(
            `Punitorio condonado de ${alquiler.descripcion}: $ ${condonado.toLocaleString('es-AR')} (${p.motivo}).`,
          );
        }
        if (p.importe > 0) {
          punitorios.push({
            id: randomUUID(),
            tenantId: ctx.tenantId,
            contratoId: alquiler.contrato?.id ?? null,
            personaId: dto.personaId,
            tipo: 'punitorio',
            sentido: 'a_cobrar',
            moneda: dto.moneda,
            periodo: alquiler.periodo,
            vencimiento: toDate(dto.fecha)!,
            importe: p.importe,
            origenId: alquiler.id,
            cobroId,
            creadoPorId: ctx.userId,
            descripcion: `Punitorio ${dias(prop.dias)} · ${alquiler.descripcion}`,
          });
        }
      }

      // Cada punitorio se cancela junto a su alquiler, no al final de la fila.
      const filaDeudas = deudas.flatMap((d) => [
        { conceptoId: d.id, saldo: d.saldo },
        ...punitorios
          .filter((p) => p.origenId === d.id)
          .map((p) => ({ conceptoId: p.id!, saldo: Number(p.importe) })),
      ]);
      const plan = planificarCobro({
        importe: dto.importe,
        creditos,
        compensables: compensablesDe(conceptos).map((c) => ({ conceptoId: c.id, saldo: c.saldo })),
        deudas: filaDeudas,
      });

      // Un número de recibo por vez en cada inmobiliaria: sin el candado, dos
      // cobros simultáneos sacarían el mismo número.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId} || ':alq_cobro'))`;
      const ultimo = await tx.alqCobro.aggregate({ _max: { numero: true } });
      const numero = (ultimo._max.numero ?? 0) + 1;
      const obs = [dto.obs, ...condonaciones].filter(Boolean).join('\n') || null;
      await tx.alqCobro.create({
        data: {
          id: cobroId,
          tenantId: ctx.tenantId,
          numero,
          personaId: dto.personaId,
          fecha: toDate(dto.fecha)!,
          moneda: dto.moneda,
          importe: dto.importe,
          medio: dto.medio,
          obs,
          creadoPorId: ctx.userId,
        },
      });
      if (punitorios.length) await tx.alqConcepto.createMany({ data: punitorios });
      if (plan.imputaciones.length) {
        await tx.alqImputacion.createMany({
          data: plan.imputaciones.map((i) => ({
            tenantId: ctx.tenantId,
            cobroId: i.cobroId ?? cobroId,
            conceptoId: i.conceptoId,
            importe: i.importe,
            registradaEnCobroId: cobroId,
          })),
        });
      }
      const contratos = [
        ...new Set(deudas.map((d) => d.contrato?.id).filter((x): x is string => !!x)),
      ];
      await registrarEventos(tx, ctx, {
        entidad: 'cobro',
        entidadId: cobroId,
        personaId: dto.personaId,
        // Un recibo de un solo contrato aparece también en el historial del contrato.
        contratoId: contratos.length === 1 ? contratos[0] : null,
        accion: 'alta',
        resumen: `Recibo ${String(numero).padStart(6, '0')} por ${plata(dto.importe, dto.moneda)}`,
        detalle: { contratos },
      });
      return this.dto(
        tx,
        await tx.alqCobro.findUniqueOrThrow({ where: { id: cobroId }, include: INCLUIR_COBRO }),
      );
    });
  }

  /** El recibo con los nombres de quien lo registró y quien lo anuló. */
  private async dto(tx: Tx, c: FilaCobro): Promise<CobroDto> {
    return aDto(c, await nombresDeUsuarios(tx, [c.creadoPorId, c.anuladoPorId]));
  }

  async obtener(id: string): Promise<CobroDto> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqCobro.findUnique({ where: { id }, include: INCLUIR_COBRO });
      if (!c) throw new NotFoundException('El cobro no existe.');
      return this.dto(tx, c);
    });
  }

  async listar(personaId?: string): Promise<CobroResumenDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqCobro.findMany({
        where: personaId ? { personaId } : {},
        include: { persona: { select: { id: true, nombre: true } } },
        orderBy: { numero: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
      });
      const nombres = await nombresDeUsuarios(
        tx,
        filas.map((c) => c.creadoPorId),
      );
      return filas.map((c) => ({
        id: c.id,
        numero: c.numero,
        persona: c.persona,
        fecha: fromDate(c.fecha)!,
        moneda: c.moneda as MonedaAlquiler,
        importe: decToNum(c.importe),
        medio: c.medio as MedioCobro,
        anulado: c.anuladoEn != null,
        registradoPor: c.creadoPorId ? (nombres.get(c.creadoPorId) ?? null) : null,
      }));
    });
  }

  /**
   * Regla 19: anular, no borrar. Revierte las imputaciones (dejan de contar
   * por el filtro de `IMPUTACION_ACTIVA`) y anula los punitorios que nacieron
   * con el cobro. No se puede si su saldo a favor ya se usó en un cobro
   * posterior: habría que anular ese primero, o el recibo posterior diría que
   * aplicó una plata que ya no existe.
   */
  async anular(ctx: TenantContext, id: string, motivo: string): Promise<CobroDto> {
    return this.db.withTenant(async (tx) => {
      const c = await tx.alqCobro.findUnique({
        where: { id },
        select: {
          anuladoEn: true,
          numero: true,
          imputaciones: {
            where: { registradaEnCobroId: { not: id }, registradaEnCobro: { anuladoEn: null } },
            select: { registradaEnCobro: { select: { numero: true } } },
          },
          conceptos: {
            select: {
              imputaciones: {
                where: { ...IMPUTACION_ACTIVA, cobroId: { not: id } },
                select: { id: true },
              },
            },
          },
          registradas: {
            select: {
              concepto: { select: { claveGeneracion: true, tipo: true, contratoId: true } },
            },
          },
        },
      });
      if (!c) throw new NotFoundException('El cobro no existe.');
      if (c.anuladoEn) throw new ConflictException('El cobro ya está anulado.');
      const posterior = c.imputaciones[0]?.registradaEnCobro.numero;
      if (posterior != null) {
        throw new BadRequestException(
          `El saldo a favor de este cobro se usó en el recibo ${String(posterior).padStart(6, '0')}: anulá ese primero.`,
        );
      }
      if (c.conceptos.some((k) => k.imputaciones.length > 0)) {
        throw new BadRequestException(
          'Un punitorio de este cobro tiene pagos de otro cobro: anulá ese primero.',
        );
      }
      // Si lo que canceló ya se le liquidó al propietario, anular dejaría al
      // dueño cobrado de un alquiler que el inquilino no pagó (regla 22).
      const partes = [
        ...new Set(
          c.registradas
            .filter((i) => i.concepto.tipo === 'alquiler' || i.concepto.tipo === 'iva')
            .map((i) => parteDeClave(i.concepto.claveGeneracion))
            .filter((x): x is string => x !== null),
        ),
      ];
      if (partes.length) {
        const liquidado = await tx.alqConcepto.findFirst({
          where: {
            sentido: 'a_pagar',
            liquidacion: { anuladoEn: null },
            contrato: { pagoGarantizado: false },
            // Por contrato primero: el prefijo de la clave no usa índice, el contrato sí.
            contratoId: {
              in: [
                ...new Set(
                  c.registradas.map((i) => i.concepto.contratoId).filter((x): x is string => !!x),
                ),
              ],
            },
            OR: partes.map((p) => ({ claveGeneracion: { startsWith: `${p}|` } })),
          },
          select: { liquidacion: { select: { numero: true } } },
        });
        if (liquidado?.liquidacion) {
          throw new BadRequestException(
            `Lo que canceló este cobro ya se le liquidó al propietario (liquidación ${String(liquidado.liquidacion.numero).padStart(6, '0')}): anulá esa primero.`,
          );
        }
      }
      const ahora = new Date();
      const { count } = await tx.alqCobro.updateMany({
        where: { id, anuladoEn: null },
        data: { anuladoEn: ahora, anuladoPorId: ctx.userId, motivoAnulacion: motivo },
      });
      if (count === 0)
        throw new ConflictException('El cobro cambió mientras tanto. Recargá la página.');
      await tx.alqConcepto.updateMany({
        where: { cobroId: id, anuladoEn: null },
        data: {
          anuladoEn: ahora,
          anuladoPorId: ctx.userId,
          motivoAnulacion: `Anulación del recibo ${String(c.numero).padStart(6, '0')}`,
        },
      });
      const fila = await tx.alqCobro.findUniqueOrThrow({ where: { id }, include: INCLUIR_COBRO });
      await registrarEventos(tx, ctx, {
        entidad: 'cobro',
        entidadId: id,
        personaId: fila.personaId,
        accion: 'anulacion',
        resumen: `Recibo ${String(c.numero).padStart(6, '0')} anulado: ${motivo}`,
      });
      return this.dto(tx, fila);
    });
  }

  /** Reglas 18 y 24: la cuenta corriente por moneda y lo pendiente, que suma lo mismo. */
  async cuenta(personaId: string): Promise<CuentaCorrienteDto> {
    return this.db.withTenant(async (tx) => {
      const persona = await this.persona(tx, personaId);
      const { conceptos, cobros, creditos } = await this.estado(tx, personaId);
      // Lo que se le pagó al propietario (regla 20): salda lo que se le debía.
      const liquidaciones = (
        await tx.alqLiquidacion.findMany({
          where: { personaId },
          select: {
            id: true,
            numero: true,
            moneda: true,
            fecha: true,
            neto: true,
            anuladoEn: true,
            createdAt: true,
          },
        })
      ).map((l) => ({
        id: l.id,
        numero: l.numero,
        moneda: l.moneda,
        fecha: fromDate(l.fecha)!,
        neto: decToNum(l.neto),
        anulado: l.anuladoEn != null,
        createdAt: l.createdAt,
      }));
      const monedas = [
        ...new Set([
          ...conceptos.map((c) => c.moneda),
          ...cobros.map((c) => c.moneda),
          ...liquidaciones.map((l) => l.moneda),
        ]),
      ].sort() as MonedaAlquiler[];
      return {
        persona,
        monedas: monedas.map((moneda) => {
          const ks = conceptos.filter((c) => c.moneda === moneda);
          const cs = cobros.filter((c) => c.moneda === moneda);
          const ls = liquidaciones.filter((l) => l.moneda === moneda);
          const movimientos = [
            // Un concepto entra en la cuenta cuando se carga, o antes si su
            // vencimiento ya pasó (lo generado tarde). Por vencimiento, una
            // cuota de noviembre aparecía después de cobros de octubre y el
            // saldo intermedio quedaba negativo (pasada de pruebas, 6/10/2026).
            ...ks.map((k) => ({
              id: k.id,
              tipo: 'concepto' as const,
              fecha: k.vencimiento < diaDe(k.createdAt) ? k.vencimiento : diaDe(k.createdAt),
              orden: k.createdAt.getTime(),
              descripcion:
                k.vencimiento > diaDe(k.createdAt)
                  ? `${k.descripcion} · vence el ${fechaCorta(k.vencimiento)}`
                  : k.descripcion,
              contrato: k.contrato ? { id: k.contrato.id, codigo: k.contrato.codigo } : null,
              debe: k.sentido === 'a_cobrar' ? k.importe : 0,
              haber: k.sentido === 'a_pagar' ? k.importe : 0,
              anulado: k.anulado,
              numero: null,
            })),
            ...cs.map((c) => ({
              id: c.id,
              tipo: 'cobro' as const,
              fecha: c.fecha,
              orden: c.createdAt.getTime(),
              descripcion: `Cobro · recibo ${String(c.numero).padStart(6, '0')}`,
              contrato: null,
              debe: 0,
              haber: c.importe,
              anulado: c.anulado,
              numero: c.numero,
            })),
            ...ls.map((l) => ({
              id: l.id,
              tipo: 'liquidacion' as const,
              fecha: l.fecha,
              orden: l.createdAt.getTime(),
              descripcion: `Liquidación ${String(l.numero).padStart(6, '0')}`,
              contrato: null,
              debe: l.neto,
              haber: 0,
              anulado: l.anulado,
              numero: l.numero,
            })),
          ].sort((a, b) => (a.fecha === b.fecha ? a.orden - b.orden : a.fecha < b.fecha ? -1 : 1));
          let saldo = 0;
          const conSaldo = movimientos.map(({ orden: _orden, ...m }) => {
            if (!m.anulado) saldo = redondear2(saldo + m.debe - m.haber);
            return { ...m, saldo };
          });
          const hoy = hoyArgentina();
          return {
            moneda,
            saldo,
            aVencer: redondear2(
              ks
                .filter((k) => !k.anulado && k.saldo > 0 && k.vencimiento > hoy)
                .reduce((s, k) => s + (k.sentido === 'a_cobrar' ? k.saldo : -k.saldo), 0),
            ),
            movimientos: conSaldo,
            pendientes: ks
              .filter((k) => !k.anulado && k.saldo > 0)
              .sort(porAntiguedad)
              .map((k) => ({
                conceptoId: k.id,
                contrato: k.contrato ? { id: k.contrato.id, codigo: k.contrato.codigo } : null,
                descripcion: k.descripcion,
                sentido: k.sentido as SentidoConcepto,
                vencimiento: k.vencimiento,
                importe: k.importe,
                saldo: k.saldo,
              })),
            aFavor: creditos.filter((c) => c.moneda === moneda).map(({ moneda: _m, ...c }) => c),
          };
        }),
      };
    });
  }

  private async persona(tx: Tx, id: string): Promise<{ id: string; nombre: string }> {
    const p = await tx.alqPersona.findUnique({ where: { id }, select: { id: true, nombre: true } });
    if (!p) throw new NotFoundException('La persona no existe.');
    return p;
  }

  /**
   * Conceptos con su saldo y cobros con lo que les queda a favor. Dos
   * consultas, tenga la persona diez conceptos o trescientos.
   */
  private async estado(tx: Tx, personaId: string, moneda?: MonedaAlquiler) {
    const [filasConceptos, filasCobros] = await Promise.all([
      tx.alqConcepto.findMany({
        where: { personaId, ...(moneda ? { moneda } : {}) },
        include: {
          contrato: { select: { id: true, codigo: true, punitorioDiarioPct: true } },
          imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
        },
      }),
      tx.alqCobro.findMany({
        where: { personaId, ...(moneda ? { moneda } : {}) },
        include: {
          imputaciones: {
            where: IMPUTACION_ACTIVA,
            select: { importe: true, concepto: { select: { sentido: true } } },
          },
        },
        orderBy: { numero: 'asc' },
      }),
    ]);
    const conceptos = filasConceptos.map((k) => {
      const importe = decToNum(k.importe);
      return {
        id: k.id,
        liquidado: k.liquidacionId != null,
        tipo: k.tipo,
        sentido: k.sentido,
        moneda: k.moneda,
        importe,
        // Liquidado = saldado con el propietario (regla 20): no queda nada pendiente.
        saldo: saldoDeConcepto(k),
        vencimiento: fromDate(k.vencimiento)!,
        createdAt: k.createdAt,
        periodo: k.periodo,
        origenId: k.origenId,
        descripcion: k.descripcion ?? k.tipo,
        contrato: k.contrato
          ? {
              id: k.contrato.id,
              codigo: k.contrato.codigo,
              punitorioDiarioPct: decToNum(k.contrato.punitorioDiarioPct),
            }
          : null,
        anulado: k.anuladoEn != null,
      };
    });
    const cobros = filasCobros.map((c) => ({
      id: c.id,
      numero: c.numero,
      moneda: c.moneda,
      fecha: fromDate(c.fecha)!,
      createdAt: c.createdAt,
      importe: decToNum(c.importe),
      anulado: c.anuladoEn != null,
      disponible: c.anuladoEn ? 0 : disponibleDe(decToNum(c.importe), c.imputaciones),
    }));
    const creditos = cobros
      .filter((c) => c.disponible > 0)
      .map((c) => ({
        cobroId: c.id,
        numero: c.numero,
        disponible: c.disponible,
        moneda: c.moneda,
      }));
    return { conceptos, cobros, creditos };
  }
}

/** Lo que le queda a un cobro: su importe, más lo compensado de reintegros, menos lo imputado a deudas. */
function disponibleDe(
  importe: number,
  imputaciones: { importe: Prisma.Decimal; concepto: { sentido: string } }[],
): number {
  const neto = imputaciones.reduce(
    (s, i) => s + (i.concepto.sentido === 'a_pagar' ? 1 : -1) * decToNum(i.importe),
    importe,
  );
  return redondear2(neto);
}

const porAntiguedad = (a: ConceptoConSaldo, b: ConceptoConSaldo) =>
  a.vencimiento === b.vencimiento
    ? a.createdAt.getTime() - b.createdAt.getTime()
    : a.vencimiento < b.vencimiento
      ? -1
      : 1;

/** Regla 15: lo que se cobra, del vencimiento más viejo al más nuevo. */
function deudasDe(conceptos: ConceptoConSaldo[]): ConceptoConSaldo[] {
  return conceptos
    .filter(
      (c) =>
        !c.anulado &&
        c.sentido === 'a_cobrar' &&
        c.saldo > 0 &&
        !TIPOS_QUE_SE_LIQUIDAN.includes(c.tipo),
    )
    .sort(porAntiguedad);
}

function compensablesDe(conceptos: ConceptoConSaldo[]): ConceptoConSaldo[] {
  return conceptos
    .filter(
      (c) =>
        !c.anulado && c.sentido === 'a_pagar' && c.saldo > 0 && TIPOS_COMPENSABLES.includes(c.tipo),
    )
    .sort(porAntiguedad);
}

/**
 * Regla 16: solo los alquileres llevan punitorio. Los días corren desde el
 * vencimiento o desde el último punitorio cobrado por ese alquiler.
 */
function propuesta(
  c: ConceptoConSaldo,
  todos: ConceptoConSaldo[],
  fecha: string,
): { dias: number; importe: number } {
  if (c.tipo !== 'alquiler' || !c.contrato) return { dias: 0, importe: 0 };
  const anteriores = todos
    .filter((k) => k.tipo === 'punitorio' && k.origenId === c.id && !k.anulado)
    .map((k) => k.vencimiento);
  const desde = [c.vencimiento, ...anteriores].sort().at(-1)!;
  return proponerPunitorio(c.saldo, desde, fecha, c.contrato.punitorioDiarioPct);
}

function aDeuda(c: ConceptoConSaldo, p: { dias: number; importe: number }): DeudaDto {
  return {
    conceptoId: c.id,
    contrato: c.contrato ? { id: c.contrato.id, codigo: c.contrato.codigo } : null,
    tipo: c.tipo as TipoConcepto,
    descripcion: c.descripcion,
    vencimiento: c.vencimiento,
    importe: c.importe,
    saldo: c.saldo,
    punitorio: p.importe > 0 ? p : null,
  };
}

function aDto(c: FilaCobro, nombres: Map<string, string>): CobroDto {
  const imputaciones = c.registradas.map((i) => ({
    conceptoId: i.concepto.id,
    contrato: i.concepto.contrato,
    descripcion: i.concepto.descripcion ?? i.concepto.tipo,
    sentido: i.concepto.sentido as SentidoConcepto,
    importe: decToNum(i.importe),
    deSaldoAFavor: i.cobroId === c.id ? null : i.cobro.numero,
  }));
  return {
    id: c.id,
    numero: c.numero,
    persona: c.persona,
    fecha: fromDate(c.fecha)!,
    moneda: c.moneda as MonedaAlquiler,
    importe: decToNum(c.importe),
    medio: c.medio as MedioCobro,
    obs: c.obs,
    imputaciones,
    aFavor: c.anuladoEn ? 0 : disponibleDe(decToNum(c.importe), c.imputaciones),
    anulado: c.anuladoEn
      ? {
          en: c.anuladoEn.toISOString(),
          motivo: c.motivoAnulacion ?? '',
          por: c.anuladoPorId ? (nombres.get(c.anuladoPorId) ?? null) : null,
        }
      : null,
    registradoPor: c.creadoPorId ? (nombres.get(c.creadoPorId) ?? null) : null,
  };
}
