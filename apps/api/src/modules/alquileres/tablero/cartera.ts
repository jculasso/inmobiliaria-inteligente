import {
  NOMBRE_ESTADO_CONTRATO,
  type CierreTablero,
  type EstadoContrato,
  type MonedaAlquiler,
  type TableroAlquileresDto,
} from '@vacker/types';
import { alquilerDeHoy, cierreDelMes, redondear2 } from '@vacker/domain';
import { decToNum, fromDate } from '../../tablero/tablero.util';
import { mesesDe, porCantidad, porImporte, sumar } from './comun';
import { tramosDe, type ContratoLeido, type Fichas } from './fichas';
import { moraDelCierre, type FilaMora } from './morosidad';

/**
 * Regla 77: si un contrato estaba vigente a una fecha. A hoy (o después) es su
 * estado, como siempre. Antes, por fechas: había empezado y no había
 * terminado —el fin, o la rescisión—. Uno que hoy sigue vigente lo estaba
 * desde que empezó, aunque ya haya pasado su fin y nadie lo haya finalizado:
 * así no aparece hoy y faltaba el mes pasado.
 */
export function vigenteAl(
  c: Pick<ContratoLeido, 'estado' | 'inicio' | 'fin' | 'rescindidoEl'>,
  fecha: string,
  hoy: string,
): boolean {
  if (fecha >= hoy) return c.estado === 'vigente';
  if (fromDate(c.inicio)! > fecha) return false;
  if (c.estado === 'vigente') return true;
  if (c.estado !== 'finalizado' && c.estado !== 'rescindido') return false;
  return fecha <= fromDate(c.rescindidoEl ?? c.fin)!;
}

/**
 * Regla 27 y 77: la cartera a una fecha —los vigentes y el alquiler de cada
 * uno ese día, por moneda—. La tarjeta, su lista y la foto de cada cierre
 * salen de acá.
 */
export function carteraAl(contratos: ContratoLeido[], fecha: string, hoy: string) {
  const vigentes = contratos.filter((c) => vigenteAl(c, fecha, hoy));
  const alquiler = (c: ContratoLeido) => alquilerDeHoy(tramosDe(c), fecha);
  const monedas = [...new Set(vigentes.map((c) => c.moneda))].sort() as MonedaAlquiler[];
  return {
    vigentes,
    alquilerMensual: monedas.map((moneda) => ({
      moneda,
      contratos: vigentes
        .filter((c) => c.moneda === moneda && alquiler(c) != null)
        .map((c) => ({ c, importe: alquiler(c)! })),
    })),
  };
}
type Cartera = ReturnType<typeof carteraAl>;

/**
 * La cartera a hoy (regla 27), con sus listas. El reparto por tipo es
 * siempre de todos (punto 8): mira `todos`, no el corte.
 */
export function carteraDelTablero(
  todos: ContratoLeido[],
  cartera: Cartera,
  f: Fichas,
): TableroAlquileresDto['cartera'] {
  const { filaContrato, importeDeHoy } = f;
  const vigentes = cartera.vigentes;

  // --- Reparto de la cartera por tipo, siempre de todos (punto 8) ---
  const vigentesTodos = todos.filter((c) => c.estado === 'vigente');
  const pesosDe = (xs: typeof todos) =>
    redondear2(
      xs.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + (importeDeHoy(c) ?? 0), 0),
    );
  const totalPesos = pesosDe(vigentesTodos);
  const porTipo = (['vivienda', 'comercial'] as const).map((t) => {
    const xs = vigentesTodos.filter((c) => c.tipo === t);
    const importe = pesosDe(xs);
    return {
      tipo: t,
      cantidad: xs.length,
      importe,
      pct: totalPesos > 0 ? Math.round((importe / totalPesos) * 1000) / 10 : 0,
    };
  });

  return {
    porTipo,
    vigentes: porCantidad(vigentes.map((c) => filaContrato(c))),
    vivienda: vigentes.filter((c) => c.tipo === 'vivienda').length,
    comercial: vigentes.filter((c) => c.tipo === 'comercial').length,
    alquilerMensual: cartera.alquilerMensual.map((a) => ({
      moneda: a.moneda,
      indicador: porImporte(a.contratos.map(({ c, importe }) => filaContrato(c, { importe }))),
    })),
  };
}

/** La foto de cada cierre del año (regla 77): la cartera y la deuda de ese día. */
export function cierresDelAnio(
  contratos: ContratoLeido[],
  mora: FilaMora[],
  meses: string[],
  hoy: string,
  f: Fichas,
): CierreTablero[] {
  return meses.map((m) => {
    const cierre = cierreDelMes(m, hoy);
    const c = carteraAl(contratos, cierre, hoy);
    return {
      mes: m,
      cierre,
      vigentes: c.vigentes.length,
      vivienda: c.vigentes.filter((x) => x.tipo === 'vivienda').length,
      comercial: c.vigentes.filter((x) => x.tipo === 'comercial').length,
      alquilerMensual: c.alquilerMensual.map((a) => ({
        moneda: a.moneda,
        valor: sumar(a.contratos.map((x) => x.importe)),
        contratos: a.contratos.length,
      })),
      mora: moraDelCierre(mora, cierre, f),
    };
  });
}

/** Contratos nuevos (punto 8): los que empiezan en cada mes. */
export function contratosNuevos(
  contratos: ContratoLeido[],
  meses: string[],
  anio: number,
  f: Fichas,
): TableroAlquileresDto['nuevos'] {
  const empiezaEn = (c: ContratoLeido) => fromDate(c.inicio)!.slice(0, 7);
  const importeInicial = (c: ContratoLeido) =>
    c.tramos[0]?.importe != null ? decToNum(c.tramos[0].importe) : 0;
  const nuevosDe = (m: string) => contratos.filter((c) => empiezaEn(c) === m);
  return {
    porMes: meses.map((m) =>
      porCantidad(
        nuevosDe(m).map((c) =>
          f.filaContrato(c, {
            fecha: fromDate(c.inicio),
            importe: importeInicial(c),
            estado: NOMBRE_ESTADO_CONTRATO[c.estado as EstadoContrato] ?? c.estado,
          }),
        ),
      ),
    ),
    importePorMes: meses.map((m) =>
      redondear2(
        nuevosDe(m)
          .filter((c) => c.moneda === 'ARS')
          .reduce((s, c) => s + importeInicial(c), 0),
      ),
    ),
    anterior: mesesDe(anio - 1).map((m) => nuevosDe(m).length),
  };
}
