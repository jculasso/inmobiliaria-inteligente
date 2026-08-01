import type { NextConfig } from 'next';

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
};

export default nextConfig;
