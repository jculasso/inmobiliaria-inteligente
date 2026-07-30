import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GuardarCredencialSchema,
  ImportarSchema,
  ROLES_PUBLICACION,
  type GuardarCredencial,
  type Importar,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { PublicacionService } from './publicacion.service';

/**
 * Configuración del módulo de Publicación.
 *
 * Los roles salen de `ROLES_PUBLICACION` (@vacker/types), la MISMA constante que
 * usa el front: tenerla duplicada ya causó un 403 que se veía como un error de
 * conexión.
 */
@ApiTags('publicacion')
@ApiBearerAuth()
@Controller('publicacion')
@Modulo('publicacion')
export class PublicacionController {
  constructor(private readonly publicacion: PublicacionService) {}

  @Get('credencial')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Si la clave de Tokko está cargada (nunca devuelve el valor)' })
  estado() {
    return this.publicacion.estado();
  }

  @Put('credencial')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Carga o reemplaza la clave de Tokko (se guarda cifrada)' })
  guardar(
    @Body(new ZodValidationPipe(GuardarCredencialSchema)) dto: GuardarCredencial,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.publicacion.guardar(dto.secreto, ctxDe(user));
  }

  @Delete('credencial')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Quita la clave de Tokko' })
  borrar() {
    return this.publicacion.borrar();
  }

  /**
   * POST y no GET porque sale a la red hacia un tercero: no es una lectura
   * cacheable y no queremos que un prefetch del navegador la dispare sola.
   */
  @Post('credencial/probar')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Prueba la conexión con Tokko y devuelve cuántas propiedades ve' })
  probar() {
    return this.publicacion.probarConexion();
  }

  @Get('propiedades')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Propiedades ya traídas de Tokko' })
  propiedades() {
    return this.publicacion.listar();
  }

  /**
   * Trae de Tokko las N más recientes. Es una LECTURA: no modifica nada en
   * Tokko. POST y no GET porque sale a la red y escribe en nuestra base.
   */
  @Post('propiedades/importar')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Trae desde Tokko las N propiedades más recientes' })
  importar(
    @Query(new ZodValidationPipe(ImportarSchema)) query: Importar,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.publicacion.importar(query.cuantas, ctxDe(user));
  }

  @Delete('propiedades')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Vacía el espejo local de propiedades (no toca Tokko)' })
  vaciarPropiedades() {
    return this.publicacion.vaciarPropiedades();
  }
}
