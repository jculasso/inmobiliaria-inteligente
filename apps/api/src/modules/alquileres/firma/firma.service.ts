import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CambioFirmaManual,
  DocumentoContratoDto,
  EstadoFirma,
  EstadoFirmante,
  PapelContrato,
} from '@vacker/types';
import { estadoDeFirma } from '@vacker/domain';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { PROVEEDORES_FIRMA, type ProveedorFirma } from './proveedor-firma';

export const BUCKET_CONTRATOS = 'alquileres-contratos';

/** Lo que llega de Multer. */
export interface ArchivoPdf {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

export const INCLUIR_DOCUMENTO = {
  firmantes: {
    include: { persona: { select: { nombre: true } } },
    orderBy: { persona: { nombre: 'asc' as const } },
  },
  eventos: { orderBy: { fecha: 'asc' as const } },
  contrato: { select: { partes: { select: { personaId: true, papel: true } } } },
} satisfies Prisma.AlqDocumentoInclude;

type FilaDocumento = Prisma.AlqDocumentoGetPayload<{ include: typeof INCLUIR_DOCUMENTO }>;

/** Qué es un PDF: el tipo que declara el navegador y la firma de los primeros bytes. */
function esPdf(f: ArchivoPdf): boolean {
  return f.mimetype === 'application/pdf' && f.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * El documento del contrato y su firma (spec alquileres-fase-1.md, reglas 33
 * a 36).
 *
 * El estado solo cambia por dos vías (regla 34): lo que se carga a mano, acá,
 * o el aviso de un proveedor (`FirmaAvisosService`). Cada cambio deja un
 * evento con el estado anterior, el nuevo y el origen. El proveedor se elige
 * con `FIRMA_PROVEEDOR` y, mientras no se contrate uno, es el manual.
 */
@Injectable()
export class FirmaService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
    @Inject(PROVEEDORES_FIRMA) private readonly proveedores: Map<string, ProveedorFirma>,
  ) {}

  private proveedor(): ProveedorFirma {
    const nombre = process.env.FIRMA_PROVEEDOR || 'manual';
    const p = this.proveedores.get(nombre);
    if (!p) throw new BadRequestException(`El proveedor de firma «${nombre}» no está configurado.`);
    return p;
  }

  async obtener(contratoId: string): Promise<{ documento: DocumentoContratoDto | null }> {
    return this.db.withTenant(async (tx) => {
      const d = await tx.alqDocumento.findUnique({
        where: { contratoId },
        include: INCLUIR_DOCUMENTO,
      });
      return { documento: d ? aDto(d) : null };
    });
  }

  /**
   * Carga (o cambia) el PDF del contrato. Los firmantes son todas las partes:
   * propietarios, inquilinos y garantes. Una vez enviado a firmar, el PDF ya
   * no se cambia: lo que se firma es lo que se envió.
   */
  async cargar(
    ctx: TenantContext,
    contratoId: string,
    archivo: ArchivoPdf,
  ): Promise<DocumentoContratoDto> {
    if (!esPdf(archivo)) throw new BadRequestException('El contrato tiene que ser un PDF.');
    const { partes, existente } = await this.db.withTenant(async (tx) => {
      const c = await tx.alqContrato.findUnique({
        where: { id: contratoId },
        select: { partes: { select: { personaId: true } } },
      });
      if (!c) throw new NotFoundException('El contrato no existe.');
      const d = await tx.alqDocumento.findUnique({
        where: { contratoId },
        select: { id: true, estadoFirma: true },
      });
      if (d && d.estadoFirma !== 'sin_enviar') {
        throw new BadRequestException(
          'El contrato ya se envió a firmar: lo que se firma es el PDF que se envió.',
        );
      }
      return { partes: [...new Set(c.partes.map((p) => p.personaId))], existente: d };
    });

    const path = `${ctx.tenantId}/${contratoId}/${randomUUID()}.pdf`;
    await this.storage.uploadPrivado(BUCKET_CONTRATOS, path, archivo.buffer, 'application/pdf');

    return this.db.withTenant(async (tx) => {
      const id = existente?.id ?? randomUUID();
      if (existente) {
        await tx.alqDocumento.update({
          where: { id },
          data: { archivo: path, nombreArchivo: archivo.originalname },
        });
        await tx.alqFirmante.deleteMany({ where: { documentoId: id } });
      } else {
        await tx.alqDocumento.create({
          data: {
            id,
            tenantId: ctx.tenantId,
            contratoId,
            archivo: path,
            nombreArchivo: archivo.originalname,
            estadoFirma: 'sin_enviar',
          },
        });
      }
      await tx.alqFirmante.createMany({
        data: partes.map((personaId) => ({ tenantId: ctx.tenantId, documentoId: id, personaId })),
      });
      await evento(
        tx,
        ctx.tenantId,
        id,
        existente ? 'sin_enviar' : null,
        'sin_enviar',
        'manual',
        existente ? 'Se cambió el PDF.' : 'Se cargó el PDF.',
      );
      return this.leer(tx, id);
    });
  }

