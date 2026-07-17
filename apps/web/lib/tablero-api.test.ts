import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAgregadosPorTrimestre,
  getKpisResumen,
  getRanking,
  getResumenPeriodo,
  listOperaciones,
  mergearRanking,
  mesesDelTrimestre,
  sumarAgregados,
} from './tablero-api';

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

});

describe('mesesDelTrimestre', () => {
  it('devuelve los 3 meses de cada trimestre', () => {
    expect(mesesDelTrimestre(1)).toEqual([1, 2, 3]);
    expect(mesesDelTrimestre(2)).toEqual([4, 5, 6]);
    expect(mesesDelTrimestre(4)).toEqual([10, 11, 12]);
  });
});

describe('sumarAgregados', () => {
  it('suma los campos y recalcula el ticket promedio', () => {
    const resultado = sumarAgregados([
      { volumen: 100, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 5, ticketPromedio: 100 },
      { volumen: 200, operaciones: 1, puntas: 1, puntasCompradoras: 1, puntasVendedoras: 0, comision: 10, ticketPromedio: 200 },
    ]);
    expect(resultado).toEqual({
      volumen: 300,
      operaciones: 2,
      puntas: 2,
      puntasCompradoras: 1,
      puntasVendedoras: 1,
      comision: 15,
      ticketPromedio: 150,
    });
  });

  it('no rompe con lista vacía', () => {
    expect(sumarAgregados([]).ticketPromedio).toBe(0);
  });
});

describe('mergearRanking', () => {
  it('suma por vendedor y recalcula ticket y peso', () => {
    const resultado = mergearRanking([
      [
        { usuarioId: 'a', nombre: 'Ana', volumen: 100, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, ticketPromedio: 100, comision: 5, peso: 1 },
        { usuarioId: 'b', nombre: 'Beto', volumen: 50, operaciones: 1, puntas: 1, puntasCompradoras: 1, puntasVendedoras: 0, ticketPromedio: 50, comision: 2, peso: 1 },
      ],
      [
        { usuarioId: 'a', nombre: 'Ana', volumen: 100, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, ticketPromedio: 100, comision: 5, peso: 1 },
      ],
    ]);

    expect(resultado).toHaveLength(2);
    const ana = resultado.find((r) => r.usuarioId === 'a')!;
    expect(ana.volumen).toBe(200);
    expect(ana.puntas).toBe(2);
    expect(ana.ticketPromedio).toBe(100);
    expect(ana.peso).toBeCloseTo(200 / 250);
    // Ordenado por volumen desc.
    expect(resultado[0]!.usuarioId).toBe('a');
  });
});

describe('getResumenPeriodo', () => {
  it('anual: pide resumen y ranking del año completo (sin mes)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL) => {
      const isRanking = String(url).includes('/ranking');
      return { ok: true, json: async () => (isRanking ? [] : RESUMEN) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'anual' });

    expect(resultado.agregado.volumen).toBe(100);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain('mes=');
    }
  });

  it('mensual: usa mesActual y filtra por el mes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string | URL) => {
        const isRanking = String(url).includes('/ranking');
        return {
          ok: true,
          json: async () => (isRanking ? [] : { ...RESUMEN, mesActual: { ...RESUMEN.anual, volumen: 7 } }),
        };
      }),
    );

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'mensual', mes: 3 });
    expect(resultado.agregado.volumen).toBe(7);
  });

  it('trimestral: pide los 3 meses y suma los agregados', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL) => {
      const isRanking = String(url).includes('/ranking');
      if (isRanking) return { ok: true, json: async () => [] };
      const mes = Number(new URL(url).searchParams.get('mes'));
      return { ok: true, json: async () => ({ ...RESUMEN, mesActual: { ...RESUMEN.anual, volumen: mes * 10 } }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'trimestral', trimestre: 1 });

    // Trimestre 1 = meses 1,2,3 -> volumen 10+20+30 = 60
    expect(resultado.agregado.volumen).toBe(60);
  });
});

describe('getAgregadosPorTrimestre', () => {
  it('pide los 12 meses una sola vez y devuelve el volumen sumado por trimestre', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL) => {
      const mes = Number(new URL(url).searchParams.get('mes'));
      return {
        ok: true,
        json: async () => ({ ...RESUMEN, mesActual: { ...RESUMEN.anual, volumen: mes * 10 } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const trimestres = await getAgregadosPorTrimestre('token', 2026);

    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(trimestres).toHaveLength(4);
    // Q1 = meses 1,2,3 -> 10+20+30 = 60
    expect(trimestres[0]!.volumen).toBe(60);
    // Q4 = meses 10,11,12 -> 100+110+120 = 330
    expect(trimestres[3]!.volumen).toBe(330);
  });
});
