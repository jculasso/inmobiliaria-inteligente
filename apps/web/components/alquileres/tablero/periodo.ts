import type { FiltroTipoContrato, Indicador, TableroAlquileresDto } from '@vacker/types';
import { fmtFecha } from '../../../lib/format';
import { ABREV_MES, periodosTranscurridos } from '../../../lib/meses';
import {
  mesesDelPeriodo,
  nombreDelPeriodo,
  parametrosDelPeriodo,
  rangoDelPeriodo,
  type PeriodoTablero,
} from '../../../lib/periodo-tablero';
import { suma } from './formatos';
import type { Moneda } from './vistas';

/**
 * La dirección del tablero con su año, su tipo y su período: se puede
 * compartir o recargar y queda igual.
 */
export function direccion(
  pathname: string,
  hoy: string,
  anio: number,
  tipo: FiltroTipoContrato,
  periodo: PeriodoTablero,
) {
  const q = new URLSearchParams();
  if (anio !== Number(hoy.slice(0, 4))) q.set('anio', String(anio));
  if (tipo !== 'todos') q.set('tipo', tipo);
  for (const [k, v] of parametrosDelPeriodo(periodo, hoy, anio)) q.set(k, v);
  return `${pathname}${q.toString() ? `?${q}` : ''}`;
}

/**
 * Lo que la pantalla muestra del período elegido. Los flujos —alquileres,
 * ingresos, contratos nuevos— son la suma de sus meses (regla 75); las fotos
 * —cartera y deuda— son las del cierre de su último mes, o las de hoy si el
 * período llega a hoy (regla 77).
 */
export function delPeriodo(t: TableroAlquileresDto, periodo: PeriodoTablero) {
  const numeros = mesesDelPeriodo(periodo);
  const meses = numeros.map((m) => `${t.anio}-${String(m).padStart(2, '0')}`);
  const enPeriodo = (mes: string) => meses.includes(mes);

  const evolucion = t.evolucion.filter((e) => enPeriodo(e.mes));
  const cobranza = [...new Set(evolucion.map((e) => e.moneda))].sort().map((moneda) => {
    const es = evolucion.filter((e) => e.moneda === moneda);
    return {
      moneda,
      emitidos: suma(es.map((e) => e.emitidos)),
      cobrados: suma(es.map((e) => e.cobrados)),
      importeEmitido: suma(es.map((e) => e.emitido)),
      importeCobrado: suma(es.map((e) => e.cobradoHoy)),
      // Regla 76: se recalcula sobre los totales, nunca el promedio de los porcentajes.
      alCierre: suma(es.map((e) => e.cobrado)),
    };
  });

  const ingresosDe = (moneda: Moneda) => {
    const is = t.ingresos.filter((i) => enPeriodo(i.mes) && i.moneda === moneda);
    const partes = {
      honorarios: suma(is.map((i) => i.honorarios)),
      gastos: suma(is.map((i) => i.gastos)),
      punitorios: suma(is.map((i) => i.punitorios)),
      comisiones: suma(is.map((i) => i.comisiones ?? 0)),
    };
    return { moneda, ...partes, total: suma(Object.values(partes)) };
  };
  const ingresos = (['ARS', 'USD'] as const)
    .map(ingresosDe)
    .filter((i) => i.moneda === 'ARS' || i.total !== 0);

  const nuevosFilas = numeros.flatMap((m) => t.nuevos.porMes[m - 1]?.filas ?? []);
  const nuevos = {
    indicador: { valor: nuevosFilas.length, filas: nuevosFilas } satisfies Indicador,
    importe: suma(numeros.map((m) => t.nuevos.importePorMes[m - 1] ?? 0)),
    anterior: suma(numeros.map((m) => t.nuevos.anterior[m - 1] ?? 0)),
  };

  const cierre = t.cierres.find((c) => c.mes === meses.at(-1));
  // Sin cierres (la API todavía no los manda), lo de hoy.
  const aHoy = !cierre || cierre.cierre >= t.hoy;
  return {
    nombre: nombreDelPeriodo(periodo, t.anio),
    rango: rangoDelPeriodo(periodo, t.anio),
    cobranza,
    ingresos,
    nuevos,
    cierre,
    aHoy,
    alCierre: aHoy ? 'a hoy' : `al ${fmtFecha(cierre.cierre)}`,
  };
}
export type DelPeriodo = ReturnType<typeof delPeriodo>;

/** Doce meses, o los cuatro trimestres sumados. */
export function agrupados(porMes: number[], trimestral: boolean) {
  return trimestral ? [0, 1, 2, 3].map((q) => suma(porMes.slice(q * 3, q * 3 + 3))) : porMes;
}

/** Lo que tienen en común los dos gráficos: la escala del período y qué se marca. */
export function ejeDelPeriodo(t: TableroAlquileresDto, periodo: PeriodoTablero) {
  const trimestral = periodo.por === 'trimestre';
  return {
    trimestral,
    etiquetas: trimestral ? ['Q1', 'Q2', 'Q3', 'Q4'] : ABREV_MES,
    transcurridos: periodosTranscurridos(t.anio, trimestral ? 'trimestre' : 'mes'),
    // Con el año entero no se marca ningún mes: es todo el año (regla 80).
    seleccionado: periodo.por === 'mes' ? periodo.mes : periodo.por === 'trimestre' ? periodo.q : 0,
    pista: `tocá una barra o un ${trimestral ? 'trimestre' : 'mes'}`,
    porMesOTrimestre: trimestral ? 'trimestre' : 'mes',
    anchoMinimo: trimestral ? 'min-w-[34rem]' : 'min-w-[60rem]',
  };
}
