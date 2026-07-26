import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { FlyerComercial } from './flyer-comercial.template';

describe('FlyerComercial', () => {
  it('genera un PDF de exactamente 4 páginas en A4', async () => {
    const buffer = await renderToBuffer(<FlyerComercial />);
    const crudo = buffer.toString('latin1');

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    // Son cuatro páginas por diseño: si alguien agrega contenido y el texto
    // desborda a una quinta, el flyer deja de ser lo que se acordó.
    expect(crudo).toContain('/Count 4');
    // A4 en puntos. Se imprime y se manda por WhatsApp: no puede salir en carta.
    expect(crudo).toContain('/MediaBox [0 0 595.280029 841.890015]');
  });

  it('pesa poco: se manda por WhatsApp con datos móviles', async () => {
    const buffer = await renderToBuffer(<FlyerComercial />);
    expect(buffer.length).toBeLessThan(2 * 1024 * 1024);
  });
});
