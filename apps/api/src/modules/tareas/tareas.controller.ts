import { timingSafeEqual } from 'node:crypto';
import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { IndicesService, type ResultadoIndice } from '../alquileres/indices.service';
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
  constructor(
    private readonly tareas: TareasService,
    private readonly indices: IndicesService,
  ) {}

  @Post('reporte-semanal')
  @Public()
  async reporteSemanal(@Headers('x-cron-secret') secreto?: string): Promise<ResumenCorrida> {
    verificarSecreto(secreto);
    return this.tareas.enviarReportesSemanales();
  }

  /**
   * Trae los valores nuevos del ICL y del IPC (alquileres, regla 8). Es global:
   * los índices son los mismos para todas las inmobiliarias. Un error de una
   * fuente viene en el resultado, no como excepción, para que el workflow lo
   * muestre y falle sin perder lo que sí se cargó de la otra.
   */
  @Post('indices')
  @Public()
  async indicesDiarios(@Headers('x-cron-secret') secreto?: string): Promise<ResultadoIndice[]> {
    verificarSecreto(secreto);
    return this.indices.importar();
  }
}

function verificarSecreto(secreto: string | undefined): void {
  const esperado = process.env.CRON_SECRET;
  // Falla cerrada: sin secreto configurado, nadie entra.
  // Comparación en tiempo constante: con `!==` la demora de la respuesta
  // revela cuántos caracteres del principio son correctos.
  const a = Buffer.from(secreto ?? '');
  const b = Buffer.from(esperado ?? '');
  if (!esperado || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Secreto de tarea inválido.');
  }
}
