import { Injectable } from '@nestjs/common';
import {
  TenantConfigSchema,
  type ConfiguracionAlquileres,
  type ResumenAlquileres,
} from '@vacker/types';
import type { Prisma } from '@prisma/client';
import type { TenantContext } from '../../prisma/tenant-context';
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

  /** La configuración del módulo: IVA de honorarios, cargos de ingreso y depósito (entrega 14). */
  async configuracion(ctx: TenantContext): Promise<ConfiguracionAlquileres> {
    return this.db.withTenant(async (tx) => {
      const t = await tx.tenant.findUniqueOrThrow({
        where: { id: ctx.tenantId },
        select: { config: true },
      });
      return deConfig(TenantConfigSchema.parse(t.config ?? {}));
    });
  }

  /** Se mezcla con el resto de la configuración (logo, colores): no se pisa lo que no es del módulo. */
  async guardarConfiguracion(
    ctx: TenantContext,
    dto: ConfiguracionAlquileres,
  ): Promise<ConfiguracionAlquileres> {
    return this.db.withTenant(async (tx) => {
      const t = await tx.tenant.findUniqueOrThrow({
        where: { id: ctx.tenantId },
        select: { config: true },
      });
      const config = { ...((t.config ?? {}) as object), ...dto };
      await tx.tenant.update({
        where: { id: ctx.tenantId },
        data: { config: config as Prisma.InputJsonValue },
      });
      return deConfig(TenantConfigSchema.parse(config));
    });
  }
}

function deConfig(c: ReturnType<typeof TenantConfigSchema.parse>): ConfiguracionAlquileres {
  return {
    ivaHonorariosPct: c.ivaHonorariosPct,
    comisionInicialPct: c.comisionInicialPct,
    comisionInicialCuotas: c.comisionInicialCuotas,
    comisionInicialConIva: c.comisionInicialConIva,
    selladoPct: c.selladoPct,
    selladoInquilinoPct: c.selladoInquilinoPct,
    depositoGestion: c.depositoGestion,
  };
}
