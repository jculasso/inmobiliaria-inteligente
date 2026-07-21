import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Wrapper mínimo de la Storage API de Supabase (subir PDFs de informes, y
 * fotos de propiedades). Usa `SUPABASE_SERVICE_ROLE_KEY` — solo server-side,
 * mismo patrón que `SupabaseAdminService` (apps/api/src/admin/supabase-admin.service.ts).
 * El bucket es parámetro de cada llamada (no una constante fija) para que un
 * mismo servicio sirva tanto a `informes-tasador` como a `tasador-fotos`.
 */
@Injectable()
export class SupabaseStorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Sube (o sobrescribe) un archivo y devuelve su URL pública. El bucket casi
   * siempre ya existe (se crea una única vez, la primera llamada) — probar
   * `asegurarBucket()` antes de cada subida era un round trip de más a
   * Supabase Storage en el 100% de los casos; ahora se intenta subir directo
   * y solo se crea el bucket como fallback si la subida falla por eso.
   */
  async upload(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
    let res = await this.subir(bucket, path, buffer, contentType);
    if (!res.ok) {
      const body = await res.clone().text().catch(() => '');
      // Igual que en `asegurarBucket()`: Supabase Storage no siempre devuelve
      // el 404 como status HTTP real — a veces responde 400 con el 404 como
      // texto dentro del body (`{"statusCode":"404","error":"Bucket not
      // found",...}`), así que hay que revisar ambos lugares.
      const bucketNoExiste = res.status === 404 || /"statusCode":"?404"?/.test(body) || /bucket not found/i.test(body);
      if (bucketNoExiste) {
        await this.asegurarBucket(bucket);
        res = await this.subir(bucket, path, buffer, contentType);
      }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudo subir el archivo a Supabase Storage: ${body}`);
    }
    return `${this.baseUrl()}/storage/v1/object/public/${bucket}/${path}`;
  }

  private subir(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<Response> {
    return fetch(`${this.baseUrl()}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': contentType, 'x-upsert': 'true' },
      body: buffer,
    });
  }

  /** Elimina un archivo. No falla si ya no existe. */
  async remove(bucket: string, path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudo borrar el archivo de Supabase Storage: ${body}`);
    }
  }

  /**
   * Idempotente: crea el bucket público la primera vez; ignora "ya existe".
   * Supabase Storage no siempre devuelve el 409 como status HTTP — a veces
   * responde con otro status y el 409 va como `statusCode` (string) dentro
   * del body (`{"statusCode":"409","error":"Duplicate",...}`), así que hay
   * que revisar ambos lugares.
   */
  private async asegurarBucket(bucket: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
    });
    if (res.ok) return;
    const body = await res.text().catch(() => '');
    const yaExiste = res.status === 409 || /"statusCode":"?409"?/.test(body) || /duplicate/i.test(body);
    if (yaExiste) return;
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
