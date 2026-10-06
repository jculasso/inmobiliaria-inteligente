import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  TodoEstadoDto,
  TodoEventoDto,
  TodoEventosDto,
  TodoEventosQuery,
  TodoVista,
} from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { GoogleService, type GoogleEvento } from './google.service';
import { desencriptarSecreto, encriptarSecreto } from '../../common/cripto-secreto';
import { esOrigenPermitido } from '../../common/cors';

// Argentina no tiene horario de verano: offset fijo -03:00. Los rangos día/
// semana/mes se calculan en hora local y se mandan a Google en UTC.
const TZ_OFFSET = '-03:00';
/** El `state` del OAuth vence a los 10 minutos (anti-replay). */
const STATE_TTL_MS = 10 * 60 * 1000;
/**
 * El ticket de inicio vence a los 2 minutos y sirve una sola vez. La web lo
 * pide y navega a él en el mismo instante; un enlace que se reenvía a otra
 * persona tiene que estar muerto cuando llegue.
 */
const TICKET_TTL_MS = 2 * 60 * 1000;

/** Cookie que ata el navegador que inició la conexión con el que la termina. */
export const COOKIE_NONCE = 'todo_google_nonce';
/** La cookie solo viaja a las rutas del flujo de Google, a ninguna otra. */
export const COOKIE_PATH = '/todo/google';

/** De dónde vino la navegación al inicio del flujo (cabeceras del navegador). */
export interface Navegacion {
  secFetchSite?: string;
  referer?: string;
  userAgent?: string;
}
/** Cache corto de eventos por usuario+rango, para no pegarle a Google en cada cambio de vista. */
const CACHE_TTL_MS = 30 * 1000;

@Injectable()
export class TodoService {
  private readonly cache = new Map<string, { exp: number; data: TodoEventosDto }>();
  /**
   * Tickets ya usados, con su vencimiento. En memoria: si la API se reinicia
   * se pierde la lista, pero los tickets vencen a los 2 minutos igual, así
   * que lo peor que puede pasar es que uno sirva dos veces en esa ventana.
   */
  private readonly ticketsUsados = new Map<string, number>();

  constructor(
    private readonly db: TenantPrismaService,
    private readonly google: GoogleService,
    private readonly config: ConfigService,
  ) {}

  private encKey(): string | undefined {
    return this.config.get<string>('GOOGLE_TOKEN_ENC_KEY');
  }

  /**
   * Paso 1 (con sesión): devuelve a dónde navegar para conectar el calendario.
   *
   * **No es la URL de Google**, y eso es lo que cierra el agujero del
   * 6/10/2026. Antes devolvía directamente la URL de Google con un `state`
   * firmado que decía «quien termine esto es el usuario X». Ese enlace se
   * podía mandar a otra persona: al aceptar en Google, SU calendario quedaba
   * vinculado a la cuenta de X, que pasaba a leerlo entero.
   *
   * Ahora devuelve un ticket de un solo uso en la propia API (`/iniciar`). La
   * web navega ahí —navegación de página completa, no `fetch`—, y ese paso
   * deja en el navegador una cookie con un número al azar que también viaja
   * cifrado dentro del `state`. El callback exige que los dos coincidan: el
   * flujo solo se puede terminar en el MISMO navegador que lo empezó.
   *
   * La cookie no se puede poner en este paso: la web lo pide con `fetch`, y
   * una cookie que llega en la respuesta de un `fetch` a otro dominio la
   * descarta el navegador. Por eso hay un paso intermedio con navegación real.
   */
  connect(ctx: TenantContext, userAgent?: string): { url: string } {
    this.google.assertConfigurado();
    const ticket = encriptarSecreto(
      JSON.stringify({
        k: 'ticket',
        t: ctx.tenantId,
        u: ctx.userId,
        ts: Date.now(),
        j: randomUUID(),
        ua: huella(userAgent),
      } satisfies TicketPayload),
      this.encKey(),
    );
    const iniciar = new URL('iniciar', this.google.redirectUri());
    iniciar.searchParams.set('t', ticket);
    return { url: iniciar.toString() };
  }

