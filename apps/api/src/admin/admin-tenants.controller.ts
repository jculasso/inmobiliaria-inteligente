import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  type CreateTenant,
  type UpdateTenant,
} from '@vacker/types';
import { Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminTenantsService } from './admin-tenants.service';

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
  @ApiOperation({ summary: 'Edita una inmobiliaria (nombre, plan, estado)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTenantSchema)) dto: UpdateTenant,
  ) {
    return this.tenants.update(id, dto);
  }
}
