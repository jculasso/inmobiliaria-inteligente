import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad para todas las páginas, las mismas que apps/web
 * (auditoría del 6/10/2026). Sin `frame-ancestors`, cualquier página podía
 * mostrar el sitio dentro de un iframe invisible y hacer que alguien mande el
 * formulario sin saberlo.
 *
 * Sin CSP completa por el mismo motivo que en la web: una política mal armada
 * rompe el sitio en producción. Solo lo que frena el iframe.
 */
const CABECERAS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Solo el design system: el sitio comercial no comparte tipos de negocio con
  // la aplicación, y mantenerlo así es lo que permite desplegarlo aparte sin
  // arrastrar el producto.
  transpilePackages: ['@vacker/ui'],

  /*
   * `next build` y `next dev` escriben los dos en `.next`, así que compilar
   * mientras el servidor de desarrollo está levantado le pisa los archivos:
   * la página sigue respondiendo pero la hoja de estilos da 404, y el sitio se
   * ve como HTML crudo — links azules, todo en serif. Pasó tres veces el
   * 01/08/2026, y las tres el síntoma parecía un problema de diseño.
   *
   * Con esto, el build de los tests de navegador va a `.next-e2e` y no toca lo
   * que está usando quien tiene el sitio abierto. En Vercel la variable no
   * existe y se compila en `.next`, como siempre.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  async headers() {
    return [{ source: '/:path*', headers: CABECERAS }];
  },
};

export default nextConfig;
