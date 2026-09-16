import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TipoPropiedad } from '@vacker/types';
import { Seccion3Analisis } from './seccion-3-analisis';

/**
 * La sección 3 del tasador, que es donde Vacker pidió el cambio: «está muy
 * apuntado a Departamentos, debería ser más abarcativo a los otros tipos de
 * propiedades».
 */
function montar(over: Partial<Parameters<typeof Seccion3Analisis>[0]> = {}) {
  const setFortalezas = vi.fn();
  const setAspectos = vi.fn();
  const props = {
    tipoPropiedad: 'Departamento' as TipoPropiedad,
    fortalezas: [] as string[],
    setFortalezas,
    aspectos: [] as string[],
    setAspectos,
    demanda: '' as const,
    setDemanda: vi.fn(),
    competencia: '' as const,
    setCompetencia: vi.fn(),
    perfilComprador: '' as const,
    setPerfilComprador: vi.fn(),
    observacionesComerciales: '',
    setObservacionesComerciales: vi.fn(),
    ...over,
  };
  const { container } = render(<Seccion3Analisis {...props} />);
  return { container, setFortalezas, setAspectos };
}

/** Los textos de las etiquetas que se ven, sin los botones de la pantalla. */
function etiquetas(container: HTMLElement): string[] {
  return [...container.querySelectorAll('button')].map((b) => b.textContent ?? '');
}

/**
 * Despliega las dos secciones.
 *
 * La pantalla muestra las primeras doce y esconde el resto detrás de «Ver las N
 * restantes», que es lo que hace usable la lista en el teléfono. Los tests que
 * preguntan qué se OFRECE para una tipología tienen que abrirla primero.
 */
function verTodas() {
  for (const boton of screen.queryAllByRole('button', { name: /^Ver las \d+ restantes$/ })) {
    fireEvent.click(boton);
  }
}

describe('sección 3 — las opciones dependen del tipo de propiedad', () => {
  it('a un departamento le ofrece balcón y expensas', () => {
    const { container } = montar({ tipoPropiedad: 'Departamento' });
    verTodas();
    const vistas = etiquetas(container);
    expect(vistas).toContain('Balcón funcional');
    expect(vistas).toContain('Bajas expensas');
    expect(vistas).not.toContain('Esquina');
  });

  it('a un terreno le ofrece frente y esquina, y no ambientes ni luminosidad', () => {
    const { container } = montar({ tipoPropiedad: 'Terreno' });
    verTodas();
    const vistas = etiquetas(container);
    expect(vistas).toContain('Esquina');
    expect(vistas).toContain('Todos los servicios');
    expect(vistas).not.toContain('Ambientes amplios');
    expect(vistas).not.toContain('Buena luminosidad');
  });

  it('a un galpón le ofrece altura libre y acceso de camiones', () => {
    const { container } = montar({ tipoPropiedad: 'Galpón' });
    verTodas();
    const vistas = etiquetas(container);
    expect(vistas).toContain('Altura libre favorable');
    expect(vistas).toContain('Excelente acceso para camiones');
    expect(vistas).toContain('Fuerza motriz');
  });

  /*
   * El caso que reportó el usuario mirando la lista: al tasar una cochera
   * aparecía «Falta de cochera» entre los aspectos a considerar, y «Cochera
   * incluida» entre las fortalezas. Se contradicen con lo que se está tasando.
   */
  it('a una cochera NO le ofrece «Falta de cochera» ni «Cochera incluida»', () => {
    const { container } = montar({ tipoPropiedad: 'Cochera' });
    verTodas();
    const vistas = etiquetas(container);
    expect(vistas).not.toContain('Falta de cochera');
    expect(vistas).not.toContain('Cochera incluida');
    expect(vistas).toContain('Fácil maniobra');
  });
});

