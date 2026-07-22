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
    // Bucket privado: se guarda la KEY (no una URL pública). El acceso es
    // siempre por URL firmada de vida corta.
    await this.storage.uploadPrivado(BUCKET, path, file.buffer, file.mimetype);

    const foto = await this.db.withTenant((tx) =>
      tx.tasacionFoto.create({
        data: { tenantId, tasacionId, url: path, orden: ordenSiguiente },
      }),
    );
    // Se firma para que el uploader pueda mostrar la foto recién subida.
    const url = await this.storage.signedUrl(BUCKET, path);
    return { id: foto.id, url, orden: foto.orden };
  }

  async eliminar(tasacionId: string, fotoId: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const tasacion = await tx.tasacion.findUnique({ where: { id: tasacionId }, include: tasacionInclude });
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(tasacion, await resolverScope(ctx, tx));

      const foto = tasacion.fotos.find((f) => f.id === fotoId);
      if (!foto) throw new NotFoundException('Foto no encontrada.');

      await tx.tasacionFoto.delete({ where: { id: fotoId } });
      // `foto.url` es una key (subidas nuevas) o una URL pública (legacy);
      // `keyDe` normaliza ambos casos.
      const path = this.storage.keyDe(BUCKET, foto.url);
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
