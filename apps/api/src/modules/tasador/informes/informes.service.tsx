import { Injectable, NotFoundException } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TasacionDto } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../../tablero/scope.util';
import { assertEnScope, tasacionInclude, toDto } from '../tasaciones/tasaciones.service';
import { InformeDocument } from './informe.template';
import { SupabaseStorageService } from './supabase-storage.service';

/** Genera el informe de tasación en PDF y lo sube a Supabase Storage. */
@Injectable()
export class InformesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async generar(id: string, ctx: TenantContext): Promise<{ url: string }> {
    const { dto, tenantNombre, logoUrl, colorPrimario, colorPrimarioOscuro } = await this.db.withTenant(async (tx) => {
      // La fila y el tenant no dependen uno del otro — pedirlos en paralelo
      // ahorra un round trip completo (relevante: Render/Supabase están en
      // regiones distintas, cada ida y vuelta de más se siente).
      const [row, tenant, scope] = await Promise.all([
        tx.tasacion.findUnique({ where: { id }, include: tasacionInclude }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
        resolverScope(ctx, tx),
      ]);
      if (!row) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(row, scope);

      const config = tenant.config as { logoUrl?: string; colorPrimario?: string; colorPrimarioOscuro?: string } | null;
      return {
        dto: toDto(row) as TasacionDto,
        tenantNombre: tenant.nombre,
        logoUrl: config?.logoUrl ?? null,
        colorPrimario: config?.colorPrimario ?? null,
        colorPrimarioOscuro: config?.colorPrimarioOscuro ?? null,
      };
    });

    const buffer = await renderToBuffer(
      <InformeDocument
        tasacion={dto}
        tenantNombre={tenantNombre}
        logoUrl={logoUrl}
        colorPrimario={colorPrimario}
        colorPrimarioOscuro={colorPrimarioOscuro}
      />,
    );
    const url = await this.storage.upload('informes-tasador', `${ctx.tenantId}/${id}.pdf`, buffer, 'application/pdf');

    await this.db.withTenant((tx) =>
      tx.informeGenerado.create({ data: { tenantId: ctx.tenantId, tasacionId: id, url } }),
    );

    return { url };
  }
}
