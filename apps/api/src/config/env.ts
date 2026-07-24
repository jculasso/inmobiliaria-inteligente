import { z } from 'zod';

/** Esquema de variables de entorno. Se valida al arrancar (fail-fast). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Conexiones a Postgres (Supabase). No se validan como URL estricta porque
  // el esquema postgresql:// con query params puede variar.
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  // Supabase Auth
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // API
  API_PORT: z.coerce.number().int().positive().default(3001),
  // Google Calendar (módulo To Do List — espejo de solo lectura). Opcionales:
  // si faltan, la API arranca igual y solo el módulo `todo` avisa que no está
  // configurado (no queremos que una env var del To Do tumbe todo el backend).
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  // Clave para encriptar los refresh tokens de Google en reposo (AES-256-GCM).
  // Debe ser idéntica en todos los entornos que compartan la misma base.
  GOOGLE_TOKEN_ENC_KEY: z.string().min(1).optional(),
  // Base del frontend, para volver a la web tras el callback de OAuth.
  WEB_APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Validador usado por ConfigModule.forRoot({ validate }). */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = JSON.stringify(parsed.error.flatten().fieldErrors);
    throw new Error(`Variables de entorno inválidas: ${details}`);
  }
  return parsed.data;
}
