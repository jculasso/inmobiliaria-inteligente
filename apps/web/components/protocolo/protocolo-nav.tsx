'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

const TABS = [
  { href: '/protocolo', label: 'Dashboard' },
  { href: '/protocolo/captadas', label: 'Captadas' },
  { href: '/protocolo/propiedades', label: 'Propiedades' },
];

/** Solo para dirección y admin: el reporte reúne toda la inmobiliaria. */
const TAB_REPORTE = { href: '/protocolo/reporte', label: 'Reporte' };

export function ProtocoloNav({ mostrarReporte = false }: { mostrarReporte?: boolean }) {
  const pathname = usePathname();
  const tabs = mostrarReporte ? [...TABS, TAB_REPORTE] : TABS;

  return (
    <nav className="flex border-b border-line sm:gap-1">
      {tabs.map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'min-w-0 flex-1 truncate border-b-2 px-1 py-2.5 text-center text-[11px] font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm',
              activo
                ? 'border-brand-red text-brand-red'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
