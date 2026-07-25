import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstalarApp } from './instalar-app';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function simularDispositivo(ua: string, maxTouchPoints = 0) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

/** Dispara el evento que Chrome usa para ofrecer la instalación. */
function dispararBeforeInstallPrompt() {
  const e = new Event('beforeinstallprompt');
  Object.assign(e, { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }) });
  // `act` para que React procese el cambio de estado que dispara el evento.
  act(() => {
    window.dispatchEvent(e);
  });
}

afterEach(() => vi.restoreAllMocks());

describe('InstalarApp', () => {
  it('en una computadora NO aparece: ahí la app ya se usa en el navegador', () => {
    simularDispositivo(UA.macChrome);
    render(<InstalarApp />);

    dispararBeforeInstallPrompt();

    expect(screen.queryByText(/Acceso directo/)).not.toBeInTheDocument();
  });

  it('tampoco en Windows', () => {
    simularDispositivo(UA.windows);
    render(<InstalarApp />);

    dispararBeforeInstallPrompt();

    expect(screen.queryByText(/Acceso directo/)).not.toBeInTheDocument();
  });

  it('en iPhone muestra los pasos, porque no existe un botón de instalar', () => {
    simularDispositivo(UA.iphone);
    render(<InstalarApp />);

    expect(screen.getByText(/Acceso directo/)).toBeInTheDocument();
    expect(screen.getByText(/Agregar a inicio/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar a la pantalla/ })).not.toBeInTheDocument();
  });

  it('en Android ofrece el botón que dispara el instalador del sistema', () => {
    simularDispositivo(UA.android);
    render(<InstalarApp />);

    dispararBeforeInstallPrompt();

    expect(screen.getByRole('button', { name: /Agregar a la pantalla/ })).toBeInTheDocument();
  });

  it('un iPad se detecta aunque se presente como Mac (lo delata el táctil)', () => {
    simularDispositivo(UA.macChrome, 5);
    render(<InstalarApp />);

    expect(screen.getByText(/Acceso directo/)).toBeInTheDocument();
  });

  it('si ya se descartó una vez, no vuelve a aparecer', async () => {
    const user = userEvent.setup();
    simularDispositivo(UA.iphone);
    const { unmount } = render(<InstalarApp />);

    await user.click(screen.getByRole('button', { name: 'No mostrar más' }));
    expect(screen.queryByText(/Acceso directo/)).not.toBeInTheDocument();
    unmount();

    render(<InstalarApp />);
    expect(screen.queryByText(/Acceso directo/)).not.toBeInTheDocument();
  });
});
