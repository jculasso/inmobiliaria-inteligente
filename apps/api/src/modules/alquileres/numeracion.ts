import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { tomarCandados } from './candados';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** «000123», como en el recibo. */
export const nroRecibo = (n: number) => String(n).padStart(6, '0');

/**
 * El número del próximo recibo de la inmobiliaria: uno solo para todo lo que
 * da recibo —un cobro de Cobros (`CobrosService.registrar`) y la seña de una
 * reserva (`cobrarSena`)—, así que los dos comparten la misma serie.
 *
 * Toma `alq_cobro` antes de leer el máximo: sin el candado, dos cobros a la
 * vez sacarían el mismo número. Como todo candado de `tomarCandados`, va
 * DESPUÉS del candado de fila de la reserva, si quien llama lo toma
 * (CONVENCIONES §19). Y si algo se escapara, el índice único
 * `(tenant_id, numero)` de `alq_cobro` es la red: el segundo insert falla en
 * lugar de repetir el número.
 *
 * El máximo es de la inmobiliaria del `tx` (RLS) e incluye los recibos
 * anulados: un número no se reutiliza nunca.
 */
export async function siguienteNumeroDeRecibo(tx: Tx, tenantId: string): Promise<number> {
  await tomarCandados(tx, tenantId, 'alq_cobro');
  const ultimo = await tx.alqCobro.aggregate({ _max: { numero: true } });
  return (ultimo._max.numero ?? 0) + 1;
}
