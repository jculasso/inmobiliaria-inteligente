import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TodoEstadoDto, TodoEventoDto, TodoEventosDto, TodoEventosQuery, TodoVista } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { GoogleService, type GoogleEvento } from './google.service';
import { desencriptarToken, encriptarToken } from './token-crypto';

// Argentina no tiene horario de verano: offset fijo -03:00. Los rangos día/
// semana/mes se calculan en hora local y se mandan a Google en UTC.
const TZ_OFFSET = '-03:00';
/** El `state` del OAuth vence a los 10 minutos (anti-replay). */
const STATE_TTL_MS = 10 * 60 * 1000;
/** Cache corto de eventos por usuario+rango, para no pegarle a Google en cada cambio de vista. */
const CACHE_TTL_MS = 30 * 1000;

@Injectable()
export class TodoService {
  private readonly cache = new Map<string, { exp: number; data: TodoEventosDto }>();

  constructor(
    private readonly db: TenantPrismaService,
    private readonly google: GoogleService,
    private readonly config: ConfigService,
  ) {}

  private encKey(): string | undefined {
    return this.config.get<string>('GOOGLE_TOKEN_ENC_KEY');
  }

  /** Paso 1: devuelve la URL de Google a la que redirigir para conectar el calendario. */
  connect(ctx: TenantContext): { url: string } {
    const state = encriptarToken(
      JSON.stringify({ t: ctx.tenantId, u: ctx.userId, ts: Date.now() }),
      this.encKey(),
    );
    return { url: this.google.buildAuthUrl(state) };
  }

  /**
   * Paso 2 (callback público): valida el `state`, canjea el `code`, guarda el
   * refresh token encriptado y devuelve a dónde volver en la web.
   */
  async handleCallback(code: string, state: string): Promise<string> {
    const { tenantId, userId } = this.decodeState(state);

    const { refreshToken, accessToken } = await this.google.exchangeCode(code);
    if (!refreshToken) {
      // Sin refresh token no podemos releer el calendario después. Con
      // prompt=consent Google siempre lo manda; si faltara, algo raro pasó.
      return this.volverAWeb('error');
    }
    const googleEmail = await this.google.getPrimaryEmail(accessToken);
    const refreshTokenEnc = encriptarToken(refreshToken, this.encKey());

    const ctx: TenantContext = { tenantId, userId, roles: [] };
    await this.db.withTenant(
      (tx) =>
        tx.googleCuenta.upsert({
          where: { usuarioId: userId },
          create: { tenantId, usuarioId: userId, refreshTokenEnc, googleEmail },
          update: { refreshTokenEnc, googleEmail },
        }),
      ctx,
    );
    this.cache.clear();
    return this.volverAWeb('conectado');
  }

  /** Si el usuario actual ya conectó su Google y con qué casilla. */
  async getEstado(ctx: TenantContext): Promise<TodoEstadoDto> {
    const cuenta = await this.db.withTenant(
      (tx) => tx.googleCuenta.findUnique({ where: { usuarioId: ctx.userId } }),
      ctx,
    );
    return { conectado: cuenta != null, googleEmail: cuenta?.googleEmail ?? null };
  }

  /** Desconecta (borra el token guardado) del usuario actual. */
  async desconectar(ctx: TenantContext): Promise<void> {
    await this.db.withTenant(
      (tx) => tx.googleCuenta.deleteMany({ where: { usuarioId: ctx.userId } }),
      ctx,
    );
    this.cache.clear();
  }

  /** Lee los eventos del calendario principal del usuario en el rango pedido. */
  async getEventos(ctx: TenantContext, query: TodoEventosQuery): Promise<TodoEventosDto> {
    const rango = rangoDe(query.vista, query.fecha);
    const cacheKey = `${ctx.userId}:${rango.vista}:${rango.desde}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.data;

    const cuenta = await this.db.withTenant(
      (tx) => tx.googleCuenta.findUnique({ where: { usuarioId: ctx.userId } }),
      ctx,
    );
    if (!cuenta) {
      throw new ConflictException('Tu cuenta de Google no está conectada.');
    }

    const refreshToken = desencriptarToken(cuenta.refreshTokenEnc, this.encKey());
    const accessToken = await this.google.refreshAccessToken(refreshToken);
    const crudos = await this.google.listEvents(accessToken, rango.desde, rango.hasta);

    const data: TodoEventosDto = {
      vista: rango.vista,
      desde: rango.desde,
      hasta: rango.hasta,
      eventos: crudos.map(mapEvento),
    };
    this.cache.set(cacheKey, { exp: Date.now() + CACHE_TTL_MS, data });
    return data;
  }

  private decodeState(state: string): { tenantId: string; userId: string } {
    let payload: { t?: string; u?: string; ts?: number };
    try {
      payload = JSON.parse(desencriptarToken(state, this.encKey())) as typeof payload;
    } catch {
      throw new BadRequestException('El parámetro de estado del OAuth es inválido.');
    }
    if (!payload.t || !payload.u || !payload.ts || Date.now() - payload.ts > STATE_TTL_MS) {
      throw new BadRequestException('El estado del OAuth venció o es inválido. Reintentá la conexión.');
    }
    return { tenantId: payload.t, userId: payload.u };
  }

  private volverAWeb(estado: 'conectado' | 'error'): string {
    const base = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000';
    return `${base}/todo?google=${estado}`;
  }
}

/** Convierte un evento de Google al DTO reducido de la app. */
function mapEvento(e: GoogleEvento): TodoEventoDto {
  const todoElDia = e.start?.date != null;
  return {
    id: e.id,
    titulo: e.summary?.trim() || '(sin título)',
    inicio: e.start?.dateTime ?? e.start?.date ?? '',
    fin: e.end?.dateTime ?? e.end?.date ?? '',
    todoElDia,
    ubicacion: e.location ?? null,
    descripcion: e.description ?? null,
    htmlLink: e.htmlLink ?? null,
  };
}

/** Calcula [desde, hasta) en UTC para la vista y la fecha ancla (hora Argentina). */
function rangoDe(vista: TodoVista, fecha?: string): { vista: TodoVista; desde: string; hasta: string } {
  const ancla = fecha ?? hoyArgentina();
  const inicioDia = new Date(`${ancla}T00:00:00${TZ_OFFSET}`);

  let desde: Date;
  let hasta: Date;
  if (vista === 'dia') {
    desde = inicioDia;
    hasta = addDays(inicioDia, 1);
  } else if (vista === 'semana') {
    // Semana de lunes a domingo. getUTCDay(): 0=Dom..6=Sáb (a mediodía local para evitar bordes).
    const dow = new Date(`${ancla}T12:00:00${TZ_OFFSET}`).getUTCDay();
    const diasDesdeLunes = (dow + 6) % 7;
    desde = addDays(inicioDia, -diasDesdeLunes);
    hasta = addDays(desde, 7);
  } else {
    const y = Number(ancla.slice(0, 4));
    const m = Number(ancla.slice(5, 7));
    desde = new Date(`${y}-${pad(m)}-01T00:00:00${TZ_OFFSET}`);
    const my = m === 12 ? y + 1 : y;
    const mm = m === 12 ? 1 : m + 1;
    hasta = new Date(`${my}-${pad(mm)}-01T00:00:00${TZ_OFFSET}`);
  }
  return { vista, desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/** Fecha de hoy en Argentina (YYYY-MM-DD), usando el offset fijo -03:00. */
function hoyArgentina(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
