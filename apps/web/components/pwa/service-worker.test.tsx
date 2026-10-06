import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServiceWorker } from './service-worker';

/**
 * Revisión PWA del 6/10/2026: el service worker nuevo se activaba solo y la
 * página se recargaba en medio de un formulario. Ahora solo se recarga si la
 * persona tocó «Actualizar».
 */
describe('ServiceWorker', () => {
  afterEach(() => vi.unstubAllEnvs());

  function preparar() {
    vi.stubEnv('NODE_ENV', 'production');
    const oyentes: Record<string, () => void> = {};
    const esperando = { postMessage: vi.fn() };
    const registro = { waiting: esperando, addEventListener: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register: vi.fn().mockResolvedValue(registro),
        addEventListener: (ev: string, fn: () => void) => (oyentes[ev] = fn),
        removeEventListener: vi.fn(),
      },
    });
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
    return { oyentes, esperando, reload };
  }

  it('un cambio de service worker que nadie pidió no recarga la página', async () => {
    const { oyentes, reload } = preparar();
    render(<ServiceWorker />);
    await screen.findByText('Hay una versión nueva disponible.');
    act(() => oyentes.controllerchange!());
    expect(reload).not.toHaveBeenCalled();
  });

  it('tocar «Actualizar» activa la versión nueva y recién ahí recarga', async () => {
    const { oyentes, esperando, reload } = preparar();
    render(<ServiceWorker />);
    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar' }));
    expect(esperando.postMessage).toHaveBeenCalledWith('ACTUALIZAR');
    act(() => oyentes.controllerchange!());
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
