import { describe, expect, it, vi } from 'vitest';

import { metadatosDePagina } from './metadatos';
import { metadata as portada } from '../app/page';
import { metadata as tablero } from '../app/tablero/page';
import { metadata as tasador } from '../app/tasador/page';
import { metadata as layout } from '../app/layout';

// La tipografía del layout es de Next y no corre fuera de él (vi.mock se iza solo).
vi.mock('next/font/google', () => ({ Figtree: () => ({ variable: 'font' }) }));

type ConOg = { openGraph?: { title?: unknown; url?: unknown; images?: unknown } };

describe('metadatosDePagina', () => {
  const m = metadatosDePagina({ ruta: '/tablero', titulo: 'T', descripcion: 'D' });

  it('la vista previa en X es la imagen grande', () => {
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('canonical y og:url son los de la página', () => {
    expect(m.alternates?.canonical).toBe('/tablero');
    expect(m.openGraph).toMatchObject({ url: '/tablero' });
  });

  it('nombra la imagen para compartir: con un openGraph propio, Next no la pone sola', () => {
    expect((m as ConOg).openGraph?.images).toEqual([
      expect.objectContaining({ url: '/opengraph-image.png' }),
    ]);
  });
});

describe('las páginas del sitio', () => {
  it('/tablero y /tasador se comparten con su propio título, no con el de la portada', () => {
    const titulos = [portada, tablero, tasador].map((x) => (x as ConOg).openGraph?.title);
    expect(new Set(titulos).size).toBe(3);
    expect((tablero as ConOg).openGraph?.url).toBe('/tablero');
    expect((tasador as ConOg).openGraph?.url).toBe('/tasador');
  });

  it('el layout no fija canonical ni og:url, que heredaría cualquier página', () => {
    expect(layout.alternates?.canonical).toBeUndefined();
    expect((layout as ConOg).openGraph?.url).toBeUndefined();
  });
});
