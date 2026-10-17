import type { FilaTablero, Indicador } from '@vacker/types';
import { redondear2, sumarMesesIso } from '@vacker/domain';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';

/** La transacción de `withTenant` por la que pasan todas las lecturas del tablero. */
export type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** «1 día», «29 días». */
export const enDias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

export const aContrato = (id: string) => `/alquileres/contratos/${id}`;
export const aPersona = (id: string) => `/alquileres/personas/${id}`;

/** Un número que suma sus filas (regla 26): el valor sale de las filas, nunca aparte. */
export function porImporte(filas: FilaTablero[]): Indicador {
  return { valor: redondear2(filas.reduce((s, f) => s + (f.importe ?? 0), 0)), filas };
}

export function porCantidad(filas: FilaTablero[]): Indicador {
  return { valor: filas.length, filas };
}

export const sumar = (xs: number[]) => redondear2(xs.reduce((s, x) => s + x, 0));

/** Los doce meses de un año, `AAAA-MM`. */
export const mesesDe = (anio: number) =>
  Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);

/** El día siguiente al último del mes `AAAA-MM`: el tope (excluido) de un rango de fechas. */
export const primeroDelSiguiente = (mes: string) => sumarMesesIso(`${mes}-01`, 1);
