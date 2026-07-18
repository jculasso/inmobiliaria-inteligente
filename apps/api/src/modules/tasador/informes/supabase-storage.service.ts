import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BUCKET = 'informes-tasador';

/**
 * Wrapper mínimo de la Storage API de Supabase (subir el PDF del informe).
 * Usa `SUPABASE_SERVICE_ROLE_KEY` — solo server-side, mismo patrón que
 * `SupabaseAdminService` (apps/api/src/admin/supabase-admin.service.ts).
 */
@Injectable()
export class SupabaseStorageService {
  constructor(private readonly config: ConfigService) {}

  /** Sube (o sobrescribe) un archivo y devuelve su URL pública. Crea el bucket si no existe. */
  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.asegurarBucket();

    const res = await fetch(`${this.baseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': contentType, 'x-upsert': 'true' },
      body: buffer,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudo subir el archivo a Supabase Storage: ${body}`);
    }
    return `${this.baseUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  /** Idempotente: crea el bucket público la primera vez; ignora "ya existe". */
  private async asegurarBucket(): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (res.ok || res.status === 409) return;
    const body = await res.text().catch(() => '');
    throw new InternalServerErrorException(`No se pudo crear el bucket de Storage: ${body}`);
  }

  private headers(): Record<string, string> {
    const apikey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    return { apikey, Authorization: `Bearer ${apikey}` };
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('SUPABASE_URL');
  }
}
