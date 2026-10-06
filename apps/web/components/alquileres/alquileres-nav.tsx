'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

interface Pestania {
  href: string;
  label: string;
  /** Pantallas que se agrupan bajo esta pestaña: se eligen en una segunda fila. */
  sub?: { href: string; label: string }[];
  /** Solo el ícono, con el nombre para el lector de pantalla y al pasar el mouse. */
  icono?: string;
}

const TABS: Pestania[] = [
  { href: '/alquileres', label: 'Dashboard' },
  { href: '/alquileres/contratos', label: 'Contratos' },
  {
    href: '/alquileres/indexaciones',
    label: 'Indexación',
    sub: [
      { href: '/alquileres/indexaciones', label: 'A indexar' },
      { href: '/alquileres/indices', label: 'Índices' },
    ],
  },
  { href: '/alquileres/conceptos', label: 'Conceptos' },
  { href: '/alquileres/cobros', label: 'Cobros' },
  { href: '/alquileres/liquidaciones', label: 'Liquidaciones' },
  { href: '/alquileres/personas', label: 'Personas' },
  { href: '/alquileres/propiedades', label: 'Propiedades' },
  { href: '/alquileres/reclamos', label: 'Reclamos' },
  {
    href: '/alquileres/impuestos',
    label: 'Gastos',
    sub: [
      { href: '/alquileres/impuestos', label: 'Impuestos y servicios' },
      { href: '/alquileres/proveedores', label: 'Proveedores' },
    ],
  },
  // Las plantillas de contrato se arman desde Configuración: sin esta segunda
  // fila, en /alquileres/plantillas ninguna pestaña quedaba marcada.
  {
    href: '/alquileres/configuracion',
    label: 'Configuración',
    icono: '⚙️',
    sub: [
      { href: '/alquileres/configuracion', label: 'Configuración' },
      { href: '/alquileres/plantillas', label: 'Plantillas de contrato' },
    ],
  },
];

/**
 * Pestañas del módulo. Eran trece y en la computadora tampoco entraban: se
 * cortaban a la derecha sin aviso (Javier, 6/10/2026). Ahora son once —lo
 * que va junto, junto: indexar con los índices, impuestos con proveedores—,
 * y la pestaña agrupada abre una segunda fila con sus pantallas.
 *
 * En el teléfono la barra se desliza de costado —ella sola, no la página— con
 * los nombres enteros, la pestaña activa se trae a la vista y un degradé a la
 * derecha avisa que hay más.
 */
export function AlquileresNav() {
  const pathname = usePathname();
  const es = (href: string) =>
    href === '/alquileres'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  // La ficha de un contrato (/alquileres/contratos/…) sigue marcando «Contratos».
  const activa = (t: Pestania) => (t.sub ? t.sub.some((s) => es(s.href)) : es(t.href));
  const grupo = TABS.find((t) => t.sub && activa(t));
  const actual = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    actual.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <div>
      <div className="relative">
        <nav
          aria-label="Alquileres"
          className="flex overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              ref={activa(tab) ? actual : undefined}
              aria-current={activa(tab) ? 'page' : undefined}
              aria-label={tab.icono ? tab.label : undefined}
              title={tab.icono ? tab.label : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red/40 sm:text-sm lg:px-3.5',
                activa(tab)
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {tab.icono ?? tab.label}
            </Link>
          ))}
        </nav>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent lg:hidden"
        />
      </div>
      {grupo?.sub && (
        <nav aria-label={grupo.label} className="mt-2 flex flex-wrap gap-1">
          {grupo.sub.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={es(s.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40',
                es(s.href)
                  ? 'bg-brand-red text-white'
                  : 'bg-white text-muted ring-1 ring-line hover:text-ink',
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
