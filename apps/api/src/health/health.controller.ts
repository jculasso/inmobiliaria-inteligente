import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
