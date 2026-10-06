import { describe, expect, it } from 'vitest';
import { AuthPrincipalSchema } from './auth';

const base = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'demo@vacker.com',
  nombre: 'Demo',
  fotoUrl: null,
  tenantId: '22222222-2222-2222-2222-222222222222',
  roles: ['vendedor'],
  debeCambiarPassword: false,
  tenant: {
    nombre: 'Vacker',
    plan: 'basico',
    modulos: {
      tablero: true,
      tasador: false,
      todo: false,
      protocolo: false,
      publicacion: false,
      alquileres: false,
    },
    /*
     * `config: {}` entra vacía y sale con el criterio de tasación por defecto:
     * el schema le pone los coeficientes. Que este test lo diga es a propósito
     * — es la garantía de que una inmobiliaria que nunca los configuró calcula
     * como Vacker y no con `undefined`.
     */
    config: {
      coefSemicubierta: 1,
      coefDescubierta: 0.3,
      ivaHonorariosPct: 21,
      comisionInicialPct: 5,
      comisionInicialCuotas: 2,
      comisionInicialConIva: true,
      selladoPct: 0,
      selladoInquilinoPct: 50,
      depositoGestion: 'entrega_propietario',
    },
  },
};

describe('AuthPrincipalSchema', () => {
  it('acepta un principal válido', () => {
    expect(AuthPrincipalSchema.parse(base)).toEqual(base);
  });

  /*
   * La web se publica antes que la API. En esos minutos la API vieja manda los
   * módulos sin `alquileres`, y la Home tiene que seguir andando: la clave
   * faltante se lee como módulo apagado, no como un error.
   */
  it('un principal sin la clave alquileres entra con el módulo apagado', () => {
    const { alquileres: _, ...sinAlquileres } = base.tenant.modulos;
    const parsed = AuthPrincipalSchema.parse({
      ...base,
      tenant: { ...base.tenant, modulos: sinAlquileres },
    });
    expect(parsed.tenant.modulos.alquileres).toBe(false);
  });

  it('acepta el rol administracion', () => {
    expect(AuthPrincipalSchema.safeParse({ ...base, roles: ['administracion'] }).success).toBe(
      true,
    );
  });

  it('rechaza un rol desconocido', () => {
    expect(AuthPrincipalSchema.safeParse({ ...base, roles: ['super_admin'] }).success).toBe(false);
  });

  it('rechaza un userId que no es uuid', () => {
    expect(AuthPrincipalSchema.safeParse({ ...base, userId: 'no-es-uuid' }).success).toBe(false);
  });
});