  /** Lo manda a firmar con el proveedor configurado. Con el manual, lo marca como enviado. */
  async enviar(ctx: TenantContext, documentoId: string): Promise<DocumentoContratoDto> {
    const proveedor = this.proveedor();
    const d = await this.db.withTenant((tx) => this.leer(tx, documentoId));
    if (!d.nombreArchivo)
      throw new BadRequestException('Primero hay que cargar el PDF del contrato.');
    if (d.estadoFirma === 'firmado' || d.estadoFirma === 'firmado_parcial') {
      throw new BadRequestException('El contrato ya tiene firmas: no se vuelve a enviar.');
    }
    const { personas, archivo } = await this.db.withTenant(async (tx) => ({
      personas: await tx.alqPersona.findMany({
        where: { id: { in: d.firmantes.map((f) => f.personaId) } },
        select: { id: true, nombre: true, email: true },
      }),
      archivo: (
        await tx.alqDocumento.findUniqueOrThrow({
          where: { id: documentoId },
          select: { archivo: true },
        })
      ).archivo!,
    }));
    const { envioId } = await proveedor.enviar(
      {
        nombre: d.nombreArchivo,
        obtenerPdf: () => this.storage.descargarPrivado(BUCKET_CONTRATOS, archivo),
      },
      personas.map((p) => ({ personaId: p.id, nombre: p.nombre, email: p.email })),
    );
    return this.db.withTenant(async (tx) => {
      await tx.alqDocumento.update({
        where: { id: documentoId },
        data: { estadoFirma: 'enviado', proveedor: proveedor.nombre, envioExternoId: envioId },
      });
      await tx.alqFirmante.updateMany({
        where: { documentoId },
        data: { estado: 'pendiente', firmadoEl: null },
      });
      await evento(
        tx,
        ctx.tenantId,
        documentoId,
        d.estadoFirma,
        'enviado',
        'manual',
        proveedor.nombre === 'manual'
          ? 'Se marcó como enviado.'
          : `Enviado a firmar por ${proveedor.nombre}.`,
      );
      return this.leer(tx, documentoId);
    });
  }

  /** Regla 34, vía manual: quién firmó, o que se envió o venció. El estado del documento sale de los firmantes. */
  async cambiar(
    ctx: TenantContext,
    documentoId: string,
    cambio: CambioFirmaManual,
  ): Promise<DocumentoContratoDto> {
    return this.db.withTenant(async (tx) => {
      const d = await this.leer(tx, documentoId);
      const propios = new Set(d.firmantes.map((f) => f.personaId));
      if (cambio.firmantes.some((f) => !propios.has(f.personaId)))
        throw new BadRequestException('Uno de los firmantes no es parte de este documento.');
      if (cambio.marcar === 'vencido' && d.estadoFirma === 'firmado')
        throw new BadRequestException('Un contrato firmado no vence.');

      const ahora = new Date();
      for (const f of cambio.firmantes) {
        await tx.alqFirmante.update({
          where: { documentoId_personaId: { documentoId, personaId: f.personaId } },
          data: { estado: f.estado, firmadoEl: f.estado === 'firmado' ? ahora : null },
        });
      }
      const estados = d.firmantes.map(
        (f) => cambio.firmantes.find((x) => x.personaId === f.personaId)?.estado ?? f.estado,
      );
      const nuevo = estadoDeFirma(cambio.marcar ?? d.estadoFirma, estados);
      await tx.alqDocumento.update({
        where: { id: documentoId },
        data: {
          estadoFirma: nuevo,
          ...(cambio.marcar === 'enviado' && !d.proveedor ? { proveedor: 'manual' } : {}),
        },
      });
      await evento(tx, ctx.tenantId, documentoId, d.estadoFirma, nuevo, 'manual', cambio.nota);
      return this.leer(tx, documentoId);
    });
  }

