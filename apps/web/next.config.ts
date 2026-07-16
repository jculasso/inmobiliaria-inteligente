import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Los paquetes del workspace se consumen como código fuente (sin build step).
  transpilePackages: ['@vacker/ui', '@vacker/types'],
};

export default nextConfig;
