import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ReporteSemanal } from '@vacker/types';
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

  /**
   * @param yaCalculado el reporte y la inmobiliaria, si quien llama ya los
   *   tiene. El mail del lunes los calcula para armar el cuerpo, y sin esto el
   *   PDF los volvía a pedir: una segunda corrida del reporte entero y otra
   *   lectura de la inmobiliaria, por cada inmobiliaria, en el mismo cron.
   */
  async generar(
    ctx: TenantContext,
    yaCalculado?: { reporte: ReporteSemanal; tenant: TenantDelReporte },
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El MISMO método que sirve la pantalla: el PDF no puede contar distinto
    // que lo que el CEO acaba de ver. Sin firmar fotos: el PDF no las dibuja.
    const [reporte, tenant] = yaCalculado
      ? [yaCalculado.reporte, yaCalculado.tenant]
      : await Promise.all([
          this.protocolos.reporteSemanal(ctx, { firmarFotos: false }),
          this.db.withTenant(
            (tx) =>
              tx.tenant.findUniqueOrThrow({
                where: { id: ctx.tenantId },
                select: { nombre: true, config: true },
              }),
            ctx,
          ),
        ]);
    const config = tenant.config as { logoUrl?: string; colorPrimario?: string } | null;
    const marca = {
      nombre: tenant.nombre,
      logoUrl: config?.logoUrl ?? null,
      colorPrimario: config?.colorPrimario ?? null,
    };

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

/** Lo que el PDF usa de la inmobiliaria: el nombre y la marca. */
export interface TenantDelReporte {
  nombre: string;
  config: unknown;
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
