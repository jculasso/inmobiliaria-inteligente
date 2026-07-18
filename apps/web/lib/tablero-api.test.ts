import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAgregadosPorTrimestre,
  getKpisMensual,
  getKpisResumen,
  getResumenPeriodo,
  listOperaciones,
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

describe('getResumenPeriodo', () => {
  it('anual: pide /tablero/kpis/rango con mesInicio=1 y mesFin=12 en una sola llamada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agregado: RESUMEN.anual, ranking: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'anual' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado.agregado.volumen).toBe(100);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/kpis/rango?anio=2026&mesInicio=1&mesFin=12');
  });

  it('mensual: pide /tablero/kpis/rango con mesInicio=mesFin=mes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agregado: { ...RESUMEN.anual, volumen: 7 }, ranking: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'mensual', mes: 3 });

    expect(resultado.agregado.volumen).toBe(7);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/kpis/rango?anio=2026&mesInicio=3&mesFin=3');
  });

  it('trimestral: pide /tablero/kpis/rango con el rango de los 3 meses del trimestre', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agregado: { ...RESUMEN.anual, volumen: 60 }, ranking: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await getResumenPeriodo('token', { anio: 2026, periodo: 'trimestral', trimestre: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado.agregado.volumen).toBe(60);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/kpis/rango?anio=2026&mesInicio=1&mesFin=3');
  });
});

describe('getKpisMensual', () => {
  it('pide /tablero/kpis/mensual con el año', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await getKpisMensual('token', 2026);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/kpis/mensual?anio=2026');
  });
});

describe('getAgregadosPorTrimestre', () => {
  it('pide los 12 meses en una sola llamada y devuelve el volumen sumado por trimestre', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        Array.from({ length: 12 }, (_, i) => ({ ...RESUMEN.anual, volumen: (i + 1) * 10 })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const trimestres = await getAgregadosPorTrimestre('token', 2026);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(trimestres).toHaveLength(4);
    // Q1 = meses 1,2,3 -> 10+20+30 = 60
    expect(trimestres[0]!.volumen).toBe(60);
    // Q4 = meses 10,11,12 -> 100+110+120 = 330
    expect(trimestres[3]!.volumen).toBe(330);
  });
});
