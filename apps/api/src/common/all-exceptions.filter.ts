import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const STATUS_CODE: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable_entity',
  500: 'internal_error',
  503: 'service_unavailable',
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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Errores conocidos de Prisma mapeados a HTTP (evita 500 por, p. ej.,
      // violación de índice único bajo carrera). Se loguean siempre con su
      // código y meta — el mensaje que ve el cliente es genérico, pero sin
      // este log la causa real (qué constraint, qué tabla) queda invisible.
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`, JSON.stringify(exception.meta));
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Ya existe un registro con esos datos únicos.';
        details = exception.meta?.target;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Registro no encontrado.';
      } else if (exception.code === 'P2028') {
        // La transacción interactiva de Prisma superó su timeout (ver
        // TenantPrismaService.withTenant) — no es un problema de los datos,
        // es que la operación tardó demasiado (conexión lenta a la base).
        // No hay nada guardado a medias: Postgres deshace toda la transacción.
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'La operación tardó demasiado y se canceló. Probá de nuevo.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'La operación no se pudo completar por una restricción de datos.';
      }
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError &&
      exception.message.includes('numeric field overflow')
    ) {
      // Postgres 22003: un monto superó numeric(14,2). Ya validado con
      // `MontoSchema` en los DTOs, pero se cubre acá también por si algún
      // camino todavía no pasa por Zod (p. ej. un campo agregado sin el tope).
      status = HttpStatus.BAD_REQUEST;
      message = 'Ese monto es demasiado grande.';
    } else {
      // Error no controlado: no filtramos el mensaje al cliente, pero lo logueamos.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const code = STATUS_CODE[status] ?? 'error';
    const payload: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
    res.status(status).json(payload);
  }
}
