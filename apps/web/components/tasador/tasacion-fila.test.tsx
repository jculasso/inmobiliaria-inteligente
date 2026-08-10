import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TasacionFila } from './tasacion-fila';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const BASE = {
  agenteId: 'a1',
  agente: { id: 'a1', nombre: 'Rocío Aguilar', fotoUrl: null },
  cliente: 'Ana Martínez',
  fecha: '2026-03-10',
  barrio: 'Centro',
  tipoPropiedad: 'Departamento',
  superficieTotal: 96,
  valorRecomendado: 180_480,
  estado: 'Captada',
  exclusividad: null,
  motivoNoCaptada: null,
};

const fila = (extra: Record<string, unknown>) =>
  render(
    <TasacionFila
      tasacion={{ ...BASE, ...extra } as never}
      onEstado={() => {}}
      onVer={() => {}}
    />,
  );

/**
 * La ciudad va junto a la dirección para poder ubicar una tasación de un
 * vistazo: el historial de Vacker mezcla Rosario, Funes y Álvarez, y la
 * dirección sola no alcanza para saber cuál es cuál.
 */
describe('TasacionFila — la ciudad', () => {
  it('se muestra al lado de la dirección', () => {
    fila({ id: '1', direccion: 'Av. Francia 3581', ciudad: 'Rosario' });
    // El nodo es uno solo: la ciudad es un sufijo, no una línea aparte — así no
    // suma altura por fila en el celular.
    expect(screen.getByText(/Av\. Francia 3581/)).toHaveTextContent('Av. Francia 3581 · Rosario');
  });

  it('sin ciudad no deja el separador colgado', () => {
    fila({ id: '2', direccion: 'San Lorenzo 2450', ciudad: null });
    const linea = screen.getByText(/San Lorenzo 2450/);
    expect(linea.textContent).toBe('San Lorenzo 2450');
    expect(linea.textContent).not.toContain('·');
  });

  it('tolera una tasación sin el campo, por si la API todavía no lo manda', () => {
    // Vercel y Render se despliegan por separado: durante unos minutos la web
    // nueva puede estar hablando con la API vieja.
    fila({ id: '3', direccion: 'Mitre 900' });
    expect(screen.getByText('Mitre 900')).toBeInTheDocument();
  });
});
