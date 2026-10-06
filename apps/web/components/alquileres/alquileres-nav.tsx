'use client';

import { NavModulo, type Pestania } from '../nav-modulo';

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
 */
export function AlquileresNav() {
  return <NavModulo tabs={TABS} etiqueta="Alquileres" raiz="/alquileres" />;
}
