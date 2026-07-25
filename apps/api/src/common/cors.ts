import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Orígenes extra permitidos (coma-separados en la env var CORS_ORIGINS). */
const CORS_EXTRA = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Un origen del browser es propio: dominio de producción, cualquier
 * *.vercel.app (fallback + previews de PRs), localhost de desarrollo, o algo
 * listado en CORS_ORIGINS.
 */
export function esOrigenPermitido(origin: string): boolean {
  if (CORS_EXTRA.includes(origin)) return true;
  return (
    origin === 'https://app.inmobiliariainteligente.net' ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
}

/**
 * CORS acotado a los orígenes propios. La auth es por Bearer token (no
 * cookies), así que esto es defensa en profundidad.
 *
 * Vive acá y no dentro de `bootstrap()` para poder testearlo: estaba encerrado
 * en main.ts y por eso pasó sin ser detectado que faltara `exposedHeaders`.
 */
export const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Requests sin Origin (curl, health checks, server-to-server) pasan.
    if (!origin || esOrigenPermitido(origin)) cb(null, true);
    else cb(new Error(`Origen no permitido por CORS: ${origin}`), false);
  },

  /**
   * Sin esto el navegador NO deja leer `Content-Disposition` desde otro origen
   * — solo expone un puñado de headers por defecto. Es lo que hacía que el
   * nombre del informe no llegara y los PDF se guardaran con un nombre
   * genérico: la web y la API viven en subdominios distintos, así que TODA
   * respuesta es cross-origin.
   */
  exposedHeaders: ['Content-Disposition'],

  // Cachea el preflight (OPTIONS) 24hs: sin esto cada request cross-origin
  // paga dos viajes de red, y con Render lejos de Supabase eso duele.
  maxAge: 86_400,
};
