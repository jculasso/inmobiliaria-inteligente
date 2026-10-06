import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Cliente HTTP de Google (OAuth 2.0 + Calendar API v3). Solo lectura del
// calendario. Usa `fetch` nativo (Node 20+), sin dependencias extra.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
/** Scope de solo lectura del calendario (espejo, sin escritura). */
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
/** Eventos por página que se le piden a Google (su máximo es 2500; 250 es su default razonable). */
const EVENTOS_POR_PAGINA = 250;
/**
 * Cuántas páginas se siguen como mucho: 8 × 250 = 2000 eventos en una vista de
 * mes, muy por encima de una agenda real. Es un techo contra un calendario
 * patológico (miles de eventos generados por otra herramienta), no un límite
 * que se espere tocar.
 */
export const MAX_PAGINAS = 8;

/** Google rechazó el access token (venció o lo revocaron): hay que renovarlo. */
export class TokenDeGoogleRechazado extends Error {}

/**
 * Techo de espera de cada llamada a Google. Sin esto, un Google lento deja la
 * request del usuario colgada hasta que la corte el proxy de Render.
 */
const GOOGLE_TIMEOUT_MS = 15_000;

/** Recurso "event" de Google Calendar, reducido a lo que usamos. */
export interface GoogleEvento {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  status?: string;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(private readonly config: ConfigService) {}

  /** Lanza claro si el módulo no está configurado (faltan env vars de Google). */
  private cfg(clave: string): string {
    const valor = this.config.get<string>(clave);
    if (!valor) {
      throw new ServiceUnavailableException(
        'El módulo To Do (Google Calendar) no está configurado en este entorno.',
      );
    }
    return valor;
  }

  /** Falla claro, ANTES de mandar al usuario a ningún lado, si falta configurar Google. */
  assertConfigurado(): void {
    this.cfg('GOOGLE_OAUTH_CLIENT_ID');
    this.cfg('GOOGLE_OAUTH_CLIENT_SECRET');
    this.cfg('GOOGLE_OAUTH_REDIRECT_URI');
  }

  /** La URL del callback en esta API; las demás rutas del flujo cuelgan de la misma base. */
  redirectUri(): string {
    return this.cfg('GOOGLE_OAUTH_REDIRECT_URI');
  }

  /** URL a la que se manda al usuario para autorizar el acceso a su calendario. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.cfg('GOOGLE_OAUTH_CLIENT_ID'),
      redirect_uri: this.cfg('GOOGLE_OAUTH_REDIRECT_URI'),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline', // pedir refresh token
      // `select_account`: obliga a elegir la cuenta de Google, aunque el
      // navegador ya tenga una logueada — evita vincular por error la casilla
      // equivocada. `consent`: fuerza que Google devuelva el refresh token.
      prompt: 'select_account consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Intercambia el `code` del callback por tokens. Devuelve el refresh token (si vino) y un access token. */
  async exchangeCode(code: string): Promise<{ refreshToken: string | null; accessToken: string }> {
    const body = new URLSearchParams({
      code,
      client_id: this.cfg('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: this.cfg('GOOGLE_OAUTH_CLIENT_SECRET'),
      redirect_uri: this.cfg('GOOGLE_OAUTH_REDIRECT_URI'),
      grant_type: 'authorization_code',
    });
    const data = await this.postToken(body);
    return {
      refreshToken: (data.refresh_token as string) ?? null,
      accessToken: data.access_token as string,
    };
  }

  /**
   * Renueva un access token a partir del refresh token guardado. Devuelve
   * también cuántos segundos vale (`expires_in`, una hora en la práctica), para
   * que quien llama lo pueda reusar en vez de pedir uno nuevo en cada vista.
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiraEnSeg: number }> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.cfg('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: this.cfg('GOOGLE_OAUTH_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    });
    const data = await this.postToken(body);
    const expira = Number(data.expires_in);
    return {
      accessToken: data.access_token as string,
      expiraEnSeg: Number.isFinite(expira) && expira > 0 ? expira : 3600,
    };
  }

  private async postToken(body: URLSearchParams): Promise<Record<string, unknown>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (!res.ok) {
      // La respuesta de Google (p. ej. `invalid_grant` con su descripción) va
      // al log, no al navegador: sirve para diagnosticar, no para el usuario.
      const detalle = await res.text().catch(() => '');
      this.logger.error(`Google rechazó el intercambio de token (${res.status}): ${detalle}`);
      throw new ServiceUnavailableException(
        'Google no aceptó la conexión con tu calendario. Probá desconectarlo y volver a conectarlo.',
      );
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Email de la cuenta conectada. El id del calendario principal ES la casilla
   * de Google, así que lo sacamos de ahí sin pedir el scope de email.
   */
  async getPrimaryEmail(accessToken: string): Promise<string | null> {
    const res = await fetch(`${CALENDAR_BASE}/calendars/primary`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const cal = (await res.json()) as { id?: string };
    return cal.id ?? null;
  }

  /**
   * Lista los eventos del calendario principal entre timeMin y timeMax (ISO),
   * siguiendo `nextPageToken`. Antes se pedía UNA página de 250 y lo que
   * sobraba se perdía sin aviso: una vista de mes cargada mostraba el día 20
   * vacío. Ahora se siguen las páginas hasta `MAX_PAGINAS`, y si aun así queda
   * algo, `truncado` lo dice.
   */
  async listEvents(
    accessToken: string,
    timeMinIso: string,
    timeMaxIso: string,
  ): Promise<{ eventos: GoogleEvento[]; truncado: boolean }> {
    const eventos: GoogleEvento[] = [];
    let pageToken: string | undefined;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const params = new URLSearchParams({
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
        singleEvents: 'true', // expande eventos recurrentes en instancias
        orderBy: 'startTime',
        maxResults: String(EVENTOS_POR_PAGINA),
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });
      if (res.status === 401) throw new TokenDeGoogleRechazado();
      if (!res.ok) {
        const detalle = await res.text().catch(() => '');
        this.logger.error(`Google no devolvió los eventos (${res.status}): ${detalle}`);
        throw new ServiceUnavailableException(
          'No se pudo leer tu calendario de Google. Probá de nuevo en unos minutos.',
        );
      }
      const data = (await res.json()) as { items?: GoogleEvento[]; nextPageToken?: string };
      eventos.push(...(data.items ?? []).filter((e) => e.status !== 'cancelled'));
      pageToken = data.nextPageToken;
      if (!pageToken) return { eventos, truncado: false };
    }
    this.logger.warn(`Calendario con más de ${MAX_PAGINAS} páginas de eventos en el rango.`);
    return { eventos, truncado: true };
  }
}
