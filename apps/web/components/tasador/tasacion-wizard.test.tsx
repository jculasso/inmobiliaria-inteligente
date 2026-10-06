import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TasacionDto } from '@vacker/types';
import { AUTOGUARDADO_MS, TasacionWizard } from './tasacion-wizard';

const push = vi.fn();
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => params,
}));

const createTasacion = vi.fn();
const updateTasacion = vi.fn();
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/tasador-api', () => ({
  createTasacion: (...a: unknown[]) => createTasacion(...a),
  updateTasacion: (...a: unknown[]) => updateTasacion(...a),
  generarInforme: vi.fn(),
  subirFotoTasacion: vi.fn(),
  eliminarFotoTasacion: vi.fn(),
}));
vi.mock('../../lib/abrir-pdf', () => ({
  abrirPdfEnPestana: vi.fn(),
  abrirPestanaEnEspera: () => null,
}));

const COEF = { semicubierta: 1, descubierta: 0.3 };

const TASACION = {
  id: 't1',
  cliente: 'Ana Martínez',
  fecha: '2026-10-01',
  direccion: 'Córdoba 1234',
  barrio: null,
  ciudad: 'Rosario',
  tipoOperacion: 'venta',
  tipoPropiedad: 'Departamento',
  supCubierta: 60,
  supSemicubierta: 0,
  supDescubierta: 0,
  supTerreno: null,
  comparables: [],
  fotos: [],
  servicios: [],
  amenities: [],
  valorMinimo: null,
  valorRecomendado: null,
  valorAspiracional: null,
} as unknown as TasacionDto;

const pendiente = () => new Promise(() => {});

beforeEach(() => {
  params = new URLSearchParams();
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
  push.mockReset();
  createTasacion.mockReset();
  updateTasacion.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TasacionWizard — un guardado a la vez', () => {
  it('dos toques seguidos en «Siguiente» mandan un solo pedido', async () => {
    updateTasacion.mockReturnValue(pendiente());
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);

    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana M.' } });
    const siguiente = screen.getByRole('button', { name: 'Siguiente →' });
    fireEvent.click(siguiente);
    fireEvent.click(siguiente);

    await waitFor(() => expect(updateTasacion).toHaveBeenCalledTimes(1));
    // Mientras guarda, tampoco se puede saltar de paso desde la barra lateral.
    expect(screen.getByRole('button', { name: 'Características' })).toBeDisabled();
  });

  it('en una tasación nueva, el doble toque no la crea dos veces', async () => {
    createTasacion.mockReturnValue(pendiente());
    render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);

    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Dirección/), { target: { value: 'Mitre 900' } });
    const siguiente = screen.getByRole('button', { name: 'Siguiente →' });
    fireEvent.click(siguiente);
    fireEvent.click(siguiente);

    await waitFor(() => expect(createTasacion).toHaveBeenCalledTimes(1));
  });

  it('«Guardar y salir» y «Generar informe» quedan deshabilitados mientras guarda', async () => {
    updateTasacion.mockReturnValue(pendiente());
    params = new URLSearchParams('seccion=6');
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Generar informe/ })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(updateTasacion).toHaveBeenCalledTimes(1);
  });
});

describe('TasacionWizard — la sección vive en la dirección', () => {
  it('al pasar de paso, la dirección dice en cuál está', async () => {
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await waitFor(() => expect(window.location.search).toBe('?seccion=2'));
    expect(window.location.pathname).toBe('/tasador/tasaciones/t1/editar');
    // Nada cambió: no hace falta pedirle nada a la API para pasar de paso.
    expect(updateTasacion).not.toHaveBeenCalled();
  });

  it('al recargar con ?seccion=3, abre en ese paso', () => {
    params = new URLSearchParams('seccion=3');
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);
    expect(screen.getByRole('button', { name: 'Análisis comercial' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('al crear, pasa a la dirección de la tasación sin perder el paso', async () => {
    createTasacion.mockResolvedValue({ id: 'nueva-1' });
    render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);

    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Dirección/), { target: { value: 'Mitre 900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await waitFor(() =>
      expect(`${window.location.pathname}${window.location.search}`).toBe(
        '/tasador/tasaciones/nueva-1/editar?seccion=2',
      ),
    );
  });
});

describe('TasacionWizard — autoguardado', () => {
  it('guarda solo lo que cambió, unos segundos después del último cambio', async () => {
    vi.useFakeTimers();
    updateTasacion.mockResolvedValue(TASACION);
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);

    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana M.' } });
    await act(async () => {
      vi.advanceTimersByTime(AUTOGUARDADO_MS - 100);
    });
    expect(updateTasacion).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(updateTasacion).toHaveBeenCalledTimes(1);
    const [, id, datos] = updateTasacion.mock.calls[0]!;
    expect(id).toBe('t1');
    expect(datos).toMatchObject({ cliente: 'Ana M.' });
    // Solo la sección 1: lo que no cambió no viaja.
    expect(datos).not.toHaveProperty('tipoPropiedad');
  });

  it('al salir de la app guarda en el acto, sin esperar', async () => {
    updateTasacion.mockResolvedValue(TASACION);
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);

    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana M.' } });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    await waitFor(() => expect(updateTasacion).toHaveBeenCalledTimes(1));
  });
});

describe('TasacionWizard — borrador de una tasación nueva', () => {
  it('lo escrito antes de crearla se recupera al volver a abrir', async () => {
    const { unmount } = render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);
    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana Borrador' } });
    unmount();

    render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);
    await waitFor(() => expect(screen.getByLabelText(/Cliente/)).toHaveValue('Ana Borrador'));
    expect(screen.getByText(/Recuperamos lo que estabas cargando/)).toBeInTheDocument();
  });

  it('el borrador de otra persona no aparece', async () => {
    const { unmount } = render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);
    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'De Ana' } });
    unmount();

    render(<TasacionWizard coeficientes={COEF} usuarioId="u2" />);
    // Se da una vuelta para que corra el efecto que lee el borrador.
    await act(async () => {});
    expect(screen.getByLabelText(/Cliente/)).toHaveValue('');
  });

  it('se borra al crear la tasación', async () => {
    createTasacion.mockResolvedValue({ id: 'nueva-2' });
    render(<TasacionWizard coeficientes={COEF} usuarioId="u1" />);
    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Dirección/), { target: { value: 'Mitre 900' } });
    expect(window.sessionStorage.length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await waitFor(() => expect(createTasacion).toHaveBeenCalled());
    await waitFor(() => expect(window.sessionStorage.length).toBe(0));
  });
});

describe('TasacionWizard — salir con cambios', () => {
  it('«Cancelar» pregunta antes de descartar lo que no se guardó', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);
    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'Ana M.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(confirmar).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('sin cambios, «Cancelar» sale sin preguntar', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    render(<TasacionWizard tasacion={TASACION} coeficientes={COEF} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(confirmar).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/tasador/tasaciones');
    confirmar.mockRestore();
  });
});
