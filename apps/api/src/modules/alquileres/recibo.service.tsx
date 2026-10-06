import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CobrosService } from './cobros.service';
import { ReciboDocument } from './recibo.template';

/** El recibo de un cobro en PDF (regla 23). */
@Injectable()
export class ReciboService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cobros: CobrosService,
  ) {}

  async generar(ctx: TenantContext, cobroId: string): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El MISMO método que sirve la pantalla: el recibo no puede decir otra cosa.
    const [cobro, marca] = await Promise.all([
      this.cobros.obtener(cobroId),
      this.db.withTenant(async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
        const config = tenant.config as { logoUrl?: string; colorPrimario?: string } | null;
        return { nombre: tenant.nombre, logoUrl: config?.logoUrl ?? null, colorPrimario: config?.colorPrimario ?? null };
      }, ctx),
    ]);
    const buffer = await renderToBuffer(
      <ReciboDocument cobro={cobro} tenantNombre={marca.nombre} logoUrl={marca.logoUrl} colorPrimario={marca.colorPrimario} />,
    );
    return { buffer, nombreArchivo: `Recibo-${String(cobro.numero).padStart(6, '0')}` };
  }
}
