import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import type { AuthIdentity, AuthProvider } from './auth-provider.interface';

/**
 * Verifica el JWT localmente contra las claves públicas (JWKS) de Supabase, en
 * vez de pegarle a `/auth/v1/user` en cada request. `createRemoteJWKSet` cachea
 * el JWKS en memoria (proceso) y solo vuelve a pedirlo si aparece un `kid` que
 * no conoce (rotación de clave) — así se elimina el viaje de red por request,
 * que en el free tier de Render (más latencia + cold starts) se sentía en
 * cada pantalla del Tablero.
 */
@Injectable()
export class SupabaseAuthProvider implements AuthProvider {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private issuer?: string;

  constructor(private readonly config: ConfigService) {}

  async verifyToken(token: string): Promise<AuthIdentity> {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    if (!this.jwks) {
      this.issuer = `${url}/auth/v1`;
      this.jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      if (typeof payload.sub !== 'string') {
        throw new UnauthorizedException('El token no contiene un usuario válido.');
      }
      return { userId: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      if (err instanceof joseErrors.JOSEError) {
        throw new UnauthorizedException('Token de acceso inválido o expirado.');
      }
      throw new UnauthorizedException('No se pudo verificar el token de acceso.');
    }
  }
}
