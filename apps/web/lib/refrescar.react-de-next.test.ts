import { describe, expect, it, vi } from 'vitest';

/**
 * `useRefrescar` sobre el React que de verdad corre en el navegador: el que
 * Next trae adentro (`next/dist/compiled/react`), no el de `node_modules`.
 *
 * Por qué existe: en ese React (19.2 canary, Next 15.5) un aviso de «ya
 * llegó» que entra mientras React está renderizando se perdía (el `TODO` de
 * `pingSuspendedRoot`). Con el refresh pasa así: la página nueva viene del
 * servidor en pedazos (Flight); React lee un pedazo que todavía no llegó,
 * suspende y suelta el hilo; en ese hueco llega; al retomar, React engancha el
 * aviso y el pedazo —que ya está— lo llama en el acto, dentro del render. Ese
 * aviso se tiraba, nadie más avisaba, y la transición quedaba pendiente para
 * siempre: el modal en «Guardando…» y la pantalla vieja. En el navegador
 * pasaba en ~1 de cada 10 guardados contra el simulador (15/10/2026).
 *
 * Lo arregla `patches/next@15.5.20.patch`, que copia el arreglo de React 19.3
 * (y del React de Next 16). Si esta prueba se pone roja después de tocar la
 * versión de Next, el arreglo se perdió.
 */
// @ts-expect-error -- el React de Next no trae tipos; acá solo se reemplaza el módulo.
vi.mock('react', () => import('next/dist/compiled/react'));

let refrescarPagina: () => void = () => {};
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refrescarPagina() }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require('next/dist/compiled/react');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require('next/dist/compiled/react-dom/client');
import { useRefrescar } from './refrescar';

const h = React.createElement;

/**
 * Un pedazo de la respuesta, con las reglas de un chunk de Flight: si ya llegó
 * pero nadie lo leyó, `then` lo inicializa y llama en el acto (no en otra
 * vuelta, como una Promise).
 */
function pedazo() {
  let avisar: ((v: unknown) => void)[] | null = null;
  let llegado: unknown;
  const c = {
    status: 'pending' as 'pending' | 'resolved_model' | 'fulfilled',
    value: null as unknown,
    then(resolver?: (v: unknown) => void) {
      if (c.status === 'resolved_model') Object.assign(c, { status: 'fulfilled', value: llegado });
      if (c.status === 'fulfilled') resolver?.(c.value);
      else if (resolver) (avisar ??= []).push(resolver);
    },
    llega(v: unknown) {
      llegado = v;
      c.status = 'resolved_model';
      if (avisar) {
        Object.assign(c, { status: 'fulfilled', value: v });
        avisar.forEach((f) => f(v));
        avisar = null;
      }
    },
  };
  return c;
}

/** Un elemento que viene en ese pedazo, como lo arma Flight (`React.lazy` con el chunk). */
function enElPedazo(c: ReturnType<typeof pedazo>, alSuspender: () => void) {
  return {
    $$typeof: Symbol.for('react.lazy'),
    _payload: c,
    _init: (p: typeof c) => {
      p.then();
      if (p.status === 'fulfilled') return p.value;
      alSuspender();
      throw p;
    },
  };
}

describe('useRefrescar con el React de Next', () => {
  it('se cumple aunque la página nueva llegue mientras React renderiza', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    let cerrado = false;
    let refrescar: () => Promise<void> = async () => {};

    function Banco() {
      const [pagina, setPagina] = React.useState(h('p', null, 'viejo'));
      ({ refrescar } = useRefrescar());
      refrescarPagina = () => {
        const llegada = pedazo();
        let primera = true;
        // Llega justo en el hueco en que React soltó el hilo tras suspender.
        const alSuspender = () => {
          if (primera) queueMicrotask(() => llegada.llega(h('p', null, 'nuevo')));
          primera = false;
        };
        setPagina(h('div', null, enElPedazo(llegada, alSuspender)));
      };
      return h(React.Suspense, { fallback: h('p', null, 'cargando') }, pagina);
    }

    const div = document.createElement('div');
    createRoot(div).render(h(Banco));
    await vi.waitFor(() => expect(div.textContent).toBe('viejo'));

    void refrescar().then(() => (cerrado = true));

    await vi.waitFor(() => expect(div.textContent).toBe('nuevo'), { timeout: 2000 });
    await vi.waitFor(() => expect(cerrado).toBe(true));
  });
});
