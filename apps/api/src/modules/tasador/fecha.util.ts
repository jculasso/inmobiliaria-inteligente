import type { Prisma } from '@prisma/client';
import type { TasadorKpiFiltro } from '@vacker/types';

/**
 * Rangos `[inicio, fin)` sobre `fecha` (UTC), fuente única para el módulo
 * Tasador. Antes esta lógica estaba triplicada (kpis.service, reporte.service
 * y tasaciones.service) con dos firmas distintas — acá se unifica.
 */

/** Rango de un mes puntual (mes 1-12). */
function rangoMes(anio: number, mes: number): Prisma.DateTimeFilter {
  return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
}

/** Rango de un año completo. */
function rangoAnio(anio: number): Prisma.DateTimeFilter {
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}

/**
 * Rango según el período del filtro de KPIs (mensual/trimestral/anual).
 * Usado por `kpis.service.ts` y `reporte.service.tsx`.
 */
export function rangoDeFiltro(filtro: TasadorKpiFiltro): Prisma.DateTimeFilter {
  const { anio, periodo } = filtro;
  if (periodo === 'mensual') return rangoMes(anio, filtro.mes ?? 1);
  if (periodo === 'trimestral') {
    const mesInicio = ((filtro.trimestre ?? 1) - 1) * 3;
    return { gte: new Date(Date.UTC(anio, mesInicio, 1)), lt: new Date(Date.UTC(anio, mesInicio + 3, 1)) };
  }
  return rangoAnio(anio);
}

/**
 * Rango para un año completo o un mes puntual (filtros opcionales del listado
 * de tasaciones). `undefined` = sin filtro de fecha.
 */
export function rangoDeAnioMes(anio?: number, mes?: number): Prisma.DateTimeFilter | undefined {
  if (anio == null) return undefined;
  if (mes != null) return rangoMes(anio, mes);
  return rangoAnio(anio);
}
