import { diasDelMes, sumarDiasIso } from '@vacker/domain';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { fromDate, toDate } from '../tablero/tablero.util';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/**
 * Cuántos días después del último del mes se miran los feriados: un
 * vencimiento el 28 que cae viernes feriado se corre hasta el lunes 31 o al
 * mes siguiente. Ningún tramo de días no hábiles llega a 15.
 */
const DIAS_DE_MARGEN = 15;

/**
 * Los feriados nacionales que pueden mover un vencimiento de estos períodos
 * (regla 100), en UNA consulta, sean cuantos sean los contratos o los meses.
 *
 * `feriado` es global y de solo lectura (como `indice_valor`): se lee dentro
 * de withTenant con la policy `lectura`. Si la tarea diaria todavía no cargó
 * un año, la tabla está vacía para esas fechas y los vencimientos solo se
 * corren por fin de semana: la generación no se frena por un feriado que
 * falta (regla 101).
 */
export async function feriadosDe(tx: Tx, periodos: string[]): Promise<Set<string>> {
  if (periodos.length === 0) return new Set();
  const orden = [...periodos].sort();
  const ultimo = orden.at(-1)!;
  const [anio, mes] = ultimo.split('-').map(Number) as [number, number];
  const filas = await tx.feriado.findMany({
    where: {
      fecha: {
        gte: toDate(`${orden[0]}-01`)!,
        lte: toDate(sumarDiasIso(`${ultimo}-${diasDelMes(anio, mes)}`, DIAS_DE_MARGEN))!,
      },
    },
    select: { fecha: true },
  });
  return new Set(filas.map((f) => fromDate(f.fecha)!));
}
