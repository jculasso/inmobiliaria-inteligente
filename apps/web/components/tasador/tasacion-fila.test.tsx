import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TONO_ESTADO_TASACION } from '../../lib/tasacion-estado';
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
    <TasacionFila tasacion={{ ...BASE, ...extra } as never} onEstado={() => {}} onVer={() => {}} />,
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

/**
 * Las acciones como en el resto de la app: «📄 PDF», editar y borrar, con el
 * nombre de la fila para el lector de pantalla (antes eran «Editar», «Ver» y
 * «Borrar» sueltos, y «Ver» abría un PDF).
 */
describe('TasacionFila — acciones', () => {
  it('cada acción dice de qué tasación es', () => {
    const onVer = vi.fn();
    render(
      <TasacionFila
        tasacion={{ ...BASE, id: '9', direccion: 'Mitre 900', ciudad: null } as never}
        onEstado={() => {}}
        onVer={onVer}
        onBorrar={() => Promise.resolve()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Descargar el PDF de la tasación de Mitre 900' }),
    );
    expect(onVer).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Editar la tasación de Mitre 900' })).toHaveAttribute(
      'href',
      '/tasador/tasaciones/9/editar',
    );
    expect(
      screen.getByRole('button', { name: 'Borrar la tasación de Mitre 900' }),
    ).toBeInTheDocument();
  });

  it('una captación perdida va en el color de peligro, nunca en el de la marca', () => {
    expect(TONO_ESTADO_TASACION['No captada']).toBe('peligro');
    expect(TONO_ESTADO_TASACION.Captada).toBe('exito');
  });
});
