import {
  esTramoAnterior,
  fechaDelIndice,
  proponerIndexacion,
  type EsperaDeIndice,
  type IndiceConFuente,
} from '@vacker/domain';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { fromDate, toDate } from '../tablero/tablero.util';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** Los valores cargados de los índices, por `INDICE:AAAA-MM-DD`. */
export type ValoresDeIndices = Map<string, number>;
export const claveDeValor = (indice: string, fecha: string) => `${indice}:${fecha}`;

/**
 * Una sola consulta para todos los valores que hacen falta, sean cuantos sean
 * los tramos. La usan la bandeja «a indexar» y la generación del mes: los dos
 * tienen que ver el mismo índice para decir lo mismo de un tramo.
 */
export async function valoresDeIndices(
  tx: Tx,
  pedidos: { indice: string | null; desdes: string[] }[],
): Promise<ValoresDeIndices> {
  const porIndice = new Map<IndiceConFuente, Set<string>>();
  for (const { indice, desdes } of pedidos) {
    if (indice !== 'ICL' && indice !== 'IPC') continue;
    const set = porIndice.get(indice) ?? new Set<string>();
    for (const d of desdes) set.add(fechaDelIndice(indice, d));
    porIndice.set(indice, set);
  }
  if (porIndice.size === 0) return new Map();
  const filas = await tx.indiceValor.findMany({
    where: {
      OR: [...porIndice].map(([indice, fechas]) => ({
        indice,
        fecha: { in: [...fechas].map((f) => toDate(f)!) },
      })),
    },
  });
  return new Map(filas.map((f) => [claveDeValor(f.indice, fromDate(f.fecha)!), Number(f.valor)]));
}

/** Cómo se nombra un índice en una descripción: «IPC», «ICL», «Casa Propia». */
export function nombreDelIndice(indice: string | null): string {
  if (indice === 'CCP') return 'Casa Propia';
  return indice ?? 'índice';
}

interface ContratoConTramos {
  id: string;
  ajuste: string;
  indice: string | null;
  tramos: { numero: number; desde: Date; hasta: Date; importe: unknown }[];
}

/**
 * Regla 130: qué tramos de cada contrato esperan su índice en el mes, y con
 * qué importe se cobra mientras tanto (el del tramo anterior).
 *
 * Espera el que no tiene importe, se encadena sobre uno que sí (regla 5), no
 * es historia de un contrato tomado en curso (regla 106) y cuyo importe el
 * sistema todavía no puede saber: el ICL o el IPC que necesita
 * no se publicó (regla 7), o el índice no tiene fuente y se carga a mano
 * (Casa Propia). Uno cuyo índice ya salió NO espera: falta que alguien
 * confirme, y sigue la regla 11.
 *
 * Una consulta (los valores de los índices) sean cuantos sean los contratos, y
 * ninguna si ningún tramo del mes está sin importe.
 */
export async function esperasDeIndice(
  tx: Tx,
  contratos: ContratoConTramos[],
  mes: { desde: string; hasta: string },
): Promise<Map<string, Map<number, EsperaDeIndice>>> {
  const candidatos = contratos.flatMap((c) => {
    if (c.ajuste !== 'indexado') return [];
    const orden = [...c.tramos].sort((a, b) => a.numero - b.numero);
    const importes = orden.map((t) => ({ importe: t.importe == null ? null : Number(t.importe) }));
    return orden.flatMap((t, i) => {
      if (t.importe != null) return [];
      // Regla 106: un tramo sin importe seguido de uno con importe es historia
      // de un contrato tomado en curso, no un índice que se espera.
      if (esTramoAnterior(importes, i)) return [];
      if (fromDate(t.desde)! > mes.hasta || fromDate(t.hasta)! < mes.desde) return [];
      const anterior = c.tramos.find((x) => x.numero === t.numero - 1);
      if (anterior?.importe == null) return [];
      return [
        { c, t, anterior: { desde: fromDate(anterior.desde)!, importe: Number(anterior.importe) } },
      ];
    });
  });
  const esperas = new Map<string, Map<number, EsperaDeIndice>>();
  if (candidatos.length === 0) return esperas;
  const valores = await valoresDeIndices(
    tx,
    candidatos.map(({ c, t, anterior }) => ({
      indice: c.indice,
      desdes: [anterior.desde, fromDate(t.desde)!],
    })),
  );
  for (const { c, t, anterior } of candidatos) {
    const p = proponerIndexacion(c.indice ?? '', anterior, { desde: fromDate(t.desde)! }, (i, f) =>
      valores.get(claveDeValor(i, f)),
    );
    if (p.estado === 'lista') continue;
    const espera =
      p.estado === 'pendiente_indice'
        ? p.falta.join(' y ')
        : `el valor de ${nombreDelIndice(c.indice)}`;
    const delContrato = esperas.get(c.id) ?? new Map<number, EsperaDeIndice>();
    delContrato.set(t.numero, { importeProvisorio: anterior.importe, espera });
    esperas.set(c.id, delContrato);
  }
  return esperas;
}
