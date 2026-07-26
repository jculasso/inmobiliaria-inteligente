import { beforeAll, describe, expect, it, vi } from 'vitest';
import { abrirPdfEnPestana } from './abrir-pdf';

// jsdom no implementa las URLs de objeto (`blob:`), que es como se le pasa el
// PDF a la pestaña.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/pdf-de-prueba');
  URL.revokeObjectURL = vi.fn();
});

/**
 * Pestaña simulada. Trae SU PROPIO `navigator` y `File` a propósito: el bug
 * era que se usaban los de la página que abría la pestaña, y el navegador
 * entonces no reconocía el click como gesto del usuario.
 */
function pestanaFalsa({
  puedeCompartir = true,
  sePuedeCerrar = true,
}: { puedeCompartir?: boolean; sePuedeCerrar?: boolean } = {}) {
  const handlers = new Map<string, () => void>();
  const descargaDisparada = vi.fn();
  const share = vi.fn().mockResolvedValue(undefined);
  const timers: Array<() => void> = [];

  const registrar = (id: string) => ({
    hidden: true,
    addEventListener: (_e: string, fn: () => void) => handlers.set(id, fn),
  });

  const elementos: Record<string, unknown> = {
    compartir: registrar('compartir'),
    volver: registrar('volver'),
    descargar: { dispatchEvent: descargaDisparada },
  };

  const win = {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      getElementById: (id: string) => elementos[id] ?? null,
    },
    navigator: {
      canShare: vi.fn().mockReturnValue(puedeCompartir),
      share,
    },
    File: globalThis.File,
    location: { href: 'about:blank' },
    closed: false,
    close: vi.fn(() => {
      if (sePuedeCerrar) (win as { closed: boolean }).closed = true;
    }),
    setTimeout: (fn: () => void) => timers.push(fn),
  } as unknown as Window & { closed: boolean; location: { href: string } };

  return {
    win,
    share,
    descargaDisparada,
    botonCompartir: elementos.compartir as { hidden: boolean },
    clickEnviar: () => handlers.get('compartir')?.(),
    clickVolver: () => {
      handlers.get('volver')?.();
      // La pestaña cerrada se lleva sus timers puestos.
      if (!win.closed) timers.forEach((fn) => fn());
    },
    html: () => (win.document.write as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => c[0]).join(''),
  };
}

const pdf = () =>
  Promise.resolve({
    blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    nombre: 'Tasacion Vacker - Juan Pérez - Córdoba 1234',
  });

describe('abrirPdfEnPestana', () => {
  it('el archivo se ofrece con su nombre completo', async () => {
    const p = pestanaFalsa();
    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });

    expect(p.html()).toContain('download="Tasacion Vacker - Juan Pérez - Córdoba 1234.pdf"');
  });

  it('compartir usa el navigator DE LA PESTAÑA, no el de la página', async () => {
    // Regresión: al usar el navigator de la página original, el click en la
    // pestaña no contaba como gesto del usuario y en el iPhone el botón
    // "Enviar" no hacía nada.
    const p = pestanaFalsa();
    const globalShare = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share: globalShare, canShare: () => true });

    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickEnviar();

    expect(p.share).toHaveBeenCalledTimes(1);
    expect(globalShare).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('comparte el PDF con su nombre, sin adjuntar ninguna dirección', async () => {
    const p = pestanaFalsa();
    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickEnviar();

    const arg = p.share.mock.calls[0]![0] as { files: File[]; title: string; url?: string };
    expect(arg.files[0]!.name).toBe('Tasacion Vacker - Juan Pérez - Córdoba 1234.pdf');
    expect(arg.files[0]!.type).toBe('application/pdf');
    expect(arg.url).toBeUndefined();
  });

  it('si el sistema no puede compartir archivos, el botón no se muestra', async () => {
    const p = pestanaFalsa({ puedeCompartir: false });
    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });

    expect(p.botonCompartir.hidden).toBe(true);
  });

  it('cancelar el menú de compartir no dispara la descarga', async () => {
    const p = pestanaFalsa();
    const abort = new Error('cancelado');
    abort.name = 'AbortError';
    p.share.mockRejectedValue(abort);

    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickEnviar();
    await new Promise((r) => setTimeout(r, 0));

    expect(p.descargaDisparada).not.toHaveBeenCalled();
  });

  it('si compartir falla de verdad, se cae a la descarga y no queda un botón muerto', async () => {
    const p = pestanaFalsa();
    p.share.mockRejectedValue(new Error('no soportado'));

    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickEnviar();
    await new Promise((r) => setTimeout(r, 0));

    expect(p.descargaDisparada).toHaveBeenCalled();
  });

  it('la pestaña siempre tiene salida: "Volver" la cierra', async () => {
    // Regresión: instalada como app no hay barra del navegador, así que sin
    // este botón el PDF era un callejón sin salida y había que cerrar la app.
    const p = pestanaFalsa();
    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickVolver();

    expect(p.win.close).toHaveBeenCalled();
    expect(p.win.closed).toBe(true);
  });

  it('si el sistema no deja cerrar la pestaña, vuelve a la pantalla anterior', async () => {
    const p = pestanaFalsa({ sePuedeCerrar: false });
    await abrirPdfEnPestana(pdf, { titulo: 'Generando', onError: vi.fn(), ventana: p.win });
    p.clickVolver();

    expect(p.win.location.href).toBe(window.location.href);
  });

  it('avisa del error si el PDF no se pudo generar', async () => {
    const p = pestanaFalsa();
    const onError = vi.fn();

    await abrirPdfEnPestana(() => Promise.reject(new Error('La API no respondió.')), {
      titulo: 'Generando',
      onError,
      ventana: p.win,
    });

    expect(onError).toHaveBeenCalledWith('La API no respondió.');
    expect(p.win.close).toHaveBeenCalled();
  });
});
