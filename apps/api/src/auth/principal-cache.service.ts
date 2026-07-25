import { Injectable } from '@nestjs/common';
import type { AuthPrincipal } from './auth-principal';

/** Cuánto se cachea la resolución tenant+roles de un token ya verificado. */
const TTL_MS = 30_000;

/**
 * Cache en memoria del principal, keyeada por el JWT literal — una pantalla
 * suele disparar varias requests casi simultáneas con el mismo token, y cada
 * una pagaba su propio round trip a la base solo para resolver tenant+roles.
 * Con Supabase en sa-east-1 y Render sin región cercana, eso se siente.
 *
 * Vive en un servicio propio (y no dentro del guard) porque hay cambios que
 * tienen que verse YA, sin esperar el TTL: al cambiar la contraseña, el perfil
 * cacheado seguía diciendo "debe cambiarla" y la Home rebotaba al usuario de
 * vuelta a /cambiar-clave.
 */
@Injectable()
export class PrincipalCacheService {
  private readonly cache = new Map<string, { principal: AuthPrincipal; expiresAt: number }>();

  get(token: string): AuthPrincipal | null {
    const hit = this.cache.get(token);
    return hit && hit.expiresAt > Date.now() ? hit.principal : null;
  }

  set(token: string, principal: AuthPrincipal): void {
    this.cache.set(token, { principal, expiresAt: Date.now() + TTL_MS });
    // Equipo chico (decenas de usuarios activos, no miles): un barrido
    // ocasional alcanza para no acumular tokens vencidos indefinidamente.
    if (this.cache.size > 200) this.pruneExpired();
  }

  /** Descarta lo cacheado de un usuario: su próxima request relee de la base. */
  invalidarUsuario(userId: string): void {
    for (const [token, valor] of this.cache) {
      if (valor.principal.userId === userId) this.cache.delete(token);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [token, valor] of this.cache) {
      if (valor.expiresAt <= now) this.cache.delete(token);
    }
  }
}
