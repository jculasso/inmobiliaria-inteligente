import { Injectable } from '@nestjs/common';
import type { ResumenAlquileres } from '@vacker/types';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

/**
 * Módulo Alquileres: administración de contratos (docs/specs/alquileres-fase-1.md).
 *
 * En esta primera entrega solo dice cuánto hay cargado. Todo pasa por
 * `withTenant`: las tablas `alq_*` tienen RLS, y una consulta con
 * `PrismaService` directo devolvería las de todas las inmobiliarias.
 */
@Injectable()
export class AlquileresService {
  constructor(private readonly db: TenantPrismaService) {}

  async resumen(): Promise<ResumenAlquileres> {
    return this.db.withTenant(async (tx) => {
      // Cuatro conteos en paralelo dentro de la misma transacción: una sola ida
      // y vuelta de latencia hacia la base, no cuatro.
      const [contratos, contratosVigentes, personas, propiedades] = await Promise.all([
        tx.alqContrato.count(),
        tx.alqContrato.count({ where: { estado: 'vigente' } }),
        tx.alqPersona.count(),
        tx.alqPropiedad.count(),
      ]);
      return { contratos, contratosVigentes, personas, propiedades };
    });
  }
}
