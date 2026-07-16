import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('current')
  @Roles('admin_tenant', 'direccion')
  @ApiOperation({ summary: 'Datos del tenant actual' })
  current() {
    return this.tenants.current();
  }
}
