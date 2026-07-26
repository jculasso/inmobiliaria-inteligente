import { describe, expect, it } from 'vitest';
import { config } from './middleware';

/**
 * El matcher del middleware decide qué URL exige sesión.
 *
 * Esta lista ya se olvidó TRES veces, y cada vez con la misma consecuencia: el
 * navegador pide un archivo sin sesión y recibe un redirect al login en vez del
 * archivo.
 *
 *  1. `/icons/*` — el favicon no cargaba, y la PWA no se habría podido instalar.
 *  2. `/offline` — el service worker guardaba la pantalla de login como la
 *     pantalla de "sin conexión".
 *  3. `flyer-comercial.pdf` — un prospecto sin cuenta abría el link del folleto
 *     comercial y se encontraba con un login.
 *
 * El patrón es siempre el mismo: **todo lo que se pide SIN sesión tiene que
 * estar excluido**. Si agregás un archivo así, sumalo acá.
 */

const matcher = new RegExp(`^${config.matcher[0]!}$`);

/** true = el middleware interviene y puede exigir sesión. */
const exigeSesion = (ruta: string) => matcher.test(ruta);

describe('matcher del middleware', () => {
  it.each([
    ['/icons/icon-192.png', 'el ícono de la PWA'],
    ['/icons/apple-touch-icon.png', 'el ícono de iOS'],
    ['/manifest.webmanifest', 'el manifest, sin el que no se instala la app'],
    ['/sw.js', 'el service worker'],
    ['/favicon.ico', 'el favicon'],
    ['/_next/static/chunks/main.js', 'el JavaScript de la app'],
    ['/flyer-comercial.pdf', 'el folleto que se le manda a prospectos sin cuenta'],
  ])('%s se sirve sin sesión (%s)', (ruta) => {
    expect(exigeSesion(ruta)).toBe(false);
  });

  it.each([
    ['/tablero'],
    ['/tablero/ventas'],
    ['/tasador/tasaciones'],
    ['/protocolo'],
    ['/todo'],
  ])('%s sí pasa por el middleware', (ruta) => {
    expect(exigeSesion(ruta)).toBe(true);
  });
});
