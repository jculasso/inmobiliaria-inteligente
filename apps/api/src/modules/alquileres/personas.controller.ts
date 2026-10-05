import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PersonaInputSchema, ROLES_ADMINISTRACION_ALQUILERES, type Persona } from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ctxDe } from '../tablero/tablero.util';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PersonasService } from './personas.service';

/** Propietarios, inquilinos y garantes del módulo Alquileres. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/personas')
@Modulo('alquileres')
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Personas del módulo, por nombre' })
  listar() {
    return this.personas.listar();
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Da de alta una persona' })
  crear(@Body(new ZodValidationPipe(PersonaInputSchema)) dto: Persona, @CurrentUser() user: AuthPrincipal) {
    return this.personas.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita una persona' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PersonaInputSchema)) dto: Persona) {
    return this.personas.actualizar(id, dto);
  }
}
