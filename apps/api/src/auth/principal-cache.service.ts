import { Injectable } from '@nestjs/common';
import type { AuthPrincipal } from './auth-principal';

/** Cuánto se cachea la resolución tenant+roles de un token ya verificado. */
const TTL_MS = 30_000;

interface Entrada {
  /**
   * La resolución en curso o terminada. Se guarda la PROMESA y no el valor:
   * una pantalla dispara varias requests a la vez con el mismo token, y si se
   * guardara solo el resultado, todas las que llegan antes de que termine la
   * primera verían el cache vacío y harían cada una su propio viaje a la base.
   */
  promesa: Promise<AuthPrincipal>;
  /** El principal ya resuelto: hace falta para invalidar por usuario o por tenant. */
  principal?: AuthPrincipal;
  expiresAt: number;
}

/**
 * Cache en memoria del principal, keyeada por el JWT literal — una pantalla
 * suele disparar varias requests casi simultáneas con el mismo token, y cada
 * una pagaba su propio round trip a la base solo para resolver tenant+roles.
 * Con Supabase en sa-east-1 y Render sin región cercana, eso se siente.
 *
 * Vive en un servicio propio (y no dentro del guard) porque hay cambios que
 * tienen que verse YA, sin esperar el TTL: al cambiar la contraseña, el perfil
 * cacheado seguía diciendo "debe cambiarla" y la Home rebotaba al usuario de
 * vuelta a /cambiar-clave. Lo mismo vale —y pesa más— para una baja, un cambio
 * de roles o una inmobiliaria suspendida: durante 30 segundos la persona seguía
 * operando con permisos que ya no tenía.
 */
@Injectable()
export class PrincipalCacheService {
  private readonly cache = new Map<string, Entrada>();

  /**
   * Devuelve el principal del token: el cacheado, el que se está resolviendo en
   * este momento, o lo resuelve con `cargar`. Si `cargar` falla, el error NO
   * queda cacheado — la próxima request vuelve a intentar.
   */
  obtener(token: string, cargar: () => Promise<AuthPrincipal>): Promise<AuthPrincipal> {
    const hit = this.cache.get(token);
    if (hit && hit.expiresAt > Date.now()) return hit.promesa;

    const entrada: Entrada = {
      promesa: cargar(),
      expiresAt: Date.now() + TTL_MS,
    };
    this.cache.set(token, entrada);
    entrada.promesa.then(
      (principal) => {
        entrada.principal = principal;
      },
      () => {
        // Solo se borra si sigue siendo ESTA entrada: una invalidación pudo
        // haberla sacado y otra request haber puesto una nueva en su lugar.
        if (this.cache.get(token) === entrada) this.cache.delete(token);
      },
    );
    // Equipo chico (decenas de usuarios activos, no miles): un barrido
    // ocasional alcanza para no acumular tokens vencidos indefinidamente.
    if (this.cache.size > 200) this.pruneExpired();
    return entrada.promesa;
  }

  /** Descarta lo cacheado de un usuario: su próxima request relee de la base. */
  invalidarUsuario(userId: string): void {
    this.invalidarDonde((p) => p.userId === userId);
  }

  /**
   * Descarta lo cacheado de todos los usuarios de una inmobiliaria: al
   * suspenderla o cambiarle los módulos, el cambio tiene que verse ya.
   */
  invalidarTenant(tenantId: string): void {
    this.invalidarDonde((p) => p.tenantId === tenantId);
  }

  /**
   * Las entradas todavía en vuelo también se descartan: no se sabe de quién
   * son, y una que empezó a leer ANTES del cambio devolvería el estado viejo y
   * lo dejaría cacheado 30 segundos. Sacarlas cuesta, como mucho, una lectura
   * extra a la base; dejarlas, una baja que no se aplica.
   */
  private invalidarDonde(coincide: (p: AuthPrincipal) => boolean): void {
    for (const [token, entrada] of this.cache) {
      if (!entrada.principal || coincide(entrada.principal)) this.cache.delete(token);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [token, valor] of this.cache) {
      if (valor.expiresAt <= now) this.cache.delete(token);
    }
  }
}
