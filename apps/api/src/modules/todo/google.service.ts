import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Cliente HTTP de Google (OAuth 2.0 + Calendar API v3). Solo lectura del
// calendario. Usa `fetch` nativo (Node 20+), sin dependencias extra.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
/** Scope de solo lectura del calendario (espejo, sin escritura). */
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

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

  /** URL a la que se manda al usuario para autorizar el acceso a su calendario. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.cfg('GOOGLE_OAUTH_CLIENT_ID'),
      redirect_uri: this.cfg('GOOGLE_OAUTH_REDIRECT_URI'),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline', // pedir refresh token
      prompt: 'consent', // forzar que Google devuelva refresh token
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

  /** Renueva un access token a partir del refresh token guardado. */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.cfg('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: this.cfg('GOOGLE_OAUTH_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    });
    const data = await this.postToken(body);
    return data.access_token as string;
  }

  private async postToken(body: URLSearchParams): Promise<Record<string, unknown>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`Google rechazó el intercambio de token (${res.status}). ${detalle}`);
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
    });
    if (!res.ok) return null;
    const cal = (await res.json()) as { id?: string };
    return cal.id ?? null;
  }

  /** Lista los eventos del calendario principal entre timeMin y timeMax (ISO). */
  async listEvents(accessToken: string, timeMinIso: string, timeMaxIso: string): Promise<GoogleEvento[]> {
    const params = new URLSearchParams({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      singleEvents: 'true', // expande eventos recurrentes en instancias
      orderBy: 'startTime',
      maxResults: '250',
    });
    const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`No se pudo leer el calendario (${res.status}). ${detalle}`);
    }
    const data = (await res.json()) as { items?: GoogleEvento[] };
    return (data.items ?? []).filter((e) => e.status !== 'cancelled');
  }
}
