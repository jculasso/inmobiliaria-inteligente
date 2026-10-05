'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

const TABS = [
  { href: '/alquileres', label: 'Inicio' },
  { href: '/alquileres/contratos', label: 'Contratos' },
  { href: '/alquileres/indexaciones', label: 'A indexar' },
  { href: '/alquileres/personas', label: 'Personas' },
  { href: '/alquileres/propiedades', label: 'Propiedades' },
];

/**
 * Pestañas del módulo. Mismo aspecto que las del Tablero (`TableroNav`), pero
 * con `flex-auto`: son cinco, y repartidas por partes iguales «Propiedades» se
 * cortaba en un teléfono de 375px.
 */
export function AlquileresNav() {
  const pathname = usePathname();
  // La ficha de un contrato (/alquileres/contratos/…) sigue marcando «Contratos».
  const activa = (href: string) => (href === '/alquileres' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className="flex border-b border-line sm:gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={activa(tab.href) ? 'page' : undefined}
          className={cn(
            'min-w-0 flex-auto truncate border-b-2 px-1 py-2.5 text-center text-[11px] font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm',
            activa(tab.href) ? 'border-brand-red text-brand-red' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
