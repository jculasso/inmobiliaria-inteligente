import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { ProtocolosService } from '../protocolos.service';
import { ReporteSemanalDocument } from './reporte-semanal.template';

/** El reporte semanal en PDF, para imprimir o adjuntar al mail de la dirección. */
@Injectable()
export class ReporteSemanalPdfService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly protocolos: ProtocolosService,
  ) {}

  async generar(ctx: TenantContext): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El MISMO método que sirve la pantalla: el PDF no puede contar distinto
    // que lo que el CEO acaba de ver.
    const [reporte, marca] = await Promise.all([
      this.protocolos.reporteSemanal(ctx),
      this.db.withTenant(async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
        const config = tenant.config as { logoUrl?: string; colorPrimario?: string } | null;
        return {
          nombre: tenant.nombre,
          logoUrl: config?.logoUrl ?? null,
          colorPrimario: config?.colorPrimario ?? null,
        };
      }, ctx),
    ]);

    const buffer = await renderToBuffer(
      <ReporteSemanalDocument
        reporte={reporte}
        tenantNombre={marca.nombre}
        logoUrl={marca.logoUrl}
        colorPrimario={marca.colorPrimario}
      />,
    );

    return { buffer, nombreArchivo: nombrePdf(marca.nombre, reporte.generadoEl) };
  }
}

/**
 * Nombre del archivo, normalizado a ASCII: los acentos y la ñ rompen la
 * cabecera `Content-Disposition` en algunos clientes, y el nombre real ya viaja
 * aparte en `filename*` (ver `pdf-response.ts`).
 */
function nombrePdf(tenant: string, generadoEl: string): string {
  const limpio = tenant
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `Reporte-semanal-${limpio}-${generadoEl}`;
}
