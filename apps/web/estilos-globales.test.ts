import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'app', 'globals.css'), 'utf8');

/**
 * Reglas de `globals.css` que arreglan problemas que costaron encontrar. No son
 * preferencias de estilo: si alguien las borra, vuelve un bug concreto.
 */
describe('globals.css', () => {
  it('los campos miden 16px en el celular, o iOS agranda la pantalla y la app "baila"', () => {
    // La causa del arrastre lateral que se sintió durante días en toda la app.
    // iOS Safari hace zoom al enfocar un campo con letra menor a 16px; al
    // agrandar, la ventana visible se achica y la página se puede arrastrar de
    // costado. Medido en un iPhone 14 Pro Max: 430px de layout contra 377px
    // visibles — exactamente el factor 16/14.
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]{0,200}font-size: 16px !important/);
  });

  it('la página no se desplaza de costado (red de seguridad en html y body)', () => {
    // `clip` y no `hidden`: `hidden` convierte al body en contenedor de scroll
    // y rompe los encabezados `sticky`.
    const cortes = css.match(/overflow-x:\s*clip/g) ?? [];
    expect(cortes.length).toBeGreaterThanOrEqual(2);
    expect(css).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('reserva el ancho de la barra de scroll, para que el contenido no salte al navegar', () => {
    expect(css).toMatch(/scrollbar-gutter:\s*stable/);
  });
});
