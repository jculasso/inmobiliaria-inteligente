import type { Prisma } from '@prisma/client';
import { parteDeClave } from '@vacker/domain';

/**
 * Lo que el inquilino tiene que pagar para que se le libere al propietario su
 * parte (regla 22): el alquiler y el IVA del alquiler de la misma parte del
 * mes. Es lo que mira la liquidación y lo que mira el informe al propietario:
 * los dos con este filtro y con `fraccionesCobradas`, así un alquiler no
 * figura cobrado en uno y en espera en el otro.
 */
export function alquileresDelInquilino(
  contratos: string[],
  periodos: string[],
): Prisma.AlqConceptoWhereInput {
  return {
    contratoId: { in: contratos },
    periodo: { in: periodos },
    sentido: 'a_cobrar',
    tipo: { in: ['alquiler', 'iva'] },
    anuladoEn: null,
    claveGeneracion: { not: null },
  };
}

/**
 * Qué fracción de cada parte del mes ya pagó el inquilino (`parte#tipo` → 0
 * a 1). Las imputaciones tienen que venir filtradas con `IMPUTACION_ACTIVA`.
 */
export function fraccionesCobradas(
  filas: {
    tipo: string;
    importe: Prisma.Decimal | number;
    claveGeneracion: string | null;
    imputaciones: { importe: Prisma.Decimal | number }[];
  }[],
): Map<string, number> {
  const cobrado = new Map<string, number>();
  for (const k of filas) {
    const importe = Number(k.importe);
    const pagado = k.imputaciones.reduce((s, i) => s + Number(i.importe), 0);
    const fraccion = importe <= 0 ? 1 : Math.min(1, Math.max(0, pagado / importe));
    cobrado.set(`${parteDeClave(k.claveGeneracion)}#${k.tipo}`, fraccion);
  }
  return cobrado;
}
