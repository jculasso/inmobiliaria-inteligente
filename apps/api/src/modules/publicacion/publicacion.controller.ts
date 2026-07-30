import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardarCredencialSchema, type GuardarCredencial } from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { PublicacionService } from './publicacion.service';

/**
 * Configuración del módulo de Publicación.
 *
 * `publicador` es un rol funcional: lo tiene quien carga y publica propiedades.
 * Los admins entran igual sin tenerlo porque son los que van a probar el módulo
 * antes de asignárselo a nadie — mientras nadie tenga `publicador`, el módulo
 * está de hecho apagado para el resto de la inmobiliaria.
 *
 * Dirección NO está: publicar no es una tarea de conducción, y sumar el rol a
 * quien lo necesite es un click en /admin.
 */
const PUEDEN_PUBLICAR = ['publicador', 'admin_tenant'] as const;

@ApiTags('publicacion')
@ApiBearerAuth()
@Controller('publicacion')
@Modulo('publicacion')
export class PublicacionController {
  constructor(private readonly publicacion: PublicacionService) {}

  @Get('credencial')
  @Roles(...PUEDEN_PUBLICAR)
  @ApiOperation({ summary: 'Si la clave de Tokko está cargada (nunca devuelve el valor)' })
  estado() {
    return this.publicacion.estado();
  }

  @Put('credencial')
  @Roles(...PUEDEN_PUBLICAR)
  @ApiOperation({ summary: 'Carga o reemplaza la clave de Tokko (se guarda cifrada)' })
  guardar(
    @Body(new ZodValidationPipe(GuardarCredencialSchema)) dto: GuardarCredencial,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.publicacion.guardar(dto.secreto, ctxDe(user));
  }

  @Delete('credencial')
  @Roles(...PUEDEN_PUBLICAR)
  @ApiOperation({ summary: 'Quita la clave de Tokko' })
  borrar() {
    return this.publicacion.borrar();
  }

  /**
   * POST y no GET porque sale a la red hacia un tercero: no es una lectura
   * cacheable y no queremos que un prefetch del navegador la dispare sola.
   */
  @Post('credencial/probar')
  @Roles(...PUEDEN_PUBLICAR)
  @ApiOperation({ summary: 'Prueba la conexión con Tokko y devuelve cuántas propiedades ve' })
  probar() {
    return this.publicacion.probarConexion();
  }
}
