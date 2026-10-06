'use client';

import type { Rol } from '@vacker/types';
import { NavModulo } from '../nav-modulo';
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

/** Las pestañas del Tablero: el mismo componente que el resto de los módulos. */
export function TableroNav({ roles }: { roles: Rol[] }) {
  return (
    <NavModulo
      tabs={TABS.filter((tab) => !tab.requiere || tab.requiere(roles))}
      etiqueta="Tablero"
      raiz="/tablero"
    />
  );
}
