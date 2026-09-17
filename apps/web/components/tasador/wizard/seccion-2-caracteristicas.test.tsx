import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TipoPropiedad } from '@vacker/types';
import { Seccion2Caracteristicas } from './seccion-2-caracteristicas';

/**
 * La ficha del inmueble, que hasta septiembre de 2026 pedía los mismos treinta
 * y pico de controles para todo: a un lote le preguntaba dormitorios, baños,
 * antigüedad y si tenía vestidor.
 */
function montar(over: Record<string, unknown> = {}) {
  const props = {
    tipoPropiedad: 'Departamento' as TipoPropiedad,
    setTipoPropiedad: vi.fn(),
    supCubierta: '',
    setSupCubierta: vi.fn(),
    supSemicubierta: '',
    setSupSemicubierta: vi.fn(),
    supDescubierta: '',
    setSupDescubierta: vi.fn(),
    supTerreno: '',
    setSupTerreno: vi.fn(),
    superficieTotalPreview: 0,
    coeficientes: { semicubierta: 1, descubierta: 0.3 },
    dormitorios: '',
    setDormitorios: vi.fn(),
    banos: '',
    setBanos: vi.fn(),
    toilette: '',
    setToilette: vi.fn(),
    ambientes: '',
    setAmbientes: vi.fn(),
    antiguedad: '',
    setAntiguedad: vi.fn(),
    disposicion: '' as const,
    setDisposicion: vi.fn(),
    orientacion: '' as const,
    setOrientacion: vi.fn(),
    estadoInmueble: '' as const,
    setEstadoInmueble: vi.fn(),
    cochera: false,
    setCochera: vi.fn(),
    balcon: false,
    setBalcon: vi.fn(),
    terraza: false,
    setTerraza: vi.fn(),
    patio: false,
    setPatio: vi.fn(),
    lavadero: false,
    setLavadero: vi.fn(),
    piscina: false,
    setPiscina: vi.fn(),
    altillo: false,
    setAltillo: vi.fn(),
    baulera: false,
    setBaulera: vi.fn(),
    biblioteca: false,
    setBiblioteca: vi.fn(),
    escritorio: false,
    setEscritorio: vi.fn(),
    jardin: false,
    setJardin: vi.fn(),
    vestidor: false,
    setVestidor: vi.fn(),
    servicios: [] as string[],
    setServicios: vi.fn(),
    tieneAmenities: false,
    setTieneAmenities: vi.fn(),
    amenities: [] as string[],
    setAmenities: vi.fn(),
    detalleAmenities: '',
    setDetalleAmenities: vi.fn(),
    expensas: '',
    setExpensas: vi.fn(),
    aptoCredito: '' as const,
    setAptoCredito: vi.fn(),
    documentacion: '' as const,
    setDocumentacion: vi.fn(),
    tasacionId: null,
    fotos: [],
    setFotos: vi.fn(),
    ...over,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { container } = render(<Seccion2Caracteristicas {...(props as any)} />);
  return container;
}

/**
 * Las etiquetas de campo visibles.
 *
 * `legend` además de `label` y `span`: los títulos de «Características»,
 * «Servicios» y «Amenities» son la leyenda de un `fieldset`, no un label. Sin
 * eso el test decía que la grilla no estaba cuando sí estaba.
 */
function campos(container: HTMLElement): string[] {
  return [...container.querySelectorAll('label, span, legend')]
    .map((e) => e.textContent?.trim() ?? '')
    .filter(Boolean);
}
const hay = (container: HTMLElement, texto: string) => campos(container).includes(texto);

describe('ficha — no se le pide al inmueble lo que no tiene', () => {
  it('a un terreno no le pide dormitorios, antigüedad ni estado', () => {
    const c = montar({ tipoPropiedad: 'Terreno' });
    expect(hay(c, 'Dormitorios')).toBe(false);
    expect(hay(c, 'Baños')).toBe(false);
    expect(hay(c, 'Antigüedad (años)')).toBe(false);
    expect(hay(c, 'Estado del inmueble')).toBe(false);
    expect(hay(c, 'Características')).toBe(false);
    // Lo que sí le corresponde.
    expect(hay(c, 'Sup. terreno (m²)')).toBe(true);
    expect(hay(c, 'Servicios')).toBe(true);
  });

  it('a una cochera no le pide servicios ni características', () => {
    const c = montar({ tipoPropiedad: 'Cochera' });
    expect(hay(c, 'Servicios')).toBe(false);
    expect(hay(c, 'Características')).toBe(false);
    expect(hay(c, 'Dormitorios')).toBe(false);
    expect(hay(c, 'Sup. cubierta (m²)')).toBe(true);
  });

  it('a un galpón le pide baños pero no dormitorios ni amenities', () => {
    const c = montar({ tipoPropiedad: 'Galpón' });
    expect(hay(c, 'Baños')).toBe(true);
    expect(hay(c, 'Dormitorios')).toBe(false);
    expect(hay(c, '¿Tiene amenities?')).toBe(false);
  });

  it('a un departamento no le pide superficie de terreno, a una casa sí', () => {
    expect(hay(montar({ tipoPropiedad: 'Departamento' }), 'Sup. terreno (m²)')).toBe(false);
    expect(hay(montar({ tipoPropiedad: 'Casa' }), 'Sup. terreno (m²)')).toBe(true);
  });

  it('una casa sigue viendo la ficha entera', () => {
    const c = montar({ tipoPropiedad: 'Casa' });
    for (const campo of ['Dormitorios', 'Baños', 'Ambientes', 'Antigüedad (años)', 'Estado del inmueble', 'Servicios']) {
      expect(hay(c, campo)).toBe(true);
    }
  });
});

/**
 * Lo más importante del cambio. La ficha son COLUMNAS de la base, no etiquetas
 * sueltas: si al cambiar el tipo de propiedad un campo cargado desaparece de la
 * pantalla, al guardar se pierde el dato sin que nadie lo haya decidido.
 */
describe('ficha — cambiar el tipo no esconde lo que ya estaba cargado', () => {
  it('un terreno con dormitorios cargados los sigue mostrando', () => {
    const c = montar({ tipoPropiedad: 'Terreno', dormitorios: '3' });
    expect(hay(c, 'Dormitorios')).toBe(true);
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('una cochera con servicios cargados los sigue mostrando', () => {
    const c = montar({ tipoPropiedad: 'Cochera', servicios: ['Agua corriente'] });
    expect(hay(c, 'Servicios')).toBe(true);
  });

  it('un terreno con un tilde marcado lo sigue mostrando', () => {
    const c = montar({ tipoPropiedad: 'Terreno', piscina: true });
    expect(hay(c, 'Características')).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Piscina/ })).toBeChecked();
  });

  it('avisa que hay datos que no corresponden al tipo', () => {
    montar({ tipoPropiedad: 'Terreno', dormitorios: '3' });
    expect(screen.getByText(/no corresponden a terreno/i)).toBeInTheDocument();
  });

  it('sin datos ajenos no muestra ningún aviso', () => {
    montar({ tipoPropiedad: 'Terreno' });
    expect(screen.queryByText(/no corresponden a/i)).not.toBeInTheDocument();
  });
});

