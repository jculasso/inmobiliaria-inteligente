import { z } from 'zod';

/**
 * La fecha `AAAA-MM-DD` de Alquileres, una sola para todo el módulo
 * (revisión de seguridad del 15/10/2026).
 *
 * Hasta entonces era solo una expresión regular: «2026-13-01» o «2026-02-31»
 * pasaban la validación, llegaban a Prisma y la API respondía 500 en lugar de
 * 400. Ahora la fecha tiene que existir en el calendario y caer en un rango
 * sensato.
 *
 * El rango arranca en 1900 y no más tarde porque la misma fecha sirve para
 * la de nacimiento de una persona; termina en 2100, que sobra para cualquier
 * contrato y frena un año tipeado de más («20266»).
 */
export const ANIO_MINIMO = 1900;
export const ANIO_MAXIMO = 2100;

const PATRON = /^\d{4}-\d{2}-\d{2}$/;

/** ¿`AAAA-MM-DD` es un día que existe, entre 1900 y 2100? «2026-02-29» no; «2028-02-29» sí. */
export function esFechaIsoReal(s: string): boolean {
  if (!PATRON.test(s)) return false;
  const [anio, mes, dia] = s.split('-').map(Number) as [number, number, number];
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO || mes < 1 || mes > 12 || dia < 1) return false;
  // El día 0 del mes siguiente es el último de este (en UTC, sin husos).
  return dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export const FechaIsoSchema = z
  .string()
  .regex(PATRON, 'Fecha inválida, se espera AAAA-MM-DD.')
  // Si no tiene la forma, ya lo dijo el `regex`: un solo mensaje por fecha.
  .refine((s) => !PATRON.test(s) || esFechaIsoReal(s), {
    message: `Esa fecha no existe, o está fuera de ${ANIO_MINIMO}–${ANIO_MAXIMO}.`,
  });
