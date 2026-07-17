import type { Rol } from '@vacker/types';

export type AlcanceModulo = 'propio' | 'equipo' | 'total' | 'ver';

const ETIQUETA: Record<AlcanceModulo, string> = {
  propio: 'Propio',
  equipo: 'Equipo',
  total: 'Total',
  ver: 'Ver',
};

/**
 * Alcance de Tablero/Tasador/To Do List según la matriz de acceso por rol
 * (docs/Arquitectura_Inmobiliaria_Inteligente.md §9). `admin_plataforma` es un
 * rol de plano-plataforma, no de tenant: no tiene alcance definido acá.
 */
const PRIORIDAD: { rol: Rol; alcance: AlcanceModulo }[] = [
  { rol: 'direccion', alcance: 'total' },
  { rol: 'team_leader', alcance: 'equipo' },
  { rol: 'vendedor', alcance: 'propio' },
  { rol: 'admin_tenant', alcance: 'ver' },
];

/** Alcance del rol más privilegiado del usuario, o `null` si ninguno aplica (p. ej. admin_plataforma solo). */
export function alcanceDeModulo(roles: Rol[]): AlcanceModulo | null {
  const match = PRIORIDAD.find((p) => roles.includes(p.rol));
  return match?.alcance ?? null;
}

export function etiquetaDeAlcance(alcance: AlcanceModulo): string {
  return ETIQUETA[alcance];
}
