import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MedioCobro, MonedaAlquiler, SenaDto } from '@vacker/types';
import { cargoConIva, redondear2, repartir } from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { tomarCandados } from './candados';
import { plata, registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * La seña de una reserva en la cuenta corriente (reglas 169 a 172; Florencia,
 * Vacker, 15/10/2026: «la seña la guarda la inmobiliaria», «al interesado se
 * le da un recibo», «la seña pasa a ser el depósito», y si la reserva se cae,
 * «se retiene y se le entrega al propietario»).
 *
 * Cómo se representa:
 *
 * - **Cobrarla** crea un concepto `sena` a cobrar del interesado, con su
 *   reserva (`reservaId`), y un cobro que lo cancela: el MISMO recibo de
 *   Cobros, con número, PDF y «Mandar por mail». El concepto lleva el
 *   `cobroId` del recibo, como los punitorios: anular el recibo lo anula.
 * - **Convertir** le pone el contrato a ese concepto: pasa a ser el depósito
 *   (`estadoDeposito` lo cuenta como pagado, en la fecha del recibo). Si el
 *   depósito es menor, lo que sobra se le reintegra al inquilino (un concepto
 *   `deposito` a pagar); si es mayor, la diferencia se propone como cargo de
 *   ingreso.
 * - **Retenerla** crea un concepto `sena` a pagar a cada propietario, que se
 *   liquida en su próxima liquidación (con honorarios si la inmobiliaria los
 *   configuró). También lleva el `cobroId`: si el recibo se anula, no hay
 *   nada que entregar.
 *
 * Un concepto nuevo y no `deposito` con una referencia: mientras la reserva
 * está abierta la seña no es un depósito —puede terminar en el propietario—,
 * y en la cuenta corriente del interesado tiene que decir lo que es.
 */

/** Lo que se lee de los conceptos de la seña de una reserva: los vigentes. */
export const CONCEPTOS_DE_LA_SENA = {
  where: { tipo: 'sena', anuladoEn: null },
  select: {
    id: true,
    sentido: true,
    importe: true,
    moneda: true,
    personaId: true,
    contratoId: true,
    cobro: { select: { id: true, numero: true, fecha: true, medio: true } },
  },
  orderBy: { createdAt: 'asc' },
} satisfies Prisma.AlqReserva$conceptosArgs;

type ConceptoDeLaSena = Prisma.AlqConceptoGetPayload<{
  select: (typeof CONCEPTOS_DE_LA_SENA)['select'];
}>;

/** El concepto de la seña cobrada (a cobrar, con su recibo vigente), si lo hay. */
export const senaCobrada = (ks: ConceptoDeLaSena[]) =>
  ks.find((k) => k.sentido === 'a_cobrar' && k.cobro) ?? null;

/** «000123», como en el recibo. */
export const nroRecibo = (n: number) => String(n).padStart(6, '0');

/** La seña de la reserva: la acordada y, si se cobró, su recibo. */
export function senaDto(
  r: { senaImporte: Prisma.Decimal | null; senaMoneda: string | null },
  ks: ConceptoDeLaSena[],
): SenaDto | null {
  const cobrada = senaCobrada(ks);
  if (r.senaImporte == null && !cobrada) return null;
  return {
    importe: cobrada ? decToNum(cobrada.importe) : decToNum(r.senaImporte!),
    moneda: (cobrada?.moneda ?? r.senaMoneda ?? 'ARS') as MonedaAlquiler,
    recibida: !!cobrada,
    recibidaEl: cobrada?.cobro ? fromDate(cobrada.cobro.fecha) : null,
    medio: (cobrada?.cobro?.medio as MedioCobro | undefined) ?? null,
    recibo: cobrada?.cobro ? { id: cobrada.cobro.id, numero: cobrada.cobro.numero } : null,
  };
}

/** Regla 171: lo que se le entrega al propietario de una seña retenida, antes de honorarios. */
export function senaRetenida(ks: ConceptoDeLaSena[]): number | null {
  const aPagar = ks.filter((k) => k.sentido === 'a_pagar');
  return aPagar.length ? redondear2(aPagar.reduce((s, k) => s + decToNum(k.importe), 0)) : null;
}

/**
 * El número del próximo recibo, con el MISMO candado que Cobros
 * (`CobrosService.registrar`): dos cobros a la vez no pueden sacar el mismo
 * número, vengan de donde vengan.
 */
async function numeroDeRecibo(tx: Tx, tenantId: string): Promise<number> {
  await tomarCandados(tx, tenantId, 'alq_cobro');
  const ultimo = await tx.alqCobro.aggregate({ _max: { numero: true } });
  return (ultimo._max.numero ?? 0) + 1;
}

/**
 * Regla 169: cobrar la seña. El concepto del interesado, el recibo y la
 * imputación, juntos; y el historial de la reserva y el de la persona.
 */
export async function cobrarSena(
  tx: Tx,
  ctx: TenantContext,
  r: { id: string; numero: number; importe: number; moneda: MonedaAlquiler; propiedad: string },
  pago: { personaId: string; fecha: string; medio: MedioCobro; obs: string | null },
): Promise<{ cobroId: string; numero: number }> {
  const cobroId = randomUUID();
  const conceptoId = randomUUID();
  const numero = await numeroDeRecibo(tx, ctx.tenantId);
  await tx.alqCobro.create({
    data: {
      id: cobroId,
      tenantId: ctx.tenantId,
      numero,
      personaId: pago.personaId,
      fecha: toDate(pago.fecha)!,
      moneda: r.moneda,
      importe: r.importe,
      medio: pago.medio,
      obs: pago.obs,
      creadoPorId: ctx.userId,
    },
  });
  await tx.alqConcepto.create({
    data: {
      id: conceptoId,
      tenantId: ctx.tenantId,
      personaId: pago.personaId,
      reservaId: r.id,
      tipo: 'sena',
      sentido: 'a_cobrar',
      moneda: r.moneda,
      periodo: pago.fecha.slice(0, 7),
      vencimiento: toDate(pago.fecha)!,
      importe: r.importe,
      descripcion: `Seña de la reserva ${r.numero} · ${r.propiedad}`,
      // Con el recibo en la clave: si se anula, se puede cobrar de nuevo. Por
      // eso el índice único NO frena dos cobros a la vez de la misma seña: eso
      // lo hace el candado de fila de la reserva (`bloquearReserva`), que
      // `ReservasService.cobrarSena` toma antes de mirar si ya se cobró.
      claveGeneracion: `sena|${r.id}|${cobroId}`,
      cobroId,
      creadoPorId: ctx.userId,
    },
  });
  await tx.alqImputacion.create({
    data: {
      tenantId: ctx.tenantId,
      cobroId,
      conceptoId,
      importe: r.importe,
      registradaEnCobroId: cobroId,
    },
  });
  const resumen = `Seña de ${plata(r.importe, r.moneda)} cobrada: recibo ${nroRecibo(numero)}`;
  await registrarEventos(tx, ctx, [
    {
      entidad: 'reserva',
      entidadId: r.id,
      accion: 'alta',
      resumen: `Reserva ${r.numero}: ${resumen}`,
    },
    {
      entidad: 'cobro',
      entidadId: cobroId,
      personaId: pago.personaId,
      accion: 'alta',
      resumen: `Recibo ${nroRecibo(numero)} por ${plata(r.importe, r.moneda)} (seña de la reserva ${r.numero})`,
    },
  ]);
  return { cobroId, numero };
}

/**
 * Regla 170: al convertir, la seña cobrada pasa a ser el depósito del
 * contrato nuevo. Si el depósito es menor, lo que sobra se le reintegra al
 * inquilino; si es mayor, la diferencia la propone «Cargos de ingreso».
 * Corre en la transacción del alta (regla 159).
 */
export async function senaADeposito(
  tx: Tx,
  ctx: TenantContext,
  sena: ConceptoDeLaSena,
  contrato: {
    id: string;
    codigo: string;
    moneda: MonedaAlquiler;
    depositoImporte: number | null;
    depositoMoneda: MonedaAlquiler | null;
  },
  reserva: { id: string; numero: number },
): Promise<string> {
  const importe = decToNum(sena.importe);
  const moneda = sena.moneda as MonedaAlquiler;
  const deposito = contrato.depositoImporte ?? 0;
  const monedaDeposito = contrato.depositoMoneda ?? contrato.moneda;
  if (deposito > 0 && monedaDeposito !== moneda)
    throw new BadRequestException(
      `La seña es en ${moneda === 'USD' ? 'dólares' : 'pesos'} y el depósito en ${monedaDeposito === 'USD' ? 'dólares' : 'pesos'}: la seña pasa a ser el depósito, así que tienen que ser de la misma moneda.`,
    );
  await tx.alqConcepto.update({ where: { id: sena.id }, data: { contratoId: contrato.id } });
  const sobra = redondear2(importe - deposito);
  if (sobra > 0)
    await tx.alqConcepto.create({
      data: {
        tenantId: ctx.tenantId,
        contratoId: contrato.id,
        reservaId: reserva.id,
        personaId: sena.personaId,
        tipo: 'deposito',
        sentido: 'a_pagar',
        moneda,
        vencimiento: new Date(),
        importe: sobra,
        descripcion: `Reintegro: la seña de la reserva ${reserva.numero} supera el depósito`,
        claveGeneracion: `dep|${contrato.id}|excedente|${sena.personaId}`,
        cobroId: sena.cobro?.id ?? null,
        creadoPorId: ctx.userId,
      },
    });
  const falta = redondear2(deposito - importe);
  return falta > 0
    ? `La seña de ${plata(importe, moneda)} pasa a ser el depósito; faltan ${plata(falta, moneda)}, que se proponen como cargo de ingreso`
    : sobra > 0
      ? `La seña de ${plata(importe, moneda)} pasa a ser el depósito de ${plata(deposito, moneda)}; se le reintegran ${plata(sobra, moneda)} al inquilino`
      : `La seña de ${plata(importe, moneda)} pasa a ser el depósito`;
}

/**
 * Regla 171: la seña retenida se le entrega al propietario (o a los
 * propietarios, en partes iguales), en su próxima liquidación; con
 * honorarios si la inmobiliaria los configuró (0 por defecto).
 */
export async function retenerSena(
  tx: Tx,
  ctx: TenantContext,
  sena: ConceptoDeLaSena,
  reserva: { id: string; numero: number; propiedad: string },
  propietarios: string[],
  honorarios: { pct: number; ivaPct: number },
): Promise<string> {
  if (propietarios.length === 0)
    throw new BadRequestException(
      'Para retener la seña hace falta el propietario: elegí a quién se le entrega.',
    );
  const moneda = sena.moneda as MonedaAlquiler;
  const total = decToNum(sena.importe);
  const partes = repartir(
    total,
    propietarios.map(() => 100 / propietarios.length),
  );
  const filas: Prisma.AlqConceptoCreateManyInput[] = [];
  const hoy = new Date();
  propietarios.forEach((personaId, i) => {
    const comun = {
      tenantId: ctx.tenantId,
      reservaId: reserva.id,
      personaId,
      moneda,
      vencimiento: hoy,
      origenId: sena.id,
      cobroId: sena.cobro?.id ?? null,
      creadoPorId: ctx.userId,
    };
    filas.push({
      ...comun,
      tipo: 'sena',
      sentido: 'a_pagar',
      importe: partes[i]!,
      descripcion: `Seña retenida de la reserva ${reserva.numero} · ${reserva.propiedad}`,
      claveGeneracion: `sena|${reserva.id}|retenida|${personaId}`,
    });
    const honorario =
      honorarios.pct > 0 ? cargoConIva(partes[i]!, honorarios.pct, honorarios.ivaPct) : 0;
    if (honorario > 0)
      filas.push({
        ...comun,
        tipo: 'honorarios',
        sentido: 'a_cobrar',
        importe: honorario,
        descripcion: `Honorarios sobre la seña retenida de la reserva ${reserva.numero} (${honorarios.pct}%${honorarios.ivaPct ? ' + IVA' : ''})`,
        claveGeneracion: `sena|${reserva.id}|honorarios|${personaId}`,
      });
  });
  await tx.alqConcepto.createMany({ data: filas });
  return `la seña de ${plata(total, moneda)} se le entrega al propietario en su próxima liquidación`;
}

/** Regla 172: anular la reserva con la seña cobrada pide anular primero su recibo. */
export function assertSinReciboVigente(ks: ConceptoDeLaSena[]): void {
  const cobrada = senaCobrada(ks);
  if (cobrada?.cobro)
    throw new ConflictException(
      `La seña tiene el recibo ${nroRecibo(cobrada.cobro.numero)}: anulalo primero, en Cobros, y después anulá la reserva.`,
    );
}
