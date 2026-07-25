import type { Metadata } from 'next';
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
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icono.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
