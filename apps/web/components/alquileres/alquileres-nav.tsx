'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

const TABS = [
  { href: '/alquileres', label: 'Inicio' },
  { href: '/alquileres/contratos', label: 'Contratos' },
  { href: '/alquileres/indexaciones', label: 'A indexar' },
  { href: '/alquileres/indices', label: 'Índices' },
  { href: '/alquileres/conceptos', label: 'Conceptos' },
  { href: '/alquileres/cobros', label: 'Cobros' },
  { href: '/alquileres/liquidaciones', label: 'Liquidaciones' },
  { href: '/alquileres/personas', label: 'Personas' },
  { href: '/alquileres/propiedades', label: 'Propiedades' },
  { href: '/alquileres/reclamos', label: 'Reclamos' },
  { href: '/alquileres/configuracion', label: '⚙️ Configuración' },
];

/**
 * Pestañas del módulo. Mismo aspecto que las del Tablero (`TableroNav`), pero
 * son once y en un teléfono de 375px no entran: repartidas o achicadas, se
 * cortaban todas («Inic…», «Contrat…»). En el teléfono la barra se desliza de
 * costado —ella sola, no la página— con los nombres enteros, y la pestaña
 * activa se trae a la vista al entrar.
 */
export function AlquileresNav() {
  const pathname = usePathname();
  // La ficha de un contrato (/alquileres/contratos/…) sigue marcando «Contratos».
  const activa = (href: string) => (href === '/alquileres' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const actual = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    actual.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <nav className="flex overflow-x-auto border-b border-line [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          ref={activa(tab.href) ? actual : undefined}
          aria-current={activa(tab.href) ? 'page' : undefined}
          className={cn(
            'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-center text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
            activa(tab.href) ? 'border-brand-red text-brand-red' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
