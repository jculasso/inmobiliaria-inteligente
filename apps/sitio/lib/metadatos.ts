import type { Metadata } from 'next';

/**
 * La imagen para compartir (`app/opengraph-image.png`). Se nombra explícita:
 * Next la pone sola solo donde no hay un `openGraph` propio, y al definirlo
 * /tablero y /tasador se compartían sin imagen (medido en el HTML del build).
 */
const IMAGEN = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Inmobiliaria Inteligente — Su CRM guarda las propiedades. Nosotros le decimos cómo va su negocio.',
};

/**
 * Los metadatos de cada página del sitio, armados en un solo lugar.
 *
 * Next mezcla `openGraph` y `twitter` del layout con los de la página de forma
 * superficial: si una página define su `openGraph`, pisa el del layout entero
 * (el `locale`, el `type`). Y un `canonical` puesto en el layout lo heredan
 * todas las páginas: /tablero quedaba marcada como copia de la portada. Por eso
 * cada página arma los suyos completos con esta función.
 *
 * Antes /tablero y /tasador, compartidas por WhatsApp, mostraban el título y
 * la bajada de la portada; y sin `summary_large_image` la vista previa en X
 * salía como un cuadradito.
 */
export function metadatosDePagina({
  ruta,
  titulo,
  descripcion,
  tituloCompartir = titulo,
  descripcionCompartir = descripcion,
}: {
  /** «/», «/tablero». */
  ruta: string;
  /** El `<title>` de la pestaña. */
  titulo: string;
  descripcion: string;
  /** Lo que se ve al compartir el enlace, si conviene más corto que el título. */
  tituloCompartir?: string;
  descripcionCompartir?: string;
}): Metadata {
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      title: tituloCompartir,
      description: descripcionCompartir,
      url: ruta,
      siteName: 'Inmobiliaria Inteligente',
      locale: 'es_AR',
      type: 'website',
      images: [IMAGEN],
    },
    twitter: {
      card: 'summary_large_image',
      title: tituloCompartir,
      description: descripcionCompartir,
      images: [IMAGEN],
    },
  };
}
