import { Injectable, Logger } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { ProtocolosService } from '../protocolos.service';
import { InformeProtocoloDocument } from './informe-protocolo.template';

/** Genera el informe de comercialización en PDF y lo sube a Supabase Storage. */
@Injectable()
export class InformeProtocoloService {
  private readonly logger = new Logger(InformeProtocoloService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly protocolos: ProtocolosService,
  ) {}

  async generar(id: string, ctx: TenantContext): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    // `getOne` ya valida alcance por rol y devuelve la foto firmada, que es lo
    // que react-pdf necesita para poder bajarla al armar el PDF (bucket privado).
    const [protocolo, marca] = await Promise.all([
      this.protocolos.getOne(id, ctx),
      this.db.withTenant(async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
        const config = tenant.config as {
          logoUrl?: string;
          colorPrimario?: string;
          colorPrimarioOscuro?: string;
        } | null;
        return {
          nombre: tenant.nombre,
          logoUrl: config?.logoUrl ?? null,
          colorPrimario: config?.colorPrimario ?? null,
          colorPrimarioOscuro: config?.colorPrimarioOscuro ?? null,
        };
      }, ctx),
    ]);

    const buffer = await renderToBuffer(
      <InformeProtocoloDocument
        protocolo={protocolo}
        tenantNombre={marca.nombre}
        logoUrl={marca.logoUrl}
        colorPrimario={marca.colorPrimario}
        colorPrimarioOscuro={marca.colorPrimarioOscuro}
      />,
    );

    // El PDF viaja en la respuesta. Este informe se regenera con un click y
    // siempre refleja el estado del momento, así que no se archiva: subirlo a
    // Storage y firmarlo solo agregaba dos viajes a Supabase antes de mostrarlo.
    return { buffer, nombreArchivo: nombrePdf(marca.nombre, protocolo.propiedad.direccion) };
  }
}

/**
 * Nombre del archivo del PDF, normalizado a ASCII: Supabase Storage rechaza
 * keys con acentos o ñ ("InvalidKey").
 */
function nombrePdf(inmobiliaria: string, direccion: string): string {
  return `Comercializacion ${inmobiliaria} - ${direccion}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