  /**
   * Paso 2 (sin sesión, navegación del navegador): canjea el ticket por la URL
   * de Google y por el número que va a la cookie. Falla si el ticket venció,
   * ya se usó, o si la navegación no salió de nuestra web (un enlace pegado en
   * un mail o en un chat llega sin ese origen).
   */
  iniciar(ticket: string, nav: Navegacion): { nonce: string; url: string } {
    const p = this.descifrar<TicketPayload>(ticket, 'ticket', TICKET_TTL_MS);
    if (!p.j || this.ticketsUsados.has(p.j)) {
      throw new BadRequestException('Este enlace ya se usó. Volvé a conectar desde la app.');
    }
    if (!this.vieneDeLaWeb(nav)) {
      throw new ForbiddenException('La conexión con Google se inicia desde la app.');
    }
    if (p.ua !== huella(nav.userAgent)) {
      throw new ForbiddenException(
        'La conexión con Google se tiene que terminar en el mismo navegador.',
      );
    }
    this.marcarUsado(p.j, p.ts + TICKET_TTL_MS);

    const nonce = randomBytes(32).toString('base64url');
    const state = encriptarSecreto(
      JSON.stringify({
        k: 'state',
        t: p.t,
        u: p.u,
        ts: Date.now(),
        n: nonce,
      } satisfies StatePayload),
      this.encKey(),
    );
    return { nonce, url: this.google.buildAuthUrl(state) };
  }

