import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://inmobiliariainteligente.net'),
  title: 'Inmobiliaria Inteligente — la capa de conducción de su inmobiliaria',
  description:
    'Su CRM guarda las propiedades. Inmobiliaria Inteligente le dice cómo va su negocio y qué no se está haciendo. Desarrollado junto a una inmobiliaria en operación.',
  openGraph: {
    title: 'Inmobiliaria Inteligente',
    description:
      'Su CRM guarda las propiedades. Nosotros le decimos cómo va su negocio.',
    locale: 'es_AR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#C1121F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body className="bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
