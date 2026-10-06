import { applyDecorators, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { normalizeIp, Throttle, type ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Límite de solicitudes por persona (auditoría del 6/10/2026). Hasta entonces
 * no había ninguno: un script con un token válido podía pedir PDFs o la
 * exportación completa en bucle y tumbar la API —una sola instancia en el free
 * tier de Render— para todas las inmobiliarias a la vez.
 *
 * Dos límites:
 *
 * - **`global`**: generoso, para TODA la API, contado por persona y no por
 *   ruta. Una pantalla normal hace decenas de pedidos por minuto, no cientos.
 * - **`costoso`**: solo en las rutas marcadas con `@Costoso()` —PDFs,
 *   exportación, envíos de mail, importar de Tokko, Google, cambiar la clave—,
 *   contado por persona Y por ruta. Son las que de verdad cuestan.
 *
 * Se cuenta por usuario autenticado cuando lo hay (varios vendedores detrás del
 * mismo wifi de la oficina comparten IP, y contarlos juntos los frenaría a
 * todos) y por IP cuando no (endpoints públicos: callback de Google, health).
 *
 * **El contador vive en memoria de cada instancia.** Con una sola instancia en
 * Render es exacto; si algún día hay varias, cada una cuenta por su lado y el
 * límite efectivo se multiplica. Para eso haría falta un almacenamiento
 * compartido (Redis), que hoy está diferido a propósito (CLAUDE.md §3).
 */

const MINUTO_MS = 60_000;

/** Pedidos por minuto y por persona en toda la API (`THROTTLE_LIMITE_MINUTO`). */
export const LIMITE_GLOBAL_POR_MINUTO = 120;

/** Pedidos por minuto, por persona y por ruta, en las rutas costosas. */
export const LIMITE_COSTOSO_POR_MINUTO = 10;

const ES_COSTOSO = 'limite:costoso';

/**
 * Marca una ruta como costosa: además del límite global, tiene uno propio y
 * mucho más bajo. `limite` es por minuto.
 */
export const Costoso = (limite: number = LIMITE_COSTOSO_POR_MINUTO) =>
  applyDecorators(
    SetMetadata(ES_COSTOSO, true),
    Throttle({ costoso: { limit: limite, ttl: MINUTO_MS } }),
  );

/** ¿La ruta lleva `@Costoso()`? Lo mira directo en la metadata del handler. */
export function esCostoso(context: ExecutionContext): boolean {
  return Reflect.getMetadata(ES_COSTOSO, context.getHandler()) === true;
}

/**
 * A quién se le cuenta el pedido. Corre DESPUÉS del AuthGuard (ver el orden en
 * AuthModule), así que en una ruta con sesión el principal ya está resuelto.
 */
export function quienPide(req: { principal?: { userId: string }; ip?: string }): string {
  if (req.principal?.userId) return `u:${req.principal.userId}`;
  // IPv6 se agrupa por /64: cada conexión hogareña recibe un bloque entero, y
  // contar dirección por dirección dejaría saltar el límite rotándolas.
  return `ip:${req.ip ? normalizeIp(req.ip) : 'desconocida'}`;
}

/** Clave del límite global: por persona, sin importar la ruta. */
function claveGlobal(_ctx: ExecutionContext, quien: string, nombre: string): string {
  return createHash('sha256').update(`${nombre}-${quien}`).digest('hex');
}

/** Lee el límite global de la variable de entorno, con el valor por defecto si falta o es inválido. */
export function limiteGlobal(valor = process.env.THROTTLE_LIMITE_MINUTO): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : LIMITE_GLOBAL_POR_MINUTO;
}

export function opcionesDeLimite(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'global',
        ttl: MINUTO_MS,
        limit: limiteGlobal(),
        generateKey: claveGlobal,
      },
      {
        name: 'costoso',
        ttl: MINUTO_MS,
        limit: LIMITE_COSTOSO_POR_MINUTO,
        // Solo aplica donde se marcó. Sin esto, el límite bajo regiría para
        // toda la API (la clave por defecto ya separa por ruta).
        skipIf: (ctx) => !esCostoso(ctx),
      },
    ],
    getTracker: (req) => quienPide(req as { principal?: { userId: string }; ip?: string }),
    errorMessage: 'Demasiados pedidos seguidos. Esperá un minuto y volvé a intentar.',
  };
}