  /** Regla 34: se sube el PDF firmado y se marca. Firmaron todos. */
  async cargarFirmado(
    ctx: TenantContext,
    documentoId: string,
    archivo: ArchivoPdf,
  ): Promise<DocumentoContratoDto> {
    if (!esPdf(archivo)) throw new BadRequestException('El contrato firmado tiene que ser un PDF.');
    const d = await this.db.withTenant((tx) => this.leer(tx, documentoId));
    const path = `${ctx.tenantId}/${d.contratoId}/firmado-${randomUUID()}.pdf`;
    await this.storage.uploadPrivado(BUCKET_CONTRATOS, path, archivo.buffer, 'application/pdf');
    return this.db.withTenant(async (tx) => {
      const ahora = new Date();
      await tx.alqFirmante.updateMany({
        where: { documentoId, estado: { not: 'firmado' } },
        data: { estado: 'firmado', firmadoEl: ahora },
      });
      await tx.alqDocumento.update({
        where: { id: documentoId },
        data: { archivoFirmado: path, estadoFirma: 'firmado', proveedor: d.proveedor ?? 'manual' },
      });
      await evento(
        tx,
        ctx.tenantId,
        documentoId,
        d.estadoFirma,
        'firmado',
        'manual',
        'Se cargó el PDF firmado.',
      );
      return this.leer(tx, documentoId);
    });
  }

  /** Un link de vida corta al PDF (el original o el firmado): el bucket es privado. */
  async url(documentoId: string, firmado: boolean): Promise<{ url: string }> {
    const d = await this.db.withTenant((tx) =>
      tx.alqDocumento.findUnique({
        where: { id: documentoId },
        select: { archivo: true, archivoFirmado: true },
      }),
    );
    const path = firmado ? d?.archivoFirmado : d?.archivo;
    if (!path)
      throw new NotFoundException(
        firmado ? 'Todavía no se cargó el contrato firmado.' : 'Todavía no se cargó el PDF.',
      );
    return { url: await this.storage.signedUrl(BUCKET_CONTRATOS, path) };
  }

  private async leer(tx: Tx, id: string): Promise<DocumentoContratoDto> {
    const d = await tx.alqDocumento.findUnique({ where: { id }, include: INCLUIR_DOCUMENTO });
    if (!d) throw new NotFoundException('El documento no existe.');
    return aDto(d);
  }
}

export async function evento(
  tx: Pick<Tx, 'alqFirmaEvento'>,
  tenantId: string,
  documentoId: string,
  anterior: string | null,
  nuevo: string,
  origen: string,
  texto: string | null,
): Promise<void> {
  await tx.alqFirmaEvento.create({
    data: {
      tenantId,
      documentoId,
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
      origen,
      detalle: texto ? { texto } : undefined,
    },
  });
}

export function aDto(d: FilaDocumento): DocumentoContratoDto {
  const papel = (personaId: string): PapelContrato => {
    const papeles = d.contrato.partes.filter((p) => p.personaId === personaId).map((p) => p.papel);
    return (
      papeles.includes('propietario')
        ? 'propietario'
        : papeles.includes('inquilino')
          ? 'inquilino'
          : 'garante'
    ) as PapelContrato;
  };
  return {
    id: d.id,
    contratoId: d.contratoId,
    estadoFirma: d.estadoFirma as EstadoFirma,
    proveedor: d.proveedor,
    nombreArchivo: d.nombreArchivo,
    tieneFirmado: d.archivoFirmado != null,
    firmantes: d.firmantes.map((f) => ({
      personaId: f.personaId,
      nombre: f.persona.nombre,
      papel: papel(f.personaId),
      estado: f.estado as EstadoFirmante,
      firmadoEl: f.firmadoEl?.toISOString() ?? null,
    })),
    eventos: d.eventos.map((e) => ({
      fecha: e.fecha.toISOString(),
      estadoAnterior: (e.estadoAnterior as EstadoFirma | null) ?? null,
      estadoNuevo: e.estadoNuevo as EstadoFirma,
      origen: e.origen,
      detalle: (e.detalle as { texto?: string } | null)?.texto ?? null,
    })),
  };
}
