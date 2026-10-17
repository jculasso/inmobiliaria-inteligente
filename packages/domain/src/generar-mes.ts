// Generar el mes (spec alquileres-fase-1.md, regla 181): qué alquileres crea
// «Generar el período» para un contrato, para que el Dashboard avise cuáles
// faltan sin escribir una segunda definición que se termine separando.

import { generarPeriodo, type ContratoParaGenerar } from './alquileres';

/** Un alquiler del inquilino que la generación del mes crea para un contrato. */
export interface AlquilerDelMes {
  /** La clave que evita duplicar (regla 10): la misma que guarda la generación. */
  clave: string;
  /**
   * `true` si la generación lo crea ya. `false` si su tramo no tiene importe:
   * espera que se confirme la indexación (regla 11) o se genera como parcial
   * con el importe anterior (regla 130). Falta generarlo igual.
   */
  listo: boolean;
}

/**
 * Regla 181: los alquileres del inquilino que «Generar el período» crea para
 * un contrato en un mes —uno por parte del mes: dos si cambia el tramo—, con
 * su clave.
 *
 * No reescribe la generación: es `generarPeriodo` dos veces, con los tramos
 * como están y con los que no tienen importe rellenados, que es lo que hace
 * `generarPeriodoConParciales` con el importe provisorio. La clave no depende
 * del importe, así que es la que guardaría la generación con el importe que
 * sea. «Administrado desde» (regla 104), la rescisión (regla 3), el contrato
 * que empieza o termina en el mes y el que no tiene inquilino o propietario
 * quedan decididos por `generarPeriodo`, igual que al generar.
 */
export function alquileresDelMes(c: ContratoParaGenerar, periodo: string): AlquilerDelMes[] {
  const delInquilino = (r: ReturnType<typeof generarPeriodo>) =>
    r.conceptos.filter((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar');
  // El IVA de la inmobiliaria no cambia qué alquileres se generan: solo los cargos.
  const listos = new Set(delInquilino(generarPeriodo(c, periodo, 0)).map((k) => k.clave));
  const relleno: ContratoParaGenerar = {
    ...c,
    tramos: c.tramos.map((t) => (t.importe == null ? { ...t, importe: 1 } : t)),
  };
  return delInquilino(generarPeriodo(relleno, periodo, 0)).map((k) => ({
    clave: k.clave,
    listo: listos.has(k.clave),
  }));
}
