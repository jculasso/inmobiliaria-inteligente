import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { TareasService, type ResumenCorrida } from './tareas.service';

/**
 * Tareas programadas, disparadas desde afuera por un cron.
 *
 * NO va detrás de la sesión de un usuario: la corre GitHub Actions, que no
 * tiene con quién loguearse. La puerta es un secreto compartido en la cabecera,
 * y **si el secreto no está configurado el endpoint no funciona**: mejor que la
 * tarea no corra a que quede abierta.
 *
 * Mismo patrón que el keep-alive que ya mantiene despierta la API.
 */
@ApiExcludeController()
@Controller('tareas')
export class TareasController {
  constructor(private readonly tareas: TareasService) {}

  @Post('reporte-semanal')
  @Public()
  async reporteSemanal(@Headers('x-cron-secret') secreto?: string): Promise<ResumenCorrida> {
    const esperado = process.env.CRON_SECRET;
    // Falla cerrada: sin secreto configurado, nadie entra.
    if (!esperado || secreto !== esperado) {
      throw new UnauthorizedException('Secreto de tarea inválido.');
    }
    return this.tareas.enviarReportesSemanales();
  }
}
