import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * Los candados de Alquileres, en un solo lugar (revisión de seguridad del
 * 15/10/2026).
 *
 * Son `pg_advisory_xact_lock` por inmobiliaria: se sueltan solos al terminar
 * la transacción, y dos inmobiliarias nunca se esperan entre sí. Sirven para
 * lo que un índice único no puede frenar: dos pedidos que leen lo mismo, deciden
 * por separado y escriben los dos.
 *
 * - `alq_generacion`: generar el mes, confirmar una indexación y corregir un
 *   tramo. Sin él, «Generar el período» podía leer el tramo sin importe,
 *   la confirmación terminar en el medio —y calcular las finales de las
 *   parciales que ya existían— y la generación guardar después una parcial
 *   nueva que no iba a tener nunca su final.
 * - `alq_cobro`: el número de recibo, y todo lo que no puede cambiar mientras
 *   se cobra (la corrección de un tramo).
 * - `alq_liquidacion`: el número de liquidación, y lo mismo del lado del
 *   propietario.
 *
 * **El orden es siempre el de `ORDEN_CANDADOS`**, y antes que todos va el candado de
 * fila de la reserva (`bloquearReserva`). Dos transacciones que toman los
 * mismos candados en el mismo orden se esperan; en distinto orden, se pueden
 * trabar entre sí (deadlock) y Postgres mata a una. Por eso `tomarCandados`
 * los ordena solo: quien lo llama dice cuáles, no en qué orden.
 *
 * Hoy Cobros toma solo `alq_cobro` y Liquidaciones solo `alq_liquidacion`;
 * la corrección de un tramo es la única que toma los tres.
 */
export const ORDEN_CANDADOS = ['alq_generacion', 'alq_cobro', 'alq_liquidacion'] as const;
export type Candado = (typeof ORDEN_CANDADOS)[number];

/**
 * Toma los candados pedidos en el orden de `ORDEN_CANDADOS`, uno por sentencia: el
 * orden de evaluación dentro de un mismo SELECT no lo garantiza Postgres.
 *
 * La clave es `<tenant>:<candado>`, el mismo texto que ya usaban Cobros y
 * Liquidaciones (`tenant || ':alq_cobro'`): un despliegue a medias no deja dos
 * versiones del candado que no se ven entre sí.
 */
export async function tomarCandados(
  tx: Tx,
  tenantId: string,
  ...candados: Candado[]
): Promise<void> {
  for (const c of ORDEN_CANDADOS)
    if (candados.includes(c))
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${c}`}))`;
}

/**
 * La fila de la reserva, bloqueada hasta el final de la transacción. Va
 * ANTES de leerla: con READ COMMITTED, lo que se lee después del candado es lo
 * último confirmado, así que dos pedidos sobre la misma reserva —cobrar la
 * seña dos veces, aprobar y rechazar a la vez, anular mientras se cobra— se
 * hacen uno detrás del otro y el segundo ve lo que dejó el primero.
 *
 * Va antes que cualquier candado de `tomarCandados` (cobrar la seña toma
 * `alq_cobro` después, para el número del recibo).
 */
export async function bloquearReserva(tx: Tx, id: string): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM alq_reserva WHERE id = ${id}::uuid FOR UPDATE`;
}