  /**
   * Paso 3 (callback público): valida el `state` contra la cookie del
   * navegador, vuelve a mirar que el usuario siga habilitado, canjea el
   * `code`, guarda el refresh token encriptado y devuelve a dónde volver.
   */
  async handleCallback(code: string, state: string, nonceCookie?: string): Promise<string> {
    const p = this.descifrar<StatePayload>(state, 'state', STATE_TTL_MS);
    if (!p.n || !nonceCookie || !mismoTexto(p.n, nonceCookie)) {
      throw new ForbiddenException(
        'La conexión con Google se tiene que terminar en el mismo navegador.',
      );
    }
    const tenantId = p.t;
    const userId = p.u;
    const ctx: TenantContext = { tenantId, userId, roles: [] };

    // Pudieron pasar hasta 10 minutos desde que pidió el enlace: si en el
    // medio lo dieron de baja o suspendieron la inmobiliaria, no se vincula
    // nada a una cuenta que ya no puede entrar.
    const habilitado = await this.db.withTenant(
      (tx) =>
        tx.usuario.findFirst({
          where: { id: userId, estado: 'activo', tenant: { estado: 'activo' } },
          select: { id: true },
        }),
      ctx,
    );
    if (!habilitado) {
      throw new ForbiddenException('El usuario ya no está habilitado.');
    }

    const { refreshToken, accessToken } = await this.google.exchangeCode(code);
    if (!refreshToken) {
      // Sin refresh token no podemos releer el calendario después. Con
      // prompt=consent Google siempre lo manda; si faltara, algo raro pasó.
      return this.volverAWeb('error');
    }
    const googleEmail = await this.google.getPrimaryEmail(accessToken);
    const refreshTokenEnc = encriptarSecreto(refreshToken, this.encKey());

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

  /** A dónde volver si algo del flujo falla: la pantalla del To Do, con el aviso. */
  urlDeError(): string {
    return this.volverAWeb('error');
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

    const refreshToken = desencriptarSecreto(cuenta.refreshTokenEnc, this.encKey());
    const accessToken = await this.google.refreshAccessToken(refreshToken);
    const crudos = await this.google.listEvents(accessToken, rango.desde, rango.hasta);

    const data: TodoEventosDto = {
      vista: rango.vista,
      desde: rango.desde,
      hasta: rango.hasta,
      eventos: crudos.map(mapEvento),
    };
    this.cache.set(cacheKey, { exp: Date.now() + CACHE_TTL_MS, data });
    // Barrido ocasional de entradas vencidas: el cache es por (usuario, vista,
    // fecha), así que sin esto acumularía claves indefinidamente (leak lento).
    // Mismo criterio que el principalCache del auth guard.
    if (this.cache.size > 200) this.pruneExpired();
    return data;
  }

  /** Elimina del cache las entradas ya vencidas (evita crecimiento sin techo). */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, val] of this.cache) {
      if (val.exp <= now) this.cache.delete(key);
    }
  }

  /** Descifra un ticket o un `state` y verifica su tipo y su vencimiento. */
  private descifrar<T extends { k: string; t: string; u: string; ts: number }>(
    valor: string,
    tipo: T['k'],
    ttlMs: number,
  ): T {
    let payload: Partial<T>;
    try {
      payload = JSON.parse(desencriptarSecreto(valor, this.encKey())) as Partial<T>;
    } catch {
      throw new BadRequestException('El parámetro de estado del OAuth es inválido.');
    }
    // El tipo importa: ticket y `state` se cifran con la misma clave, y sin
    // esto un `state` serviría como ticket (o al revés).
    if (
      payload.k !== tipo ||
      !payload.t ||
      !payload.u ||
      !payload.ts ||
      Date.now() - payload.ts > ttlMs
    ) {
      throw new BadRequestException(
        'El estado del OAuth venció o es inválido. Reintentá la conexión.',
      );
    }
    return payload as T;
  }

  /**
   * ¿La navegación al inicio del flujo salió de nuestra web? `Sec-Fetch-Site`
   * lo pone el navegador y la página no lo puede falsificar: desde la app
   * (app.… → api.…) llega `same-site`; desde un enlace en un mail o un chat,
   * `none` o `cross-site`. Las previews de Vercel son de otro sitio, y para
   * ellas —y para navegadores viejos sin esa cabecera— se mira el `Referer`,
   * que la web manda con su origen (`strict-origin-when-cross-origin`).
   */
  private vieneDeLaWeb(nav: Navegacion): boolean {
    if (nav.secFetchSite === 'same-origin' || nav.secFetchSite === 'same-site') return true;
    if (nav.secFetchSite === 'none' || !nav.referer) return false;
    let origen: string;
    try {
      origen = new URL(nav.referer).origin;
    } catch {
      return false;
    }
    const web = this.config.get<string>('WEB_APP_URL');
    return esOrigenPermitido(origen) || (web !== undefined && new URL(web).origin === origen);
  }

  private marcarUsado(jti: string, vence: number): void {
    const ahora = Date.now();
    for (const [j, exp] of this.ticketsUsados) if (exp <= ahora) this.ticketsUsados.delete(j);
    this.ticketsUsados.set(jti, vence);
  }

  private volverAWeb(estado: 'conectado' | 'error'): string {
    const base = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000';
    return `${base}/todo?google=${estado}`;
  }
}

interface TicketPayload {
  k: 'ticket';
  t: string;
  u: string;
  ts: number;
  /** Identificador del ticket, para que sirva una sola vez. */
  j: string;
  /** Huella del navegador que lo pidió. */
  ua: string;
}

interface StatePayload {
  k: 'state';
  t: string;
  u: string;
  ts: number;
  /** El mismo número que queda en la cookie del navegador que inició. */
  n: string;
}

/**
 * Huella corta del navegador. No es un secreto ni una identificación: solo
 * hace que un ticket pedido desde la compu de uno no sirva en el celular de
 * otro aunque se lo reenvíen dentro de los dos minutos.
 */
function huella(userAgent: string | undefined): string {
  return createHash('sha256')
    .update(userAgent ?? '')
    .digest('base64url')
    .slice(0, 16);
}

/** Comparación en tiempo constante: con `===`, la demora revela cuánto coincide. */
function mismoTexto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
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
function rangoDe(
  vista: TodoVista,
  fecha?: string,
): { vista: TodoVista; desde: string; hasta: string } {
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
