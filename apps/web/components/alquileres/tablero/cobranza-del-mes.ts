import type { MonedaAlquiler, TableroAlquileresDto } from '@vacker/types';
import { fmtMoneda, fmtNum } from '../../../lib/format';
import { pct, suma } from './formatos';
import type { FilaDetalle } from './vistas';

type CobranzaDeUnaMoneda = TableroAlquileresDto['cobranza'][number];

/** 0: no pagó nada; 1: pagó una parte; 2: pagó todo. Es el orden de la lista. */
const situacion = (f: FilaDetalle) => ((f.falta ?? 0) <= 0 ? 2 : (f.cobrado ?? 0) > 0 ? 1 : 0);

/**
 * Regla 187: la lista de «Cobranza de {mes}», armada en el navegador con lo
 * que ya viaja con el tablero. Cada alquiler emitido (`importeEmitido`, cuyo
 * importe es el alquiler) con lo que se cobró de él (`importeCobrado`, cuyo
 * importe es lo cobrado hasta hoy): el id es el del concepto en las dos, y un
 * alquiler sin cobros no está en la segunda.
 *
 * Primero los que no pagaron nada, por vencimiento; después los que pagaron
 * una parte; al final los pagados. Entre iguales, el orden de la API.
 */
export function filasDeCobranza(cobranza: CobranzaDeUnaMoneda[]): FilaDetalle[] {
  const filas = cobranza.flatMap((c) => {
    const cobradoDe = new Map(c.importeCobrado.filas.map((f) => [f.id, f.importe ?? 0]));
    return c.importeEmitido.filas.map((f): FilaDetalle => {
      const alquiler = f.importe ?? 0;
      const cobrado = cobradoDe.get(f.id) ?? 0;
      const falta = Math.max(suma([alquiler, -cobrado]), 0);
      return {
        ...f,
        moneda: f.moneda ?? c.moneda,
        importe: alquiler,
        cobrado,
        falta,
        // Lo que pagó y lo que falta ya están en sus columnas.
        estado: cobrado > 0 && falta > 0 ? 'Pago parcial' : f.estado,
      };
    });
  });
  const vence = (f: FilaDetalle) => f.fecha ?? '9999-12-31';
  return filas.sort((a, b) => situacion(a) - situacion(b) || vence(a).localeCompare(vence(b)));
}

/**
 * Regla 187: la línea debajo del título, con los mismos números que la
 * tarjeta: «Cobrado $ 62.400.000,00 de $ 70.200.000,00 (89%) · 9 sin pagar».
 * Una por moneda; los dólares, después.
 */
export function resumenDeCobranza(filas: FilaDetalle[]) {
  const monedas = (['ARS', 'USD'] as MonedaAlquiler[]).filter((m) =>
    filas.some((f) => f.moneda === m),
  );
  return monedas
    .map((m, i) => {
      const de = filas.filter((f) => f.moneda === m);
      const emitido = suma(de.map((f) => f.importe ?? 0));
      const cobrado = suma(de.map((f) => f.cobrado ?? 0));
      const sinPagar = de.filter((f) => (f.falta ?? 0) > 0).length;
      const cuenta = `${fmtMoneda(cobrado, m)} de ${fmtMoneda(emitido, m)} (${pct(cobrado, emitido)}) · ${fmtNum(sinPagar)} sin pagar`;
      return i === 0 ? `Cobrado ${cuenta}` : `En dólares: ${cuenta}`;
    })
    .join(' — ');
}
