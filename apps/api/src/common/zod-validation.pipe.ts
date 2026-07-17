import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida (y parsea) la entrada contra un schema Zod. Al fallar lanza un 400 con
 * el formato de error consistente de la API: los issues de Zod viajan en
 * `details` (ver AllExceptionsFilter).
 *
 * Uso: `@Body(new ZodValidationPipe(CreateOperacionSchema)) dto: CreateOperacion`
 * o para query: `@Query(new ZodValidationPipe(KpiFiltroSchema))`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Error de validación.',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
