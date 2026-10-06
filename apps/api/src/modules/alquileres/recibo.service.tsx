import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CobrosService } from './cobros.service';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionDocument } from './liquidacion.template';
import { marcaDe } from './marca';
import { ReciboDocument } from './recibo.template';

const numero = (n: number) => String(n).padStart(6, '0');

/** Los PDF del módulo: el recibo de un cobro y la liquidación al propietario (regla 23). */
@Injectable()
export class ReciboService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cobros: CobrosService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  async generar(ctx: TenantContext, cobroId: string): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El MISMO método que sirve la pantalla: el recibo no puede decir otra cosa.
    const [cobro, marca] = await Promise.all([this.cobros.obtener(cobroId), marcaDe(this.db, ctx)]);
    const buffer = await renderToBuffer(<ReciboDocument cobro={cobro} tenantNombre={marca.nombre} logoUrl={marca.logoUrl} colorPrimario={marca.colorPrimario} />);
    return { buffer, nombreArchivo: `Recibo-${numero(cobro.numero)}` };
  }

  async liquidacion(ctx: TenantContext, id: string): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const [liq, marca] = await Promise.all([this.liquidaciones.obtener(id), marcaDe(this.db, ctx)]);
    const buffer = await renderToBuffer(<LiquidacionDocument liquidacion={liq} tenantNombre={marca.nombre} logoUrl={marca.logoUrl} colorPrimario={marca.colorPrimario} />);
    return { buffer, nombreArchivo: `Liquidacion-${numero(liq.numero)}` };
  }
}
