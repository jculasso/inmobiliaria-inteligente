'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECCIONES = [
  { href: '/admin', label: 'Inmobiliarias' },
  { href: '/admin/guia', label: 'Guía del implementador' },
  { href: '/admin/onboarding', label: 'Onboarding' },
  { href: '/admin/inversion', label: 'Inversión' },
  { href: '/admin/modulo-publicacion', label: 'Módulo: publicación' },
] as const;

/** Navegación del panel de plataforma. Mismo lenguaje que las solapas de los módulos. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-line sm:gap-1">
      {SECCIONES.map((s) => {
        // `/admin` solo se marca activo en su propia ruta; las demás también
        // cuando se está en una subruta.
        const activo = s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`min-w-0 flex-1 truncate border-b-2 px-1 py-2.5 text-center text-[11px] font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${
              activo ? 'border-brand-red text-brand-red' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
