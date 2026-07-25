import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MODULOS_DEFAULT } from '@vacker/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { SupabaseAdminService } from '../admin/supabase-admin.service';
import type { AuthPrincipal } from '../auth/auth-principal';
import { PasswordService } from './password.service';

const PRINCIPAL: AuthPrincipal = {
  userId: 'u1',
  email: 'demo@vacker.com',
  nombre: 'Demo',
  fotoUrl: null,
  tenantId: 't1',
  debeCambiarPassword: false,
  roles: ['vendedor'],
  tenant: { nombre: 'Vacker', plan: 'basico', modulos: MODULOS_DEFAULT, config: {} },
};

function makeDb(usuario: Record<string, unknown> | null) {
  const update = vi.fn();
  return {
    db: { usuario: { findUnique: vi.fn().mockResolvedValue(usuario), update } } as unknown as PrismaService,
    update,
  };
}

function makeSupabase(passwordValida = true) {
  return {
    setPassword: vi.fn(),
    passwordEsValida: vi.fn().mockResolvedValue(passwordValida),
  } as unknown as SupabaseAdminService & {
    setPassword: ReturnType<typeof vi.fn>;
    passwordEsValida: ReturnType<typeof vi.fn>;
  };
}

const FORZADO = { id: 'u1', email: 'demo@vacker.com', authUserId: 'auth-1', debeCambiarPassword: true };
const NORMAL = { ...FORZADO, debeCambiarPassword: false };

describe('PasswordService', () => {
  it('en el cambio obligatorio no pide la contraseña actual', async () => {
    const { db, update } = makeDb(FORZADO);
    const supabase = makeSupabase();
    const svc = new PasswordService(db, supabase);

    await svc.cambiar({ passwordNueva: 'claveNueva1' }, PRINCIPAL);

    expect(supabase.passwordEsValida).not.toHaveBeenCalled();
    expect(supabase.setPassword).toHaveBeenCalledWith('auth-1', 'claveNueva1');
    // Se baja la marca: si no, seguiría rebotando a /cambiar-clave.
    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { debeCambiarPassword: false } });
  });

  it('en un cambio voluntario exige la contraseña actual', async () => {
    const { db } = makeDb(NORMAL);
    const supabase = makeSupabase();
    const svc = new PasswordService(db, supabase);

    await expect(svc.cambiar({ passwordNueva: 'claveNueva1' }, PRINCIPAL)).rejects.toThrow(
      BadRequestException,
    );
    expect(supabase.setPassword).not.toHaveBeenCalled();
  });

  it('rechaza si la contraseña actual es incorrecta', async () => {
    const { db } = makeDb(NORMAL);
    const supabase = makeSupabase(false);
    const svc = new PasswordService(db, supabase);

    await expect(
      svc.cambiar({ passwordActual: 'malaClave', passwordNueva: 'claveNueva1' }, PRINCIPAL),
    ).rejects.toThrow(BadRequestException);
    expect(supabase.setPassword).not.toHaveBeenCalled();
  });

  it('no deja repetir la misma contraseña', async () => {
    const { db } = makeDb(NORMAL);
    const svc = new PasswordService(db, makeSupabase());

    await expect(
      svc.cambiar({ passwordActual: 'laMisma123', passwordNueva: 'laMisma123' }, PRINCIPAL),
    ).rejects.toThrow(BadRequestException);
  });

  it('acepta el cambio voluntario con la contraseña actual correcta', async () => {
    const { db, update } = makeDb(NORMAL);
    const supabase = makeSupabase();
    const svc = new PasswordService(db, supabase);

    await svc.cambiar({ passwordActual: 'actual123', passwordNueva: 'nueva4567' }, PRINCIPAL);

    expect(supabase.setPassword).toHaveBeenCalledWith('auth-1', 'nueva4567');
    expect(update).toHaveBeenCalled();
  });

  it('falla si el usuario todavía no tiene acceso configurado', async () => {
    const { db } = makeDb({ ...FORZADO, authUserId: null });
    const svc = new PasswordService(db, makeSupabase());

    await expect(svc.cambiar({ passwordNueva: 'claveNueva1' }, PRINCIPAL)).rejects.toThrow(
      NotFoundException,
    );
  });
});
