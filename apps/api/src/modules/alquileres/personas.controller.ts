import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactosInputSchema, CuentasBancariasInputSchema, PersonaInputSchema, ROLES_ADMINISTRACION_ALQUILERES, type Persona } from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ctxDe } from '../tablero/tablero.util';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PersonasService } from './personas.service';
import { HistorialService } from './historial';

/** Propietarios, inquilinos y garantes del módulo Alquileres. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/personas')
@Modulo('alquileres')
export class PersonasController {
  constructor(
    private readonly personas: PersonasService,
    private readonly historial: HistorialService,
  ) {}

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
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PersonaInputSchema)) dto: Persona, @CurrentUser() user: AuthPrincipal) {
    return this.personas.actualizar(ctxDe(user), id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra una persona sin historia; si la tiene, responde 409 diciendo qué tiene' })
  borrar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.personas.borrar(ctxDe(user), id);
  }

  @Get(':id/historial')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Quién hizo qué y cuándo con esta persona: altas, cobros, liquidaciones' })
  historialDe(@Param('id', ParseUUIDPipe) id: string) {
    return this.historial.dePersona(id);
  }

  @Get(':id/ficha')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Ficha de la persona: datos, cuentas bancarias, contactos y contratos' })
  ficha(@Param('id', ParseUUIDPipe) id: string) {
    return this.personas.ficha(id);
  }

  @Put(':id/cuentas')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Guarda las cuentas bancarias de la persona (la lista completa); CBU y alias validados' })
  guardarCuentas(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CuentasBancariasInputSchema)) body: z.output<typeof CuentasBancariasInputSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.personas.guardarCuentas(ctxDe(user), id, body.cuentas);
  }

  @Put(':id/contactos')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Guarda los contactos adicionales de la persona (la lista completa)' })
  guardarContactos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ContactosInputSchema)) body: z.output<typeof ContactosInputSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.personas.guardarContactos(ctxDe(user), id, body.contactos);
  }
}
