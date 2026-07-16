import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthIdentity, AuthProvider } from './auth-provider.interface';

/**
 * Verifica el JWT contra Supabase (`/auth/v1/user`). Simple y agnóstico al
 * formato de firma; para Fase 1 alcanza. Optimización futura (Paso 4): verificar
 * localmente por JWKS para evitar la llamada de red por request.
 */
@Injectable()
export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly config: ConfigService) {}

  async verifyToken(token: string): Promise<AuthIdentity> {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const apikey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY');

    let res: Response;
    try {
      res = await fetch(`${url}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey },
      });
    } catch {
      throw new UnauthorizedException('No se pudo verificar el token de acceso.');
    }

    if (!res.ok) {
      throw new UnauthorizedException('Token de acceso inválido o expirado.');
    }

    const user = (await res.json()) as { id?: string; email?: string };
    if (!user.id) {
      throw new UnauthorizedException('El token no contiene un usuario válido.');
    }
    return { userId: user.id, email: user.email ?? '' };
  }
}
