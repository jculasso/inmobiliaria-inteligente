import { Injectable } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { mesesDelRango } from '@vacker/domain';
import type { InformePeriodoQuery, InformePropietarioDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CobrosService } from './cobros.service';
import { InformePropietarioService } from './informe-propietario.service';
import { InformePropietarioDocument } from './informe-propietario.template';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionDocument } from './liquidacion.template';
import { marcaDe } from './marca';
import { ReciboDocument } from './recibo.template';

const numero = (n: number) => String(n).padStart(6, '0');

/**
 * Los PDF del módulo: el recibo de un cobro, la liquidación al propietario
 * (regla 23) y el informe al propietario (regla 95).
 */
@Injectable()
export class ReciboService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cobros: CobrosService,
    private readonly liquidaciones: LiquidacionesService,
    private readonly informes: InformePropietarioService,
  ) {}

  async generar(
    ctx: TenantContext,
    cobroId: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // El MISMO método que sirve la pantalla: el recibo no puede decir otra cosa.
    const [cobro, marca] = await Promise.all([this.cobros.obtener(cobroId), marcaDe(this.db, ctx)]);
    const buffer = await renderToBuffer(
      <ReciboDocument
        cobro={cobro}
        tenantNombre={marca.nombre}
        logoUrl={marca.logoUrl}
        colorPrimario={marca.colorPrimario}
      />,
    );
    return { buffer, nombreArchivo: `Recibo-${numero(cobro.numero)}` };
  }

  async liquidacion(
    ctx: TenantContext,
    id: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const [liq, marca] = await Promise.all([this.liquidaciones.obtener(id), marcaDe(this.db, ctx)]);
    const buffer = await renderToBuffer(
      <LiquidacionDocument
        liquidacion={liq}
        tenantNombre={marca.nombre}
        logoUrl={marca.logoUrl}
        colorPrimario={marca.colorPrimario}
      />,
    );
    return { buffer, nombreArchivo: `Liquidacion-${numero(liq.numero)}` };
  }

  async informePropietario(
    ctx: TenantContext,
    personaId: string,
    q: InformePeriodoQuery,
  ): Promise<{ buffer: Buffer; nombreArchivo: string; informe: InformePropietarioDto }> {
    // El MISMO cálculo que la pantalla (regla 95): el PDF no puede decir otra cosa.
    const [informe, marca] = await Promise.all([
      this.informes.informe(personaId, q),
      marcaDe(this.db, ctx),
    ]);
    const buffer = await renderToBuffer(
      <InformePropietarioDocument
        informe={informe}
        tenantNombre={marca.nombre}
        logoUrl={marca.logoUrl}
        colorPrimario={marca.colorPrimario}
      />,
    );
    const meses = mesesDelRango(q.desde, q.hasta);
    const periodo = meses.length === 1 ? q.desde : `${q.desde}_${q.hasta}`;
    // Sin espacios ni barras: el nombre viaja en la cabecera y en el adjunto del mail.
    const nombre = informe.persona.nombre.trim().replace(/[\s/\\]+/g, '-');
    return { buffer, nombreArchivo: `Informe-${nombre}-${periodo}`, informe };
  }
}
