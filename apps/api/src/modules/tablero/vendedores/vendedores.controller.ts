import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateVendedorSchema,
  ObjetivoInputSchema,
  UpdateVendedorSchema,
  type CreateVendedor,
  type ObjetivoInput,
  type UpdateVendedor,
} from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { uploadUnArchivo } from '../../../common/upload';
import type { AvatarFile } from '../../../common/avatar';
import { ctxDe } from '../tablero.util';
import { VendedoresService } from './vendedores.service';

@ApiTags('tablero')
@ApiBearerAuth()
@Controller('tablero/vendedores')
export class VendedoresController {
  constructor(private readonly vendedores: VendedoresService) {}

  // Ver el equipo con sus objetivos es información de conducción: queda en
  // dirección y en el admin de la inmobiliaria. El team leader dejó de tener
  // acceso el 29/07/2026, por pedido del usuario.
  @Get()
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Lista de usuarios comerciales (roles y objetivos)' })
  list() {
    return this.vendedores.list();
  }

  @Post()
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Alta de un usuario comercial' })
  create(
    @Body(new ZodValidationPipe(CreateVendedorSchema)) dto: CreateVendedor,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.create(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Edita un usuario comercial (datos, roles, líder)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVendedorSchema)) dto: UpdateVendedor,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.update(id, dto, ctxDe(user));
  }

  @Delete(':id')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Baja lógica (marca inactivo)' })
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedores.desactivar(id);
  }

  @Put(':id/objetivo')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Crea/actualiza el objetivo anual del vendedor' })
  setObjetivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ObjetivoInputSchema)) dto: ObjetivoInput,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.setObjetivo(id, dto, ctxDe(user));
  }

  /**
   * La dirección cambia la foto de su equipo sin depender del panel de
   * plataforma: cuando incorpora a alguien, la actualiza en el momento.
   */
  @Post(':id/foto')
  @Roles('direccion', 'admin_tenant')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube (o reemplaza) la foto del vendedor (5MB, imagen)' })
  @UseInterceptors(FileInterceptor('file', uploadUnArchivo))
  subirFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: AvatarFile | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo.');
    return this.vendedores.subirFoto(id, file, ctxDe(user));
  }

  @Delete(':id/foto')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Quita la foto del vendedor' })
  eliminarFoto(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedores.eliminarFoto(id);
  }
}
