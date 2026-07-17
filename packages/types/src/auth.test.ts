import { describe, expect, it } from 'vitest';
import { AuthPrincipalSchema } from './auth';

const base = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'demo@vacker.com',
  tenantId: '22222222-2222-2222-2222-222222222222',
  roles: ['vendedor'],
};

describe('AuthPrincipalSchema', () => {
  it('acepta un principal válido', () => {
    expect(AuthPrincipalSchema.parse(base)).toEqual(base);
  });

  it('rechaza un rol desconocido', () => {
    expect(AuthPrincipalSchema.safeParse({ ...base, roles: ['super_admin'] }).success).toBe(false);
  });

  it('rechaza un userId que no es uuid', () => {
    expect(AuthPrincipalSchema.safeParse({ ...base, userId: 'no-es-uuid' }).success).toBe(false);
  });
});
