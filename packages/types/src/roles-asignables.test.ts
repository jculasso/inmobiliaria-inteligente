import { describe, expect, it } from 'vitest';
import { RolAsignableSchema, RolSchema, ROLES_PUBLICACION } from './index';

describe('roles asignables', () => {
  /**
   * Un rol que existe pero no se puede asignar no sirve para nada: la API lo
   * acepta y ninguna pantalla lo ofrece. Pasó con `publicador` — se agregó al
   * sistema y quedó imposible de dar hasta que alguien lo pidió.
   */
  it('todo rol del sistema es asignable, salvo admin_plataforma', () => {
    const asignables = new Set<string>(RolAsignableSchema.options);
    const faltan = RolSchema.options.filter(
      (r) => r !== 'admin_plataforma' && !asignables.has(r),
    );
    expect(faltan).toEqual([]);
  });

  it('admin_plataforma NO es asignable: no es un rol del tenant', () => {
    expect(RolAsignableSchema.options).not.toContain('admin_plataforma');
  });

  it('el rol que habilita Publicación se puede asignar desde la app', () => {
    // Si no, el módulo queda accesible solo para admins y no se le puede dar a
    // la persona administrativa, que es para quien se creó.
    expect(RolAsignableSchema.options).toContain('publicador');
    expect(ROLES_PUBLICACION).toContain('publicador');
  });
});

describe('puedeVerAlquileres', () => {
  it('dirección y el administrador de la inmobiliaria, sí', async () => {
    const { puedeVerAlquileres } = await import('./rol');
    expect(puedeVerAlquileres(['direccion'])).toBe(true);
    expect(puedeVerAlquileres(['admin_tenant'])).toBe(true);
  });

  it('vendedor, team leader y publicador, no', async () => {
    const { puedeVerAlquileres } = await import('./rol');
    expect(puedeVerAlquileres(['vendedor'])).toBe(false);
    expect(puedeVerAlquileres(['team_leader'])).toBe(false);
    expect(puedeVerAlquileres(['publicador'])).toBe(false);
  });

  it('alcanza con tener uno de los roles', async () => {
    const { puedeVerAlquileres } = await import('./rol');
    expect(puedeVerAlquileres(['team_leader', 'direccion'])).toBe(true);
  });
});
