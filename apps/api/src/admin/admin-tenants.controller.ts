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
import { uploadUnArchivo } from '../common/upload';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateTenantSchema,
  GuardarCredencialSchema,
  UpdateTenantSchema,
  type CreateTenant,
  type GuardarCredencial,
  type UpdateTenant,
} from '@vacker/types';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthPrincipal } from '../auth/auth-principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminTenantsService, type LogoFile } from './admin-tenants.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly tenants: AdminTenantsService) {}

  @Get()
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Lista todas las inmobiliarias (cross-tenant)' })
  list() {
    return this.tenants.list();
  }

  @Post()
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Alta de una inmobiliaria' })
  create(@Body(new ZodValidationPipe(CreateTenantSchema)) dto: CreateTenant) {
    return this.tenants.create(dto);
  }

  @Patch(':id')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Edita una inmobiliaria (nombre, slug, plan, estado, branding)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTenantSchema)) dto: UpdateTenant,
  ) {
    return this.tenants.update(id, dto);
  }

  @Post(':id/logo')
  @Roles('admin_plataforma')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube (o reemplaza) el logo de la inmobiliaria (5MB, imagen)' })
  @UseInterceptors(FileInterceptor('file', uploadUnArchivo))
  subirLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: LogoFile | undefined) {
    if (!file) throw new BadRequestException('Falta el archivo.');
    return this.tenants.subirLogo(id, file);
  }

  // --- Credencial de Tokko de la inmobiliaria ---
  //
  // Está acá y no en el módulo de Publicación porque cargar una API key es
  // configuración de alta, no una tarea diaria: en la pantalla donde se publica
  // cualquiera con rol `publicador` podía reemplazarla y romper la integración.

  @Get(':id/credencial')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Si la clave de Tokko está cargada (nunca devuelve el valor)' })
  credencial(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.credencial(id);
  }

  @Put(':id/credencial')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Carga o reemplaza la clave de Tokko (se guarda cifrada)' })
  guardarCredencial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GuardarCredencialSchema)) dto: GuardarCredencial,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tenants.guardarCredencial(id, dto.secreto, user.userId);
  }

  @Delete(':id/credencial')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Quita la clave de Tokko' })
  borrarCredencial(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.borrarCredencial(id);
  }

  @Post(':id/credencial/probar')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Prueba la conexión con Tokko y devuelve cuántas propiedades ve' })
  probarCredencial(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.probarCredencial(id);
  }
}
