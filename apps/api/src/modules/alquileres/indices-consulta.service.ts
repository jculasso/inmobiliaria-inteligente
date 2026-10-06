import { Injectable } from '@nestjs/common';
import type { IndicesDto, IndicesQuery } from '@vacker/types';
import { sumarDiasIso } from '@vacker/domain';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';

const FUENTE = { ICL: 'BCRA · Índice para Contratos de Locación (diario)', IPC: 'INDEC · Índice de Precios al Consumidor (mensual)' } as const;

/** Tope de días del ICL que se muestran de una vez: un año y un mes. */
const TOPE_DIAS_ICL = 400;

const pct = (actual: number, anterior: number | undefined) => (anterior ? Math.round((actual / anterior - 1) * 10000) / 100 : null);

/**
 * La pestaña «Índices» (punto 3 de Javier): los valores que usa la
 * indexación, de dónde salen y cuándo se actualizaron. `indice_valor` es una
 * tabla global de solo lectura, la misma para todas las inmobiliarias.
 *
 * El ICL es diario —más de 2.000 valores—: se lee por rango. El IPC es
 * mensual: se lee entero, con la variación de cada mes y la interanual.
 */
@Injectable()
export class IndicesConsultaService {
  constructor(private readonly db: TenantPrismaService) {}

  async listar(q: IndicesQuery): Promise<IndicesDto> {
    return this.db.withTenant(async (tx) => {
      const ultimo = await tx.indiceValor.findFirst({ where: { indice: q.indice }, orderBy: { fecha: 'desc' }, select: { fecha: true, createdAt: true } });
      const ultimaFecha = ultimo ? fromDate(ultimo.fecha)! : null;
      const base = { indice: q.indice, fuente: FUENTE[q.indice], ultimaFecha, actualizado: ultimo?.createdAt.toISOString() ?? null };
      if (!ultimaFecha) return { ...base, valores: [] };

      if (q.indice === 'ICL') {
        const hasta = q.hasta ?? ultimaFecha;
        const desdePedido = q.desde ?? sumarDiasIso(hasta, -59);
        const desde = desdePedido < sumarDiasIso(hasta, -TOPE_DIAS_ICL) ? sumarDiasIso(hasta, -TOPE_DIAS_ICL) : desdePedido;
        const filas = await tx.indiceValor.findMany({
          where: { indice: 'ICL', fecha: { gte: toDate(desde)!, lte: toDate(hasta)! } },
          orderBy: { fecha: 'desc' },
          select: { fecha: true, valor: true },
        });
        return { ...base, valores: filas.map((f) => ({ fecha: fromDate(f.fecha)!, valor: decToNum(f.valor), variacionMensual: null, variacionInteranual: null })) };
      }

      const filas = await tx.indiceValor.findMany({ where: { indice: 'IPC' }, orderBy: { fecha: 'asc' }, select: { fecha: true, valor: true } });
      const porMes = new Map(filas.map((f) => [fromDate(f.fecha)!.slice(0, 7), decToNum(f.valor)]));
      const mesAntes = (mes: string, n: number) => {
        const [a, m] = mes.split('-').map(Number) as [number, number];
        const total = a * 12 + (m - 1) - n;
        return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
      };
      const valores = filas
        .map((f) => {
          const fecha = fromDate(f.fecha)!;
          const valor = decToNum(f.valor);
          return { fecha, valor, variacionMensual: pct(valor, porMes.get(mesAntes(fecha.slice(0, 7), 1))), variacionInteranual: pct(valor, porMes.get(mesAntes(fecha.slice(0, 7), 12))) };
        })
        .reverse();
      return { ...base, valores };
    });
  }
}
