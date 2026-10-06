'use client';

import { NavModulo } from '../nav-modulo';

const TABS = [
  { href: '/tasador', label: 'Dashboard' },
  { href: '/tasador/tasaciones', label: 'Tasaciones' },
  { href: '/tasador/reporte', label: 'Reporte' },
];

/** Las pestañas del Tasador: el mismo componente que el resto de los módulos. */
export function TasadorNav() {
  return <NavModulo tabs={TABS} etiqueta="Tasador" raiz="/tasador" />;
}
