import { Controller, Delete, Get, Headers, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TodoEventosQuerySchema, type TodoEventosQuery } from '@vacker/types';
import { CurrentUser, Modulo, Public, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { COOKIE_NONCE, COOKIE_PATH, TodoService } from './todo.service';
import { Costoso } from '../../common/limite-solicitudes';

/** La cookie del flujo dura lo mismo que el `state`: 10 minutos. */
const COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

@ApiTags('todo')
@Modulo('todo')
@Controller('todo')
export class TodoController {
  private readonly logger = new Logger(TodoController.name);

  constructor(private readonly todo: TodoService) {}

  @Get('estado')
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Si el usuario actual conectó su Google Calendar' })
  estado(@CurrentUser() user: AuthPrincipal) {
    return this.todo.getEstado(ctxDe(user));
  }

  /**
   * Devuelve la URL a la que la web tiene que navegar (página completa) para
   * conectar el calendario. No es la de Google: es `/todo/google/iniciar` con
   * un ticket de un solo uso. Ver `TodoService.connect`.
   */
  @Get('google/connect')
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Devuelve la URL para empezar a conectar el calendario' })
  connect(@CurrentUser() user: AuthPrincipal, @Headers('user-agent') userAgent?: string) {
    return this.todo.connect(ctxDe(user), userAgent);
  }

  /**
   * Público: se llega por navegación del navegador, sin nuestro JWT. Canjea el
   * ticket, deja la cookie que ata el flujo a ESTE navegador y manda a Google.
   * Cualquier falla vuelve a la web con el aviso: la PWA instalada no tiene
   * barra de direcciones, y un JSON de error ahí es un callejón sin salida.
   */
  @Public()
  @Get('google/iniciar')
  @ApiExcludeEndpoint()
  iniciar(@Query('t') ticket: string | undefined, @Req() req: Request, @Res() res: Response) {
    try {
      if (!ticket) throw new Error('Falta el ticket.');
      const { nonce, url } = this.todo.iniciar(ticket, {
        secFetchSite: cabecera(req, 'sec-fetch-site'),
        referer: cabecera(req, 'referer'),
        userAgent: cabecera(req, 'user-agent'),
      });
      res.cookie(COOKIE_NONCE, nonce, {
        httpOnly: true,
        // `Lax` y no `Strict`: la vuelta desde Google es una navegación desde
        // otro sitio, y con `Strict` el navegador no mandaría la cookie.
        sameSite: 'lax',
        secure: esHttps(req),
        path: COOKIE_PATH,
        maxAge: COOKIE_MAX_AGE_MS,
      });
      res.redirect(302, url);
    } catch (e) {
      this.logger.warn(`Inicio de conexión con Google rechazado: ${mensaje(e)}`);
      res.redirect(302, this.todo.urlDeError());
    }
  }

  /**
   * Público: Google redirige acá tras el consentimiento, sin nuestro JWT. El
   * usuario se identifica por el `state` cifrado, que además tiene que
   * coincidir con la cookie del navegador. Termina SIEMPRE en un redirect a la
   * web, también cuando falla.
   */
  @Public()
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const nonce = leerCookie(cabecera(req, 'cookie'), COOKIE_NONCE);
    // La cookie es de un solo uso, salga bien o mal.
    res.clearCookie(COOKIE_NONCE, { path: COOKIE_PATH, httpOnly: true, sameSite: 'lax' });
    let url: string;
    try {
      if (error || !code || !state) throw new Error(error ?? 'Faltan parámetros.');
      url = await this.todo.handleCallback(code, state, nonce);
    } catch (e) {
      this.logger.warn(`Callback de Google rechazado: ${mensaje(e)}`);
      url = this.todo.urlDeError();
    }
    res.redirect(302, url);
  }

  @Get('eventos')
  @Costoso(30)
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Eventos del calendario principal (vista dia/semana/mes)' })
  eventos(
    @Query(new ZodValidationPipe(TodoEventosQuerySchema)) query: TodoEventosQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.todo.getEventos(ctxDe(user), query);
  }

  @Delete('google')
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Desconecta el Google Calendar del usuario actual' })
  async desconectar(@CurrentUser() user: AuthPrincipal) {
    await this.todo.desconectar(ctxDe(user));
    return { ok: true };
  }
}

function cabecera(req: Request, nombre: string): string | undefined {
  const v = req.headers[nombre];
  return Array.isArray(v) ? v[0] : v;
}

/** Lee una cookie del encabezado crudo (la API no usa cookie-parser: no tiene sesiones). */
export function leerCookie(encabezado: string | undefined, nombre: string): string | undefined {
  if (!encabezado) return undefined;
  for (const parte of encabezado.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * `Secure` siempre que la request haya llegado por HTTPS. Detrás del proxy de
 * Render eso lo dice `X-Forwarded-Proto` (y `req.secure` lo lee porque
 * `trust proxy` está configurado en main.ts). En local, por http, una cookie
 * `Secure` no se guardaría y el flujo no se podría probar.
 */
function esHttps(req: Request): boolean {
  return req.secure || process.env.NODE_ENV === 'production';
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
