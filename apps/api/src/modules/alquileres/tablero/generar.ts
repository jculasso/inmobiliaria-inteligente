import { Prisma } from '@prisma/client';
import type { Indicador } from '@vacker/types';
import { alquileresDelMes, mesLargo } from '@vacker/domain';
import { aParaGenerar, contratosQueGeneran } from '../conceptos.service';
import type { IndexacionesService } from '../indexaciones.service';
import { porCantidad } from './comun';
import type { ContratoLeido, Fichas } from './fichas';

/** Un alquiler del inquilino ya generado, con su clave (regla 10). */
export interface FilaGenerado {
  clave: string;
}

/**
 * Regla 181: las claves de los alquileres del inquilino ya generados en estos
 * meses, **con los anulados**: la generación no vuelve a crear lo que se
 * anuló (la anulación es una decisión, no un hueco), así que no falta. Va en
 * la sentencia única del tablero: una fila por contrato y mes, ninguna
 * consulta más.
 */
export function sqlAlquileresGenerados(meses: string[]) {
  return Prisma.sql`
    SELECT g.clave_generacion AS clave
      FROM alq_concepto g
     WHERE g.tipo = 'alquiler' AND g.sentido = 'a_cobrar'
       AND g.clave_generacion IS NOT NULL
       AND g.periodo = ANY(${meses}::text[])`;
}

/**
 * Regla 181: «Generar los alquileres de {mes}». Los contratos a los que
 * «Generar el período» les crearía un alquiler de ese mes que todavía no
 * existe, más los que tienen una parte del mes sin importe —esperan que se
 * confirme la indexación (regla 11) o se generan como parcial (regla 130)—,
 * que cuentan igual.
 *
 * Qué contratos y qué partes lo decide la generación, no esto: los mismos
 * contratos que lee (`contratosQueGeneran`), la misma conversión
 * (`aParaGenerar`) y `generarPeriodo` (`alquileresDelMes`). Todo sale de lo
 * que el tablero ya leyó.
 */
export function faltaGenerar(e: {
  contratos: ContratoLeido[];
  periodo: string;
  generados: ReadonlySet<string>;
  bandeja: Awaited<ReturnType<IndexacionesService['bandeja']>>;
  f: Fichas;
}): Indicador {
  const mes = mesLargo(`${e.periodo}-01`);
  const filas = contratosQueGeneran(e.contratos, e.periodo).flatMap((c) => {
    const faltan = alquileresDelMes(aParaGenerar(c), e.periodo).filter(
      (a) => !e.generados.has(a.clave),
    );
    if (faltan.length === 0) return [];
    const tramo = e.bandeja.tramos.find((t) => t.contrato.id === c.id);
    const estado = faltan.every((a) => a.listo)
      ? 'Sin generar'
      : tramo?.estado === 'pendiente_indice'
        ? `Espera ${tramo.falta.join(' y ') || 'el índice'}: se genera como parcial`
        : 'Falta confirmar la indexación';
    return [
      e.f.filaContrato(c, { id: `${c.id}|${e.periodo}`, detalle: `Alquiler de ${mes}`, estado }),
    ];
  });
  return porCantidad(filas);
}
