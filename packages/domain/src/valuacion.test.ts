import { describe, expect, it } from 'vitest';
import { analizarComparables, valuationSurface, type ComparableCalc, type PropiedadCalc } from './valuacion';

const propiedad: PropiedadCalc = {
  tipoPropiedad: 'Departamento',
  supCubierta: 78,
  supSemi: 7,
  supDescubierta: 0,
  dormitorios: 2,
  banos: 2,
  estado: 'Muy bueno',
  cochera: 1,
};

function comp(over: Partial<ComparableCalc>): ComparableCalc {
  return {
    tipoComp: 'Departamento',
    supCubierta: 80,
    supSemi: 0,
    supDescubierta: 0,
    precio: 125000,
    dormitorios: 2,
    banos: 1,
    estado: 'Bueno',
    cocheraComp: 'No',
    fuente: 'Publicación',
    tipoPrecio: 'Publicado',
    fechaReferencia: null,
    ...over,
  };
}

describe('valuationSurface', () => {
  it('pondera descubierta al 30% (cubierta + semi + desc×0.3)', () => {
    expect(valuationSurface({ supCubierta: 78, supSemi: 7, supDescubierta: 10 }, 'Departamento')).toBe(88);
  });
  it('Terreno usa la superficie de terreno', () => {
    expect(valuationSurface({ supCubierta: 0, supTerreno: 300 }, 'Terreno')).toBe(300);
  });
  it('cae al valor legacy si no hay desglose', () => {
    expect(valuationSurface({ superficie: 50 }, 'Departamento')).toBe(50);
  });
});

describe('analizarComparables', () => {
  it('sin comparables válidos devuelve todo en cero y confianza Baja', () => {
    const r = analizarComparables([], propiedad);
    expect(r.count).toBe(0);
    expect(r.weightedUsdPerM2).toBe(0);
    expect(r.confidence).toBe('Baja');
  });

  it('descarta comparables sin precio o sin superficie del cálculo', () => {
    const r = analizarComparables([comp({ precio: 0 }), comp({ supCubierta: 0, superficie: 0 })], propiedad);
    expect(r.count).toBe(0);
  });

  it('calcula count, min/max/promedio y USD/m² sobre los válidos', () => {
    const r = analizarComparables(
      [comp({ precio: 125000, supCubierta: 80 }), comp({ precio: 100000, supCubierta: 80 }), comp({ precio: 150000, supCubierta: 100 })],
      propiedad,
    );
    expect(r.count).toBe(3);
    expect(r.minPrice).toBe(100000);
    expect(r.maxPrice).toBe(150000);
    expect(r.avgPrice).toBe(125000);
    // USD/m²: 1562.5, 1250, 1500 → promedio ~1437.5
    expect(Math.round(r.avgUsdPerM2)).toBe(1438);
    expect(r.weightedUsdPerM2).toBeGreaterThan(0);
  });

  it('un cierre real sube la confianza (bonus +8) y pondera más (×1.25)', () => {
    const sinCierre = analizarComparables(
      [comp({ precio: 120000 }), comp({ precio: 125000 }), comp({ precio: 130000 })],
      propiedad,
    );
    const conCierre = analizarComparables(
      [comp({ precio: 120000, fuente: 'Cierre real' }), comp({ precio: 125000 }), comp({ precio: 130000 })],
      propiedad,
    );
    expect(conCierre.confidenceScore).toBeGreaterThan(sinCierre.confidenceScore);
  });

  it('más comparables similares y poco dispersos → confianza Alta', () => {
    const r = analizarComparables(
      [
        comp({ precio: 124000, dormitorios: 2, banos: 2, estado: 'Muy bueno', fuente: 'Cierre real' }),
        comp({ precio: 125000, dormitorios: 2, banos: 2, estado: 'Muy bueno' }),
        comp({ precio: 126000, dormitorios: 2, banos: 2, estado: 'Muy bueno' }),
        comp({ precio: 125500, dormitorios: 2, banos: 2, estado: 'Muy bueno' }),
        comp({ precio: 124500, dormitorios: 2, banos: 2, estado: 'Muy bueno' }),
      ],
      propiedad,
    );
    expect(r.confidence).toBe('Alta');
  });
});
