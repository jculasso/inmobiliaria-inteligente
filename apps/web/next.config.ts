import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad para todas las páginas (auditoría del 6/10/2026).
 * Sin ellas, otra página podía mostrar la app adentro de un iframe invisible y
 * hacer que alguien toque botones sin saberlo (clickjacking).
 *
 * No va una CSP completa: con scripts de Next, Supabase y la API en otros
 * dominios, una política mal armada rompe la app en producción. Solo
 * `frame-ancestors`, que es lo que frena el iframe.
 */
const CABECERAS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Los paquetes del workspace se consumen como código fuente (sin build step).
  transpilePackages: ['@vacker/ui', '@vacker/types'],
  async headers() {
    return [{ source: '/:path*', headers: CABECERAS }];
  },
};

export default nextConfig;
