import { Controller, Delete, Get, Query, Redirect } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { TodoEventosQuerySchema, type TodoEventosQuery } from '@vacker/types';
import { CurrentUser, Public, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { TodoService } from './todo.service';

@ApiTags('todo')
@Controller('todo')
export class TodoController {
  constructor(
    private readonly todo: TodoService,
    private readonly config: ConfigService,
  ) {}

  @Get('estado')
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Si el usuario actual conectó su Google Calendar' })
  estado(@CurrentUser() user: AuthPrincipal) {
    return this.todo.getEstado(ctxDe(user));
  }

  @Get('google/connect')
  @ApiBearerAuth()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Devuelve la URL de Google para conectar el calendario' })
  connect(@CurrentUser() user: AuthPrincipal) {
    return this.todo.connect(ctxDe(user));
  }

  // Público: Google redirige acá tras el consentimiento, sin nuestro JWT. El
  // usuario se identifica por el `state` firmado. Termina en un redirect a la web.
  @Public()
  @Get('google/callback')
  @Redirect()
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const base = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000';
    if (error || !code || !state) {
      return { url: `${base}/todo?google=error` };
    }
    const url = await this.todo.handleCallback(code, state);
    return { url };
  }

  @Get('eventos')
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
