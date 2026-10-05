import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PropiedadAlquilerInputSchema, ROLES_ADMINISTRACION_ALQUILERES, type PropiedadAlquiler } from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ctxDe } from '../tablero/tablero.util';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PropiedadesAlquilerService } from './propiedades.service';

/** Las unidades que se alquilan, en el módulo Alquileres. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/propiedades')
@Modulo('alquileres')
export class PropiedadesAlquilerController {
  constructor(private readonly propiedades: PropiedadesAlquilerService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Propiedades del módulo, por dirección' })
  listar() {
    return this.propiedades.listar();
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Da de alta una propiedad' })
  crear(@Body(new ZodValidationPipe(PropiedadAlquilerInputSchema)) dto: PropiedadAlquiler, @CurrentUser() user: AuthPrincipal) {
    return this.propiedades.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita una propiedad' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PropiedadAlquilerInputSchema)) dto: PropiedadAlquiler) {
    return this.propiedades.actualizar(id, dto);
  }
}
