import { ESTADOS_RECLAMO_ABIERTOS } from '@vacker/types';
import { cierreDelMes, sumarDiasIso } from '@vacker/domain';
import { enUnViaje } from '../../../prisma/en-un-viaje';
import { toDate } from '../../tablero/tablero.util';
import { CONSULTA_RESERVAS_TABLERO } from '../tablero-reservas';
import { sqlAlquileres, unirFinales, type FilaAlquiler } from './cobranza';
import { mesesDe, type Tx } from './comun';
import { ORDEN_CONTRATOS, SELECT_CONTRATO } from './fichas';
import { sqlIngresosPorMes, type FilaIngresoMes } from './ingresos';
import { sqlSaldosAlCierre, type FilaMora } from './morosidad';
import { sqlFinalesPendientes, type FilaFinalPendiente } from './tareas';

/**
 * Seis consultas, siempre las mismas, en una transacción (regla 82). Las
 * cuatro que se calculan en la base —los alquileres, la deuda a cada cierre,
 * los ingresos por mes y las liquidaciones finales pendientes (regla
 * 139)— van en UNA sentencia (`enUnViaje`): un viaje a São Paulo en vez de
 * cuatro, y una sola foto de la base para las cuatro. Después, los
 * reclamos, las pólizas, las boletas, las reservas abiertas (regla 166) y
 * los contratos que todo eso nombra.
 */
export async function leerTablero(tx: Tx, hoy: string, mes: string, anio: number) {
  // El año elegido y el anterior, para la planilla, y siempre el mes en
  // curso, por el orden de despliegue de la pantalla anterior.
  const anioHoy = Number(hoy.slice(0, 4));
  const desdeIngresos = `${Math.min(anio - 1, anioHoy)}-01-01`;
  const hastaIngresos = `${Math.max(anio, anioHoy) + 1}-01-01`;
  // El cierre de cada mes del año y hoy: la deuda de la foto de cada mes y la de hoy.
  const cierres = [...new Set([...mesesDe(anio).map((m) => cierreDelMes(m, hoy)), hoy])].sort();
  const [enLaBase, reclamos, polizas, boletas, reservas] = await Promise.all([
    enUnViaje(tx, {
      alquileres: {
        sql: sqlAlquileres(`${anio}-01`, `${anio}-12`, mes),
        decimales: ['importe', 'cobrado', 'cobrado_al_cierre'],
        fechas: ['vencimiento'],
      },
      mora: { sql: sqlSaldosAlCierre(cierres), decimales: ['saldo'], fechas: ['vencimiento'] },
      ingresos: { sql: sqlIngresosPorMes(desdeIngresos, hastaIngresos), decimales: ['importe'] },
      finales: { sql: sqlFinalesPendientes(), decimales: ['saldo'], fechas: ['vencimiento'] },
    }),
    // Reclamos abiertos o en curso (entrega 15).
    tx.alqReclamo.findMany({
      where: { estado: { in: [...ESTADOS_RECLAMO_ABIERTOS] } },
      select: { id: true, asunto: true, prioridad: true, contratoId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // La última póliza de cada contrato vigente: una vieja ya renovada no
    // es una póliza vencida (antes quedaba «Vencida» para siempre).
    tx.alqPoliza.findMany({
      where: { anuladoEn: null, contrato: { estado: 'vigente' } },
      distinct: ['contratoId'],
      orderBy: [{ contratoId: 'asc' }, { hasta: 'desc' }],
      select: {
        id: true,
        contratoId: true,
        aseguradora: true,
        numero: true,
        hasta: true,
        contrato: { select: { codigo: true, estado: true } },
      },
    }),
    tx.alqBoleta.findMany({
      where: {
        paga: 'inmobiliaria',
        pagadaEl: null,
        anuladoEn: null,
        vencimiento: { lte: toDate(sumarDiasIso(hoy, 7))! },
      },
      select: {
        id: true,
        contratoId: true,
        cuota: true,
        vencimiento: true,
        importe: true,
        cuenta: { select: { servicio: { select: { nombre: true } } } },
        poliza: { select: { aseguradora: true } },
      },
      orderBy: { vencimiento: 'asc' },
    }),
    // Las reservas abiertas (regla 166): una consulta más, siempre la misma.
    tx.alqReserva.findMany(CONSULTA_RESERVAS_TABLERO),
  ]);
  const alquileresLeidos = enLaBase.alquileres as unknown as FilaAlquiler[];
  const mora = enLaBase.mora as unknown as FilaMora[];
  const ingresos = enLaBase.ingresos as unknown as FilaIngresoMes[];
  const finales = enLaBase.finales as unknown as FilaFinalPendiente[];
  const alquileres = unirFinales(alquileresLeidos);
  // Los contratos que nombran las listas que viajan con el tablero: los
  // alquileres del mes, la deuda de hoy, los reclamos y las boletas.
  const nombrados = [
    ...new Set(
      [...reclamos, ...boletas]
        .map((x) => x.contratoId)
        .concat(finales.map((k) => k.contrato_id))
        .concat(alquileres.filter((k) => k.periodo === mes).map((k) => k.contrato_id))
        .concat(mora.filter((m) => m.cierre === hoy).map((m) => m.contrato_id))
        .filter((x): x is string => !!x),
    ),
  ];
  const contratos = await tx.alqContrato.findMany({
    // No todos los de la historia (un tercio se renueva por año): los vigentes,
    // los que siguieron en algún momento del año elegido (la foto de cada
    // cierre), los que empezaron desde el año anterior (contratos nuevos y su
    // comparación), los que deben el depósito y los que nombran las listas.
    where: {
      estado: { notIn: ['borrador', 'anulado'] },
      OR: [
        { estado: 'vigente' },
        { fin: { gte: toDate(`${anio}-01-01`)! } },
        { inicio: { gte: toDate(`${anio - 1}-01-01`)! } },
        { depositoImporte: { gt: 0 }, depositoDevolucion: null },
        { id: { in: nombrados } },
      ],
    },
    select: SELECT_CONTRATO,
    orderBy: ORDEN_CONTRATOS,
  });
  return {
    contratos,
    alquileres,
    mora,
    ingresos,
    reclamos,
    polizas,
    boletas,
    finales,
    reservas,
  };
}
export type DatosTablero = Awaited<ReturnType<typeof leerTablero>>;
