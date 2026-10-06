'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

export interface Pestania {
  href: string;
  label: string;
  /** Pantallas que se agrupan bajo esta pestaña: se eligen en una segunda fila. */
  sub?: { href: string; label: string }[];
  /** Solo el ícono, con el nombre para el lector de pantalla y al pasar el mouse. */
  icono?: string;
  /** Otras direcciones que también la marcan (la ficha de una inmobiliaria marca «Inmobiliarias»). */
  tambien?: string[];
}

/**
 * Las pestañas de un módulo, iguales en todos (nacieron en Alquileres; desde la
 * revisión del 6/10/2026 las usan todos los módulos):
 *
 * - La pestaña queda marcada también en sus páginas internas («Tasaciones» en
 *   /tasador/tasaciones/nueva). Antes solo se marcaba con la dirección exacta.
 * - En el teléfono la barra se desliza de costado —ella sola, no la página— con
 *   los nombres enteros; la activa se trae a la vista y un degradé avisa que
 *   hay más. Antes en Admin se cortaban.
 * - Una pestaña agrupada abre una segunda fila con sus pantallas.
 * - `aria-current` y foco visible.
 */
export function NavModulo({
  tabs,
  etiqueta,
  raiz,
}: {
  tabs: Pestania[];
  etiqueta: string;
  raiz: string;
}) {
  const pathname = usePathname();
  const es = (href: string) =>
    href === raiz ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activa = (t: Pestania) =>
    t.sub
      ? t.sub.some((s) => es(s.href))
      : es(t.href) || (t.tambien ?? []).some((x) => pathname.startsWith(x));
  const grupo = tabs.find((t) => t.sub && activa(t));
  const actual = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    actual.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <div>
      <div className="relative">
        <nav
          aria-label={etiqueta}
          className="flex overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
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
