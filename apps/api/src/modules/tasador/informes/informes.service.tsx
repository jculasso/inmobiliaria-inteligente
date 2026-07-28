import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TasacionDto } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { scopeDePermiso } from '../../tablero/scope.util';
import { assertEnScope, tasacionInclude, toDto } from '../tasaciones/tasaciones.service';
import { InformeDocument } from './informe.template';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';

/** Genera el informe de tasación en PDF y lo sube a Supabase Storage. */
@Injectable()
export class InformesService {
  private readonly logger = new Logger(InformesService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async generar(id: string, ctx: TenantContext): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const { dto, tenantNombre, logoUrl, colorPrimario, colorPrimarioOscuro } = await this.db.withTenant(async (tx) => {
      // La fila y el tenant no dependen uno del otro — pedirlos en paralelo
      // ahorra un round trip completo (relevante: Render/Supabase están en
      // regiones distintas, cada ida y vuelta de más se siente).
      const [row, tenant, scope] = await Promise.all([
        tx.tasacion.findUnique({ where: { id }, include: tasacionInclude }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
        scopeDePermiso(ctx, tx),
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

    // Las fotos viven en un bucket privado: se firman antes de renderizar para
    // que react-pdf pueda bajarlas al armar el PDF (server-side). `logoUrl` es
    // de un bucket público (baja sensibilidad), no necesita firma. Si el firmado
    // falla, el PDF se genera igual sin las fotos (react-pdf tolera imágenes que
    // no cargan) — no vale la pena tumbar todo el informe por eso.
    if (dto.fotos.length > 0) {
      try {
        const keys = dto.fotos.map((f) => this.storage.keyDe('tasador-fotos', f.url));
        const firmadas = await this.storage.signedUrls('tasador-fotos', keys);
        dto.fotos = dto.fotos.map((f, i) => ({ ...f, url: firmadas[i] || f.url }));
      } catch (err) {
        this.logger.warn(
          `No se pudieron firmar las fotos del informe: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const buffer = await renderToBuffer(
      <InformeDocument
        tasacion={dto}
        tenantNombre={tenantNombre}
        logoUrl={logoUrl}
        colorPrimario={colorPrimario}
        colorPrimarioOscuro={colorPrimarioOscuro}
      />,
    );

    // El nombre es el que el navegador sugiere al guardar:
    // "Tasacion {inmobiliaria} - {cliente} - {dirección}".
    const nombreArchivo = nombrePdf(tenantNombre, dto.cliente, dto.direccion);

    // La copia en Storage y el registro de auditoría NO bloquean la respuesta:
    // el usuario ya tiene su PDF. Antes eran tres viajes en serie a Supabase
    // (subir, registrar, firmar) que se esperaban mirando una pestaña vacía.
    void this.archivarCopia(id, ctx, buffer, nombreArchivo);

    return { buffer, nombreArchivo };
  }

  /** Guarda una copia del informe y lo registra. Best-effort: si falla, se loguea. */
  private async archivarCopia(
    tasacionId: string,
    ctx: TenantContext,
    buffer: Buffer,
    nombreArchivo: string,
  ): Promise<void> {
    const pdfPath = `${ctx.tenantId}/${tasacionId}/${nombreArchivo}.pdf`;
    try {
      await this.storage.uploadPrivado('informes-tasador', pdfPath, buffer, 'application/pdf');
      await this.db.withTenant(
        (tx) => tx.informeGenerado.create({ data: { tenantId: ctx.tenantId, tasacionId, url: pdfPath } }),
        ctx,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo archivar la copia del informe ${tasacionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Nombre del archivo del PDF. Se normaliza a ASCII porque Supabase Storage
 * rechaza keys con caracteres no-ASCII (acentos, ñ) con "InvalidKey": se sacan
 * los acentos y se deja solo letras/números/espacio/punto/guion.
 */
function nombrePdf(inmobiliaria: string, cliente: string, direccion: string): string {
  return `Tasacion ${inmobiliaria} - ${cliente} - ${direccion}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