describe('ficha — la pantalla se achica de verdad', () => {
  /*
   * El umbral es 60% y no «la mitad» a propósito: hoy un terreno muestra
   * exactamente la mitad de controles que una casa, y un test clavado en ese
   * empate se pondría rojo la primera vez que se agregue un campo a cualquiera
   * de los dos. Lo que se quiere afirmar es que la reducción es grande, no un
   * número.
   */
  it('un terreno muestra bastante menos que una casa', () => {
    const terreno = campos(montar({ tipoPropiedad: 'Terreno' })).length;
    const casa = campos(montar({ tipoPropiedad: 'Casa' })).length;
    expect(terreno).toBeLessThan(casa * 0.6);
  });

  it('una cochera es la ficha más corta de todas', () => {
    const cochera = campos(montar({ tipoPropiedad: 'Cochera' })).length;
    const casa = campos(montar({ tipoPropiedad: 'Casa' })).length;
    expect(cochera).toBeLessThan(casa * 0.4);
  });
});

/**
 * El número con el que se valúa, visible para todas las tipologías.
 *
 * El recuadro del total estaba dentro del bloque de superficies construidas,
 * que un terreno no muestra. O sea: la única tipología que valúa por otra cosa
 * —su lote— era justamente la que no veía su superficie.
 */
describe('ficha — la superficie de valuación se ve siempre', () => {
  it('un terreno la ve, y dice que es la del lote', () => {
    montar({ tipoPropiedad: 'Terreno', supTerreno: '832', superficieTotalPreview: 832 });
    expect(screen.getByText('Superficie de valuación:')).toBeInTheDocument();
    expect(screen.getByText('832 m²')).toBeInTheDocument();
    expect(screen.getByText('(superficie del terreno)')).toBeInTheDocument();
  });

  it('un departamento la ve con la fórmula de la inmobiliaria', () => {
    montar({ tipoPropiedad: 'Departamento', supCubierta: '88', superficieTotalPreview: 88 });
    expect(screen.getByText('Superficie de valuación:')).toBeInTheDocument();
    expect(screen.getByText('(cubierta + semicubierta + 30% descubierta)')).toBeInTheDocument();
  });
});

/** Las cuatro tipologías que no se habían mirado una por una. */
describe('ficha — las tipologías que faltaban', () => {
  it('a un local y a una oficina no les pide dormitorios', () => {
    expect(hay(montar({ tipoPropiedad: 'Local' }), 'Dormitorios')).toBe(false);
    expect(hay(montar({ tipoPropiedad: 'Oficina' }), 'Dormitorios')).toBe(false);
  });

  it('un local conserva baños, ambientes y servicios', () => {
    const c = montar({ tipoPropiedad: 'Local' });
    expect(hay(c, 'Baños')).toBe(true);
    expect(hay(c, 'Ambientes')).toBe(true);
    expect(hay(c, 'Servicios')).toBe(true);
  });

  it('una oficina no pide superficie de terreno, un local sí', () => {
    expect(hay(montar({ tipoPropiedad: 'Oficina' }), 'Sup. terreno (m²)')).toBe(false);
    expect(hay(montar({ tipoPropiedad: 'Local' }), 'Sup. terreno (m²)')).toBe(true);
  });

  it('un PH y un «Otro» ven la ficha entera, como la casa', () => {
    for (const tipo of ['PH', 'Otro'] as const) {
      const c = montar({ tipoPropiedad: tipo });
      for (const campo of ['Dormitorios', 'Baños', 'Ambientes', 'Antigüedad (años)', 'Servicios', 'Características']) {
        expect(hay(c, campo), `${tipo} · ${campo}`).toBe(true);
      }
    }
  });
});
