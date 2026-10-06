import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

export interface SupabaseErrorBody {
  msg?: string;
  message?: string;
  error_code?: string;
  code?: string | number;
}

/**
 * Techo de espera de cada llamada a Supabase Auth. Sin esto, un Auth que no
 * responde deja la request del usuario colgada hasta que la corte el proxy de
 * Render, sin ningún mensaje.
 */
const AUTH_TIMEOUT_MS = 15_000;

/**
 * Los únicos errores de Auth que se le traducen al usuario: son los que puede
 * resolver él. Cualquier otro texto de Supabase se queda en el log — puede
 * nombrar detalles internos (políticas, nombres de tablas, versiones) que no
 * tienen por qué llegar al navegador.
 */
const MENSAJES_CONOCIDOS: Record<string, string> = {
  email_exists: 'Ya existe una cuenta con ese email.',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  email_address_invalid: 'Ese email no es válido.',
  weak_password: 'La contraseña es demasiado débil. Probá con una más larga.',
};

/**
 * Wrapper de la Auth Admin API de Supabase (crear/editar/borrar usuarios con
 * contraseña). Usa `SUPABASE_SERVICE_ROLE_KEY`, que salta RLS y las reglas de
 * Auth normales — por eso vive SOLO acá (apps/api), nunca en apps/web.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(private readonly config: ConfigService) {}

  async createUser(email: string, password: string): Promise<SupabaseAuthUser> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email, password, email_confirm: true }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(await this.mensajeError(res, 'crear el usuario'));
    }
    return (await res.json()) as SupabaseAuthUser;
  }

  /**
   * Cambia el email de acceso. Va por la Admin API y no por SQL directo a
   * `auth.users`: Supabase guarda el mail también en `auth.identities`, y
   * tocar una sola de las dos tablas deja la cuenta sin poder iniciar sesión.
   *
   * **Ojo con lo que implica `email_confirm: true`:** el email nuevo queda
   * confirmado sin que nadie haya probado que la casilla es suya. Desde ese
   * momento, «olvidé mi clave» manda el enlace a esa casilla — o sea que quien
   * cambia el email de otro puede quedarse con su cuenta. Por eso los dos
   * caminos que llegan acá están acotados: el panel de plataforma
   * (`admin_plataforma`) y, en el Tablero, solo el administrador de la
   * inmobiliaria cuando la persona ya tiene acceso (ver
   * `VendedoresService.update`). Se mantiene así porque sin SMTP propio la
   * confirmación por correo no llegaría y la persona quedaría sin poder entrar.
   */
  async setEmail(authUserId: string, email: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: this.headers(),
      // `email_confirm` evita que quede pendiente de confirmación por correo
      // (que hoy no está configurado) y lo dejaría sin poder entrar.
      body: JSON.stringify({ email, email_confirm: true }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new BadRequestException(await this.mensajeError(res, 'cambiar el email'));
    }
  }

  async setPassword(authUserId: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        await this.mensajeError(res, 'actualizar la contraseña'),
      );
    }
  }

  /**
   * Verifica una contraseña sin cambiar la sesión del usuario: intenta el
   * grant de password contra Auth y descarta el token que devuelve. Se usa
   * cuando alguien cambia su clave por voluntad propia, para que una sesión
   * abierta y ajena no alcance para reemplazarla.
   */
  async passwordEsValida(email: string, password: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: this.config.getOrThrow<string>('SUPABASE_ANON_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    return res.ok;
  }

  /** Best-effort: si falla el rollback no hay mucho más que hacer, no debe tapar el error original. */
  async deleteUser(authUserId: string): Promise<void> {
    await fetch(`${this.baseUrl()}/auth/v1/admin/users/${authUserId}`, {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    }).catch(() => undefined);
  }

  private headers(): Record<string, string> {
    const apikey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    return { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json' };
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('SUPABASE_URL');
  }

  /**
   * El mensaje que ve el usuario. El texto crudo de Supabase va al log (es lo
   * que hace falta para diagnosticar) y al cliente solo llega uno de los
   * conocidos, en castellano, o uno genérico.
   */
  private async mensajeError(res: Response, accion: string): Promise<string> {
    const body = (await res.json().catch(() => null)) as SupabaseErrorBody | null;
    this.logger.error(
      `Supabase Auth rechazó ${accion} (${res.status}): ${body?.error_code ?? body?.code ?? ''} ${body?.msg ?? body?.message ?? ''}`,
    );
    return mensajeParaUsuario(body, accion);
  }
}

/** Traduce el error de Supabase Auth a uno que se le puede mostrar al usuario. */
export function mensajeParaUsuario(body: SupabaseErrorBody | null, accion: string): string {
  const codigo = body?.error_code ?? (typeof body?.code === 'string' ? body.code : undefined);
  if (codigo && MENSAJES_CONOCIDOS[codigo]) return MENSAJES_CONOCIDOS[codigo];
  // Versiones viejas de GoTrue no mandan `error_code`: el único caso que vale
  // la pena reconocer por el texto es el del email repetido.
  const texto = `${body?.msg ?? ''} ${body?.message ?? ''}`;
  if (/already (been )?registered|already exists/i.test(texto)) {
    return MENSAJES_CONOCIDOS.email_exists!;
  }
  return `No se pudo ${accion}. Probá de nuevo en unos minutos.`;
}
