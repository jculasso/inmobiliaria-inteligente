import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface SupabaseErrorBody {
  msg?: string;
  message?: string;
}

/**
 * Wrapper de la Auth Admin API de Supabase (crear/editar/borrar usuarios con
 * contraseña). Usa `SUPABASE_SERVICE_ROLE_KEY`, que salta RLS y las reglas de
 * Auth normales — por eso vive SOLO acá (apps/api), nunca en apps/web.
 */
@Injectable()
export class SupabaseAdminService {
  constructor(private readonly config: ConfigService) {}

  async createUser(email: string, password: string): Promise<SupabaseAuthUser> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(await this.mensajeError(res, 'crear el usuario'));
    }
    return (await res.json()) as SupabaseAuthUser;
  }

  async setPassword(authUserId: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(await this.mensajeError(res, 'actualizar la contraseña'));
    }
  }

  /** Best-effort: si falla el rollback no hay mucho más que hacer, no debe tapar el error original. */
  async deleteUser(authUserId: string): Promise<void> {
    await fetch(`${this.baseUrl()}/auth/v1/admin/users/${authUserId}`, {
      method: 'DELETE',
      headers: this.headers(),
    }).catch(() => undefined);
  }

  private headers(): Record<string, string> {
    const apikey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    return { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json' };
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('SUPABASE_URL');
  }

  private async mensajeError(res: Response, accion: string): Promise<string> {
    const body = (await res.json().catch(() => null)) as SupabaseErrorBody | null;
    return body?.msg ?? body?.message ?? `No se pudo ${accion} en Supabase Auth.`;
  }
}