describe('sección 3 — nada de lo elegido se pierde', () => {
  /*
   * Una tasación vieja, o una que se cargó como departamento y después se pasó
   * a terreno. El valor guardado no pertenece al catálogo de su tipología, y
   * aun así tiene que seguir viéndose y marcado: si desaparece de la pantalla,
   * al guardar se pierde sin que nadie lo haya decidido.
   */
  it('muestra una fortaleza que ya no corresponde a la tipología', () => {
    const { container } = montar({ tipoPropiedad: 'Terreno', fortalezas: ['Buena luminosidad'] });
    verTodas();
    const chip = screen.getByRole('button', { name: 'Buena luminosidad' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(etiquetas(container)).toContain('Buena luminosidad');
  });

  it('muestra una fortaleza escrita a mano, que no está en ninguna lista', () => {
    montar({ fortalezas: ['Vista al lago artificial'] });
    expect(screen.getByRole('button', { name: 'Vista al lago artificial' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('sección 3 — agregar una propia', () => {
  it('suma lo que el tasador escribe', () => {
    const { setFortalezas } = montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar fortaleza' }));
    const campo = screen.getByLabelText('Agregar fortaleza');
    fireEvent.change(campo, { target: { value: '  Vista al lago  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(setFortalezas).toHaveBeenCalledWith(['Vista al lago']);
  });

  it('no la duplica si ya está, aunque cambien tildes y mayúsculas', () => {
    const { setFortalezas } = montar({ fortalezas: ['Excelente ubicación'] });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar fortaleza' }));
    fireEvent.change(screen.getByLabelText('Agregar fortaleza'), { target: { value: 'excelente ubicacion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(setFortalezas).not.toHaveBeenCalled();
  });

  it('ignora el texto vacío', () => {
    const { setFortalezas } = montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar fortaleza' }));
    fireEvent.change(screen.getByLabelText('Agregar fortaleza'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(setFortalezas).not.toHaveBeenCalled();
  });
});

describe('sección 3 — el buscador', () => {
  it('filtra sin tildes y sin distinguir mayúsculas', () => {
    const { container } = montar({ tipoPropiedad: 'Departamento' });
    fireEvent.change(screen.getByLabelText('Buscar fortalezas'), { target: { value: 'balcon' } });
    const vistas = etiquetas(container);
    expect(vistas).toContain('Balcón funcional');
    expect(vistas).not.toContain('Excelente ubicación');
  });

  it('avisa cuando no hay nada con ese texto', () => {
    montar();
    fireEvent.change(screen.getByLabelText('Buscar fortalezas'), { target: { value: 'helipuerto' } });
    expect(screen.getByText(/Nada con ese texto/)).toBeInTheDocument();
  });
});

describe('sección 3 — cuántas opciones ve cada tipología', () => {
  /*
   * Antes veían las mismas 16 fortalezas y 13 aspectos, fuera lo que fuera.
   * Este test no fija el número exacto —el catálogo va a seguir creciendo— sino
   * que compara: una cochera tiene que ver bastante menos que una casa.
   */
  it('la cochera ve menos opciones que la casa', () => {
    const cochera = montar({ tipoPropiedad: 'Cochera' });
    verTodas();
    const cuantasCochera = etiquetas(cochera.container).length;
    cochera.container.remove();
    const casa = montar({ tipoPropiedad: 'Casa' });
    verTodas();
    expect(etiquetas(casa.container).length).toBeGreaterThan(cuantasCochera);
  });
});

describe('sección 3 — la lista no se come la pantalla del teléfono', () => {
  /*
   * De 16 opciones iguales para todos se pasó a entre 24 y 59 según el tipo.
   * En el teléfono cada etiqueta ocupa un renglón, así que mostrarlas todas
   * dejaba «Demanda» y «Observaciones» a pantalla y media de scroll.
   */
  it('muestra las primeras y esconde el resto detrás de un botón', () => {
    const { container } = montar({ tipoPropiedad: 'Casa' });
    const alPrincipio = etiquetas(container).length;
    verTodas();
    expect(etiquetas(container).length).toBeGreaterThan(alPrincipio);
  });

  it('buscar muestra todo lo que coincide, aunque esté plegado', () => {
    // «Piscina» es de las propias de casa: queda lejos del corte de las doce.
    montar({ tipoPropiedad: 'Casa' });
    fireEvent.change(screen.getByLabelText('Buscar fortalezas'), { target: { value: 'piscina' } });
    expect(screen.getByRole('button', { name: 'Piscina' })).toBeInTheDocument();
  });
});
