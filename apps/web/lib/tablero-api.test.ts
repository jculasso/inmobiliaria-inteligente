import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEvolucionAnual, getKpisResumen, getRanking, listOperaciones } from './tablero-api';

const RESUMEN = {
  anio: 2026,
  anual: {
    volumen: 100,
    operaciones: 2,
    puntas: 2,
    puntasCompradoras: 1,
    puntasVendedoras: 1,
    comision: 10,
    ticketPromedio: 50,
  },
  pendienteCobro: 0,
  operacionesSenadas: 0,
  alquileres: { firmados: 0, comision: 0, valorMensualPromedio: 0 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tablero-api', () => {
  it('listOperaciones pide /tablero/operaciones con los filtros como query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await listOperaciones('token', { anio: 2026, tipo: 'venta' });

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/operaciones?anio=2026&tipo=venta');
  });

  it('getKpisResumen valida y devuelve el resumen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => RESUMEN }));
    const result = await getKpisResumen('token', { anio: 2026 });
    expect(result.anual.volumen).toBe(100);
  });

  it('getRanking pide /tablero/kpis/ranking', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getRanking('token', { anio: 2026, mes: 3 });

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/kpis/ranking?anio=2026&mes=3');
  });

  it('getEvolucionAnual pide los 12 meses del año y devuelve el volumen de cada uno', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL) => ({
      ok: true,
      json: async () => ({
        ...RESUMEN,
        mesActual: { ...RESUMEN.anual, volumen: Number(new URL(url).searchParams.get('mes')) * 100 },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const evolucion = await getEvolucionAnual('token', 2026);

    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(evolucion).toHaveLength(12);
    expect(evolucion[0]).toEqual({ mes: 1, volumen: 100 });
    expect(evolucion[11]).toEqual({ mes: 12, volumen: 1200 });
  });
});
