'use client';

import { NavModulo } from '../nav-modulo';

const TABS = [
  { href: '/protocolo', label: 'Dashboard' },
  { href: '/protocolo/captadas', label: 'Captadas' },
  { href: '/protocolo/propiedades', label: 'Propiedades' },
];

/** Solo para dirección y admin: el reporte reúne toda la inmobiliaria. */
const TAB_REPORTE = { href: '/protocolo/reporte', label: 'Reporte' };

/** Las pestañas del Protocolo: el mismo componente que el resto de los módulos. */
export function ProtocoloNav({ mostrarReporte = false }: { mostrarReporte?: boolean }) {
  return (
    <NavModulo
      tabs={mostrarReporte ? [...TABS, TAB_REPORTE] : TABS}
      etiqueta="Protocolo"
      raiz="/protocolo"
    />
  );
}
