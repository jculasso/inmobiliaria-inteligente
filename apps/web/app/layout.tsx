import type { Metadata, Viewport } from 'next';
import { ServiceWorker } from '../components/pwa/service-worker';
import { DebugDesborde } from '../components/debug-desborde';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Inmobiliaria Inteligente',
  description: 'Plataforma SaaS multi-tenant para inmobiliarias.',
  // El ícono es el de la PLATAFORMA, no el de una inmobiliaria: la app se
  // instala una sola vez desde una única URL y la usan varios clientes.
  // `apple-touch-icon` ya vale hoy: sin él, quien agregue la web a su pantalla
  // de inicio se lleva una captura de la página en vez del ícono.
  // Instalable: el manifest declara nombre, íconos y que abra a pantalla
  // completa. Los archivos quedan fuera del middleware (ver middleware.ts):
  // el navegador los pide SIN sesión.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Inmobiliaria',
    // La barra de estado toma el color de la página, que arriba es blanca.
    statusBarStyle: 'default',
  },
  other: {
    // Next 15 emite solo `mobile-web-app-capable` (el nombre estándar), pero
    // iOS 16 y anteriores únicamente entienden el de Apple: sin este meta, al
    // abrir la app desde la pantalla de inicio aparece con la barra de Safari
    // en vez de a pantalla completa.
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icono.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

/** Color de la barra del navegador y del sistema al abrir la app instalada. */
export const viewport: Viewport = {
  // El azul de la plataforma, no el rojo de Vacker: pinta la barra del
  // navegador en el celular y es una sola app para todas las inmobiliarias.
  themeColor: '#173F6B',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body>
        {children}
        <ServiceWorker />
        {/* Apagado salvo que se entre con `?debug=1`. Sirve para encontrar qué
            elemento causa el arrastre lateral en un teléfono real, que es lo
            único que no se puede medir desde afuera. */}
        <DebugDesborde />
      </body>
    </html>
  );
}
