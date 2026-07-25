import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CambiarPassword } from '@vacker/types';
import type { AuthPrincipal } from '../auth/auth-principal';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from '../admin/supabase-admin.service';
import { PrincipalCacheService } from '../auth/principal-cache.service';

/**
 * Cambio de la propia contraseña. Usa `PrismaService` directo (sin RLS) porque
 * solo toca la fila del usuario autenticado, resuelta desde el token — no hay
 * forma de que alcance a otro usuario ni a otro tenant.
 */
@Injectable()
export class PasswordService {
  constructor(
    private readonly db: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly principalCache: PrincipalCacheService,
  ) {}

  async cambiar(dto: CambiarPassword, principal: AuthPrincipal): Promise<{ ok: true }> {
    const usuario = await this.db.usuario.findUnique({
      where: { id: principal.userId },
      select: { id: true, email: true, authUserId: true, debeCambiarPassword: true },
    });
    if (!usuario?.authUserId) {
      throw new NotFoundException('Tu usuario no tiene acceso configurado.');
    }

    // En el cambio obligatorio no se pide la clave actual: la persona acaba de
    // entrar con ella. En un cambio voluntario sí, para que una sesión abierta
    // y ajena no alcance para quedarse con la cuenta.
    if (!usuario.debeCambiarPassword) {
      if (!dto.passwordActual) {
        throw new BadRequestException('Ingresá tu contraseña actual.');
      }
      const valida = await this.supabaseAdmin.passwordEsValida(usuario.email, dto.passwordActual);
      if (!valida) {
        throw new BadRequestException('La contraseña actual no es correcta.');
      }
      if (dto.passwordActual === dto.passwordNueva) {
        throw new BadRequestException('La contraseña nueva tiene que ser distinta de la actual.');
      }
    }

    await this.supabaseAdmin.setPassword(usuario.authUserId, dto.passwordNueva);
    await this.db.usuario.update({
      where: { id: usuario.id },
      data: { debeCambiarPassword: false },
    });
    // Sin esto, /me seguiría diciendo "debe cambiar la contraseña" hasta que
    // venza el cache (30s) y la Home rebotaría al usuario de vuelta acá.
    this.principalCache.invalidarUsuario(usuario.id);

    return { ok: true };
  }
}
