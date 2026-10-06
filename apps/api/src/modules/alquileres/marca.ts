import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';

export interface Marca {
  nombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}

/** Nombre, logo y color de la inmobiliaria, para el encabezado de sus documentos. */
export function marcaDe(db: TenantPrismaService, ctx: TenantContext): Promise<Marca> {
  return db.withTenant(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    const config = tenant.config as { logoUrl?: string; colorPrimario?: string } | null;
    return {
      nombre: tenant.nombre,
      logoUrl: config?.logoUrl ?? null,
      colorPrimario: config?.colorPrimario ?? null,
    };
  }, ctx);
}
