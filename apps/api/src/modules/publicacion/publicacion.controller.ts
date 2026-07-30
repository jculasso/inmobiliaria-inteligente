import { Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImportarSchema, ROLES_PUBLICACION, type Importar } from '@vacker/types';
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

  /**
   * Solo LECTURA del estado. Cargarla o reemplazarla se hace desde el panel de
   * plataforma (`/admin/tenants/:id/credencial`): es configuración de alta, no
   * una tarea del día a día. Acá se muestra para que quien publica sepa si está
   * y a quién pedirle que la cargue, no para que la toque.
   */
  @Get('credencial')
  @Roles(...ROLES_PUBLICACION)
  @ApiOperation({ summary: 'Si la clave de Tokko está cargada (solo lectura)' })
  estado() {
    return this.publicacion.estado();
  }



  /**
   * POST y no GET porque sale a la red hacia un tercero: no es una lectura
   * cacheable y no queremos que un prefetch del navegador la dispare sola.
   */

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
