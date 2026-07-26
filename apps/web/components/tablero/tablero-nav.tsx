'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Rol } from '@vacker/types';
import { cn } from '@vacker/ui';
import { puedeVerVendedores } from '../../lib/rbac';

interface Tab {
  href: string;
  label: string;
  requiere?: (roles: Rol[]) => boolean;
}

const TABS: Tab[] = [
  { href: '/tablero', label: 'Dashboard' },
  { href: '/tablero/ventas', label: 'Ventas' },
  { href: '/tablero/alquileres', label: 'Alquileres' },
  { href: '/tablero/vendedores', label: 'Vendedores', requiere: puedeVerVendedores },
];

export function TableroNav({ roles }: { roles: Rol[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-line sm:gap-1">
      {TABS.filter((tab) => !tab.requiere || tab.requiere(roles)).map((tab) => {
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
