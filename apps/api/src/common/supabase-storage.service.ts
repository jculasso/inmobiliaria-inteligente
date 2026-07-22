import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** TTL por defecto de las URLs firmadas (1 h) — suficiente para abrir un PDF o ver las fotos de una tasación. */
const SIGNED_URL_TTL = 60 * 60;

/**
 * Wrapper mínimo de la Storage API de Supabase. Usa `SUPABASE_SERVICE_ROLE_KEY`
 * (solo server-side, mismo patrón que `SupabaseAdminService`).
 *
 * Dos tipos de bucket:
 * - **Públicos** (`upload`): avatares de usuario y logos de tenant — baja
 *   sensibilidad, se renderizan inline en todos lados. URL pública permanente.
 * - **Privados** (`uploadPrivado` + `signedUrl`): informes PDF y fotos de
 *   propiedades — datos confidenciales del cliente. No hay URL pública; el
 *   acceso es siempre por URL firmada de vida corta.
 */
@Injectable()
export class SupabaseStorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Sube a un bucket PÚBLICO y devuelve su URL pública permanente (avatares,
   * logos). El bucket casi siempre ya existe; se crea como fallback si la
   * primera subida falla por 404.
   */
  async upload(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.subirConReintento(bucket, path, buffer, contentType, true);
    return `${this.baseUrl()}/storage/v1/object/public/${bucket}/${path}`;
  }

  /**
   * Sube a un bucket PRIVADO (informes, fotos). No devuelve URL: el acceso se
   * hace después con `signedUrl`/`signedUrls`. Devuelve la key (path) guardada.
   */
  async uploadPrivado(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.subirConReintento(bucket, path, buffer, contentType, false);
    return path;
  }

  /** URL firmada (vida corta) de un objeto de un bucket privado. */
  async signedUrl(bucket: string, path: string, expiresIn: number = SIGNED_URL_TTL): Promise<string> {
    const res = await fetch(`${this.baseUrl()}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudo firmar la URL de Storage: ${body}`);
    }
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const rel = data.signedURL ?? data.signedUrl;
    if (!rel) throw new InternalServerErrorException('Supabase Storage no devolvió la URL firmada.');
    return `${this.baseUrl()}/storage/v1${rel}`;
  }

  /**
   * URLs firmadas en lote (una sola llamada de red). Preserva el orden de
   * `paths`; si alguna falla, esa entrada viene como cadena vacía.
   */
  async signedUrls(bucket: string, paths: string[], expiresIn: number = SIGNED_URL_TTL): Promise<string[]> {
    if (paths.length === 0) return [];
    const res = await fetch(`${this.baseUrl()}/storage/v1/object/sign/${bucket}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn, paths }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudieron firmar las URLs de Storage: ${body}`);
    }
    const data = (await res.json()) as { path?: string; signedURL?: string; signedUrl?: string }[];
    // La respuesta viene en el mismo orden que `paths`.
    return data.map((d) => {
      const rel = d.signedURL ?? d.signedUrl;
      return rel ? `${this.baseUrl()}/storage/v1${rel}` : '';
    });
  }

  /**
   * Extrae la key (path relativo al bucket) de un valor guardado, que puede ser
   * una key ya (subidas nuevas) o una URL pública completa (registros legacy,
   * previos al paso a buckets privados). Idempotente.
   */
  keyDe(bucket: string, stored: string): string {
    const marker = `/object/public/${bucket}/`;
    const i = stored.indexOf(marker);
    if (i >= 0) return stored.slice(i + marker.length);
    // También tolera una URL firmada (por si se guardara una por error).
    const signMarker = `/object/sign/${bucket}/`;
    const j = stored.indexOf(signMarker);
    if (j >= 0) return stored.slice(j + signMarker.length).split('?')[0]!;
    return stored;
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

  /** Sube y, si el bucket no existía (404), lo crea con la visibilidad pedida y reintenta. */
  private async subirConReintento(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
    publico: boolean,
  ): Promise<void> {
    let res = await this.subir(bucket, path, buffer, contentType);
    if (!res.ok) {
      const body = await res.clone().text().catch(() => '');
      // Supabase Storage no siempre devuelve el 404 como status HTTP real — a
      // veces responde 400 con el 404 como texto en el body.
      const bucketNoExiste = res.status === 404 || /"statusCode":"?404"?/.test(body) || /bucket not found/i.test(body);
      if (bucketNoExiste) {
        await this.asegurarBucket(bucket, publico);
        res = await this.subir(bucket, path, buffer, contentType);
      }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InternalServerErrorException(`No se pudo subir el archivo a Supabase Storage: ${body}`);
    }
  }

  private subir(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<Response> {
    return fetch(`${this.baseUrl()}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': contentType, 'x-upsert': 'true' },
      body: buffer,
    });
  }

  /**
   * Idempotente: crea el bucket con la visibilidad pedida la primera vez;
   * ignora "ya existe". Supabase Storage a veces responde el 409 como
   * `statusCode` (string) dentro del body en vez de status HTTP.
   */
  private async asegurarBucket(bucket: string, publico: boolean): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: publico }),
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
