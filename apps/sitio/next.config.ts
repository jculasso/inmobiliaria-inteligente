import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Solo el design system: el sitio comercial no comparte tipos de negocio con
  // la aplicación, y mantenerlo así es lo que permite desplegarlo aparte sin
  // arrastrar el producto.
  transpilePackages: ['@vacker/ui'],
};

export default nextConfig;
