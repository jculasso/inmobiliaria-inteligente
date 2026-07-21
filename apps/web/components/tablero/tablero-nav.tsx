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
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.filter((tab) => !tab.requiere || tab.requiere(roles)).map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
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
