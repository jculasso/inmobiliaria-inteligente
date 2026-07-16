import { describe, expect, it } from 'vitest';
import { RolSchema } from './index';

describe('RolSchema', () => {
  it('acepta los roles válidos del sistema', () => {
    expect(RolSchema.parse('vendedor')).toBe('vendedor');
    expect(RolSchema.parse('admin_plataforma')).toBe('admin_plataforma');
  });

  it('rechaza un rol desconocido', () => {
    expect(RolSchema.safeParse('super_admin').success).toBe(false);
  });
});
