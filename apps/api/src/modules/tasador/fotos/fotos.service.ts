import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../../tablero/scope.util';
import { assertEnScope, tasacionInclude } from '../tasaciones/tasaciones.service';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';

const BUCKET = 'tasador-fotos';
const MAX_FOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

export interface FotoFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Fotos de la propiedad (hasta 3 por tasación): sube a Storage y guarda la fila con `orden` incremental. */
@Injectable()
export class FotosService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async subir(tasacionId: string, file: FotoFile, ctx: TenantContext) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('La imagen no puede superar los 5MB.');
    }

    const { tenantId, ordenSiguiente } = await this.db.withTenant(async (tx) => {
      const tasacion = await tx.tasacion.findUnique({ where: { id: tasacionId }, include: tasacionInclude });
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(tasacion, await resolverScope(ctx, tx));

      if (tasacion.fotos.length >= MAX_FOTOS) {
        throw new BadRequestException(`Ya se cargaron el máximo de ${MAX_FOTOS} fotos.`);
      }

      return { tenantId: tasacion.tenantId, ordenSiguiente: tasacion.fotos.length };
    });

    const ext = extensionDe(file.mimetype, file.originalname);
    const path = `${tenantId}/${tasacionId}/${randomUUID()}${ext}`;
    const fotoUrl = await this.storage.upload(BUCKET, path, file.buffer, file.mimetype);

    return this.db.withTenant(async (tx) => {
      const foto = await tx.tasacionFoto.create({
        data: { tenantId, tasacionId, url: fotoUrl, orden: ordenSiguiente },
      });
      return { id: foto.id, url: foto.url, orden: foto.orden };
    });
  }

  async eliminar(tasacionId: string, fotoId: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const tasacion = await tx.tasacion.findUnique({ where: { id: tasacionId }, include: tasacionInclude });
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(tasacion, await resolverScope(ctx, tx));

      const foto = tasacion.fotos.find((f) => f.id === fotoId);
      if (!foto) throw new NotFoundException('Foto no encontrada.');

      await tx.tasacionFoto.delete({ where: { id: fotoId } });
      const path = foto.url.split(`/${BUCKET}/`)[1];
      if (path) await this.storage.remove(BUCKET, path);
      return { id: fotoId };
    });
  }
}

function extensionDe(mimetype: string, originalname: string): string {
  const fromName = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  if (fromName) return fromName;
  const sub = mimetype.split('/')[1];
  return sub ? `.${sub}` : '';
}
