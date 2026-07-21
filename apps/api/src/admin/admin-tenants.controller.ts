import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  type CreateTenant,
  type UpdateTenant,
} from '@vacker/types';
import { Roles } from '../auth/decorators';
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
  @UseInterceptors(FileInterceptor('file'))
  subirLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: LogoFile | undefined) {
    if (!file) throw new BadRequestException('Falta el archivo.');
    return this.tenants.subirLogo(id, file);
  }
}
