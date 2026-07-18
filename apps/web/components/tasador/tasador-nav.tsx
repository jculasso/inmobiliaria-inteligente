'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vacker/ui';

const TABS = [
  { href: '/tasador', label: 'Dashboard' },
  { href: '/tasador/tasaciones', label: 'Tasaciones' },
];

export function TasadorNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
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
