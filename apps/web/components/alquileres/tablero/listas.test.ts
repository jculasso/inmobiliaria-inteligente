import { describe, expect, it, vi } from 'vitest';
import type { Indicador } from '@vacker/types';
import { ANTICIPADAS_A_LA_VEZ, claveDeLista, crearListas, type Esperar } from './listas';
import type { Pedido } from './vistas';

const pedido = (over: Partial<Pedido> = {}): Pedido => ({
  indicador: 'ingresos',
  desde: '2026-01',
  hasta: '2026-12',
  tipo: 'todos',
  moneda: 'ARS',
  ...over,
});
const lista = (valor: number): Indicador => ({ valor, filas: [] });

/** Una promesa que se resuelve o se rechaza desde afuera. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

/** Un navegador que se libera cuando la prueba dice. */
function navegador() {
  const pendientes = new Map<number, () => void>();
  let siguiente = 0;
  const esperar: Esperar = (hacer) => {
    const id = ++siguiente;
    pendientes.set(id, hacer);
    return () => pendientes.delete(id);
  };
  const liberar = () => {
    const hacer = [...pendientes.values()];
    pendientes.clear();
    for (const h of hacer) h();
  };
  return { esperar, liberar, pendientes };
}

const promesasResueltas = () => new Promise((r) => setTimeout(r, 0));

describe('regla 189: una lista pedida no se vuelve a pedir', () => {
  it('regla 189: la clave lleva el indicador, el período, el tipo, la moneda y el tramo', () => {
    const base = claveDeLista(pedido());
    for (const otro of [
      pedido({ indicador: 'vigentes' }),
      pedido({ desde: '2026-02' }),
      pedido({ hasta: '2026-11' }),
      pedido({ tipo: 'vivienda' }),
      pedido({ moneda: 'USD' }),
      pedido({ indicador: 'mora', tramo: '31-60' }),
    ])
      expect(claveDeLista(otro), JSON.stringify(otro)).not.toBe(base);
    expect(claveDeLista(pedido({ indicador: 'mora', tramo: '31-60' }))).not.toBe(
      claveDeLista(pedido({ indicador: 'mora' })),
    );
    expect(claveDeLista({ ...pedido() })).toBe(base);
  });

  it('regla 189: la misma lista se pide una sola vez, y dos pedidos a la vez comparten el viaje', async () => {
    const traer = vi.fn().mockResolvedValue(lista(5));
    const listas = crearListas(traer);
    const [a, b] = await Promise.all([listas.pedir(pedido()), listas.pedir(pedido())]);
    expect(await listas.pedir(pedido())).toBe(a);
    expect(b).toBe(a);
    expect(traer).toHaveBeenCalledTimes(1);
    expect(listas.ya(pedido())).toBe(a);
    // Otro tipo es otra lista.
    await listas.pedir(pedido({ tipo: 'comercial' }));
    expect(traer).toHaveBeenCalledTimes(2);
  });

  it('regla 189: un pedido que falla no queda guardado: el siguiente lo reintenta', async () => {
    const traer = vi.fn().mockRejectedValueOnce(new Error('caída')).mockResolvedValue(lista(1));
    const listas = crearListas(traer);
    await expect(listas.pedir(pedido())).rejects.toThrow('caída');
    expect(listas.ya(pedido())).toBeUndefined();
    expect(await listas.pedir(pedido())).toEqual(lista(1));
    expect(traer).toHaveBeenCalledTimes(2);
  });
});

describe('regla 190: el pedido anticipado', () => {
  const cinco = (['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'] as const).map((mes) =>
    pedido({ desde: mes, hasta: mes }),
  );

  it('regla 190: no pide nada hasta que el navegador está libre, y después de a dos', async () => {
    const enCamino = cinco.map(() => diferida<Indicador>());
    let n = 0;
    const traer = vi.fn((_q: Pedido) => enCamino[n++]!.promesa);
    const { esperar, liberar } = navegador();
    crearListas(traer, esperar).anticipar(cinco);
    expect(traer).not.toHaveBeenCalled();

    liberar();
    expect(traer).toHaveBeenCalledTimes(ANTICIPADAS_A_LA_VEZ);
    // Liberarse otra vez no suma pedidos mientras los dos siguen en camino.
    liberar();
    expect(traer).toHaveBeenCalledTimes(2);

    // Cuando llega uno, sale el siguiente, también cuando el navegador está libre.
    enCamino[0]!.resolver(lista(0));
    await promesasResueltas();
    expect(traer).toHaveBeenCalledTimes(2);
    liberar();
    expect(traer).toHaveBeenCalledTimes(3);
    expect(traer.mock.calls.map(([q]) => q.desde)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('regla 190: lo que ya se pidió —o está repetido— no se pide de nuevo', async () => {
    const traer = vi.fn().mockResolvedValue(lista(0));
    const { esperar, liberar } = navegador();
    const listas = crearListas(traer, esperar);
    await listas.pedir(cinco[0]!);
    listas.anticipar([cinco[0]!, cinco[1]!, cinco[1]!]);
    liberar();
    await promesasResueltas();
    liberar();
    expect(traer.mock.calls.map(([q]) => q.desde)).toEqual(['2026-01', '2026-02']);
  });

  it('regla 190: cancelar descarta lo que todavía no salió; lo que ya salió llega y queda guardado', async () => {
    const enCamino = cinco.map(() => diferida<Indicador>());
    let n = 0;
    const traer = vi.fn((_q: Pedido) => enCamino[n++]!.promesa);
    const { esperar, liberar, pendientes } = navegador();
    const listas = crearListas(traer, esperar);
    const cancelar = listas.anticipar(cinco);
    liberar();
    expect(traer).toHaveBeenCalledTimes(2);
    cancelar();
    enCamino[0]!.resolver(lista(10));
    enCamino[1]!.resolver(lista(20));
    await promesasResueltas();
    liberar();
    expect(pendientes.size).toBe(0);
    expect(traer).toHaveBeenCalledTimes(2);
    expect(listas.ya(cinco[1]!)).toEqual(lista(20));
  });

  it('regla 190: cancelar antes de que el navegador se libere no pide nada', () => {
    const traer = vi.fn().mockResolvedValue(lista(0));
    const { esperar, liberar, pendientes } = navegador();
    crearListas(traer, esperar).anticipar(cinco)();
    expect(pendientes.size).toBe(0);
    liberar();
    expect(traer).not.toHaveBeenCalled();
  });

  it('regla 190: un anticipado que falla no rompe nada: al abrir la tarjeta se pide de nuevo', async () => {
    const traer = vi.fn().mockRejectedValueOnce(new Error('caída')).mockResolvedValue(lista(3));
    const { esperar, liberar } = navegador();
    const listas = crearListas(traer, esperar);
    listas.anticipar([cinco[0]!]);
    liberar();
    await promesasResueltas();
    expect(listas.ya(cinco[0]!)).toBeUndefined();
    expect(await listas.pedir(cinco[0]!)).toEqual(lista(3));
  });
});
