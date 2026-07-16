import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const STATUS_CODE: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable_entity',
  500: 'internal_error',
};

/** Estructura de error consistente de la API (CLAUDE.md §8). */
interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: unknown; details?: unknown };
        if (Array.isArray(b.message)) {
          message = 'Error de validación.';
          details = b.message;
        } else if (typeof b.message === 'string') {
          message = b.message;
        }
        if (b.details !== undefined) details = b.details;
      }
    } else {
      // Error no controlado: no filtramos el mensaje al cliente, pero lo logueamos.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const code = STATUS_CODE[status] ?? 'error';
    const payload: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
    res.status(status).json(payload);
  }
}
