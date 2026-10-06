'use client';

import { NavModulo } from '../nav-modulo';

const SECCIONES = [
  { href: '/admin', label: 'Inmobiliarias' },
  { href: '/admin/guia', label: 'Guía del implementador' },
  { href: '/admin/onboarding', label: 'Onboarding' },
  { href: '/admin/inversion', label: 'Inversión' },
  { href: '/admin/modulo-publicacion', label: 'Módulo: publicación' },
] as const;

/**
 * Navegación del panel de plataforma: el mismo componente que los módulos. En el
 * teléfono las cinco secciones no entraban y se cortaban; ahora la barra se
 * desliza. La ficha de una inmobiliaria sigue marcando «Inmobiliarias».
 */
export function AdminNav() {
  return (
    <NavModulo
      tabs={SECCIONES.map((x) => ({
        ...x,
        tambien: x.href === '/admin' ? ['/admin/tenants'] : undefined,
      }))}
      etiqueta="Panel de plataforma"
      raiz="/admin"
    />
  );
}
