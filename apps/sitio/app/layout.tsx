import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';

/*
 * Figtree y no Montserrat.
 *
 * Montserrat es la tipografía de marca de Vacker (CLAUDE.md §6) y la usa el
 * PRODUCTO. El sitio comercial es de la plataforma, y con la misma letra y el
 * mismo rojo terminaba pareciendo material de Vacker en vez de nuestro.
 *
 * Figtree es la más cercana a Avenir Next, que fue la elegida en la propuesta
 * de marca — misma apertura y mismas proporciones. Avenir no se puede usar en
 * web: es una fuente de sistema de macOS con licencia comercial.
 */
const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
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
  themeColor: '#173F6B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={figtree.variable}>
      <body className="bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
