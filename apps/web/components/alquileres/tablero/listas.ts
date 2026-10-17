import type {
  FiltroTipoContrato,
  Indicador,
  IndicadorDetalleTablero,
  MonedaAlquiler,
  TableroAlquileresDto,
  TramoMora,
} from '@vacker/types';
import type { PeriodoTablero } from '../../../lib/periodo-tablero';
import { delPeriodo, ingresosDelMes } from './periodo';
import type { Pedido } from './vistas';

/**
 * Regla 189: la clave de una lista pedida. Lleva todo lo que cambia la
 * lista —también el tipo y la moneda—: dos tarjetas que piden lo mismo
 * comparten la lista, y dos que no, nunca.
 */
export function claveDeLista(q: Pedido) {
  return [q.indicador, q.desde, q.hasta, q.tipo, q.moneda, q.tramo ?? ''].join('|');
}

/** Programa `hacer` para cuando el navegador esté libre; devuelve cómo cancelarlo. */
export type Esperar = (hacer: () => void) => () => void;

/**
 * Regla 190: cuando el navegador está libre, para no competir con la carga de
 * la página. Safari no tiene `requestIdleCallback`: ahí, un instante después.
 */
export const cuandoEsteLibre: Esperar = (hacer) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(hacer, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(hacer, 150);
  return () => window.clearTimeout(id);
};

/** Regla 190: de a cuántas listas se piden en segundo plano. */
export const ANTICIPADAS_A_LA_VEZ = 2;

/**
 * La memoria de las listas que se piden (reglas 189 y 190). Vive mientras la
 * pantalla está abierta —el Dashboard la crea de nuevo con cada tablero—, así
 * que se borra al recargar y no se cruza entre usuarios ni inmobiliarias.
 *
 * Guarda la PROMESA, no solo la lista: si se toca una tarjeta mientras su
 * lista se está pidiendo en segundo plano, el modal espera ese mismo pedido.
 */
export function crearListas(traer: (q: Pedido) => Promise<Indicador>, esperar = cuandoEsteLibre) {
  const pedidas = new Map<string, Promise<Indicador>>();
  const llegadas = new Map<string, Indicador>();

  /** La lista de un pedido: la que ya está, la que viene en camino, o una nueva. */
  const pedir = (q: Pedido): Promise<Indicador> => {
    const clave = claveDeLista(q);
    const enCamino = pedidas.get(clave);
    if (enCamino) return enCamino;
    const nueva = traer(q).then(
      (ind) => {
        llegadas.set(clave, ind);
        return ind;
      },
      (error: unknown) => {
        // Un pedido que falla no queda guardado: abrir otra vez lo reintenta.
        pedidas.delete(clave);
        throw error;
      },
    );
    pedidas.set(clave, nueva);
    return nueva;
  };

  /** La lista, si ya llegó: así el modal la muestra en el primer cuadro, sin pasar por «Cargando». */
  const ya = (q: Pedido) => llegadas.get(claveDeLista(q));

  /**
   * Pide en segundo plano las que todavía no se pidieron, de a dos y cuando
   * el navegador está libre. Devuelve cómo cancelarlo: las que todavía no
   * salieron se descartan; las que ya salieron terminan y quedan guardadas.
   */
  const anticipar = (qs: Pedido[]) => {
    const cola = [...new Map(qs.map((q) => [claveDeLista(q), q])).values()];
    let vigente = true;
    let enCurso = 0;
    // Cancelar una espera que ya se cumplió no hace nada: alcanza con juntarlas.
    const esperas: (() => void)[] = [];
    const tanda = () => {
      while (vigente && enCurso < ANTICIPADAS_A_LA_VEZ && cola.length > 0) {
        const q = cola.shift()!;
        if (pedidas.has(claveDeLista(q))) continue;
        enCurso++;
        pedir(q)
          // Si falla, la tarjeta la vuelve a pedir al abrirla y ahí se ve el error.
          .catch(() => undefined)
          .finally(() => {
            enCurso--;
            programar();
          });
      }
    };
    const programar = () => {
      if (vigente && cola.length > 0) esperas.push(esperar(tanda));
    };
    programar();
    return () => {
      vigente = false;
      for (const cancelar of esperas.splice(0)) cancelar();
    };
  };

  return { pedir, ya, anticipar };
}
export type Listas = ReturnType<typeof crearListas>;

/** Un flujo del mes en curso, de toda la cartera: lo de «Hoy» (regla 177). */
export function pedidoDelMes(
  todos: TableroAlquileresDto,
  indicador: IndicadorDetalleTablero,
  moneda: MonedaAlquiler,
): Pedido {
  return { indicador, desde: todos.mes, hasta: todos.mes, tipo: 'todos', moneda };
}

/** Un número del período de «Cómo vamos», con el tipo elegido (regla 182). */
export function pedidoDelPeriodo(
  rango: { desde: string; hasta: string },
  tipo: FiltroTipoContrato,
  indicador: IndicadorDetalleTablero,
  moneda: MonedaAlquiler,
  tramo?: TramoMora,
): Pedido {
  return { indicador, ...rango, tipo, moneda, ...(tramo ? { tramo } : {}) };
}

/**
 * Regla 190: las listas de las tarjetas que están a la vista y piden la suya
 * al abrirla, en el orden de la pantalla. Cada condición es la de la tarjeta:
 * si una tarjeta no se abre (un total en cero), su lista no se pide.
 */
export function pedidosALaVista(
  todos: TableroAlquileresDto,
  t: TableroAlquileresDto,
  tipo: FiltroTipoContrato,
  periodo: PeriodoTablero,
): Pedido[] {
  const hoy = ingresosDelMes(todos);
  const p = delPeriodo(t, periodo);
  const delPeriodoDe = (indicador: IndicadorDetalleTablero, moneda: MonedaAlquiler) =>
    pedidoDelPeriodo(p.rango, tipo, indicador, moneda);
  const ingresosArs = p.ingresos.find((i) => i.moneda === 'ARS');
  const ingresosUsd = p.ingresos.find((i) => i.moneda === 'USD');
  return [
    // «Hoy»: Ingresos de {mes}, y su línea en dólares.
    ...(hoy.ARS.total ? [pedidoDelMes(todos, 'ingresos', 'ARS')] : []),
    ...(hoy.USD.total ? [pedidoDelMes(todos, 'ingresos', 'USD')] : []),
    // «Cómo vamos»: Ingresos del período, y la cartera si el período ya cerró.
    ...(ingresosArs?.total ? [delPeriodoDe('ingresos', 'ARS')] : []),
    ...(ingresosUsd ? [delPeriodoDe('ingresos', 'USD')] : []),
    ...(p.aHoy ? [] : [delPeriodoDe('vigentes', 'ARS')]),
  ];
}
