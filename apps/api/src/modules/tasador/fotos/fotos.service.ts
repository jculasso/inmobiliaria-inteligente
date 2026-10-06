import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { scopeDePermiso } from '../../tablero/scope.util';
import { assertEnScope } from '../tasaciones/tasaciones.service';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';
import { extensionDe, tipoDe } from '../../../common/avatar';

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
  private readonly logger = new Logger(FotosService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async subir(tasacionId: string, file: FotoFile, ctx: TenantContext) {
    // El formato se reconoce por los primeros bytes, no por lo que declara el
    // navegador: con `image/*` alcanzaba con decir "soy una imagen" para subir
    // cualquier cosa, y se guardaba con ese tipo. Mismo criterio que el avatar.
    const ext = extensionDe(file);
    if (!ext) {
      throw new BadRequestException('La foto tiene que ser PNG, JPG o WebP.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('La imagen no puede superar los 5MB.');
    }

    const { tenantId, ordenSiguiente } = await this.db.withTenant(async (tx) => {
      // Solo lo que hace falta para el alcance y el tope: antes se traía la
      // tasación entera con comparables y fotos para contar hasta tres.
      const tasacion = await tx.tasacion.findUnique({
        where: { id: tasacionId },
        select: { tenantId: true, agenteId: true, _count: { select: { fotos: true } } },
      });
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(tasacion, await scopeDePermiso(ctx, tx));

      if (tasacion._count.fotos >= MAX_FOTOS) {
        throw new BadRequestException(`Ya se cargaron el máximo de ${MAX_FOTOS} fotos.`);
      }

      return { tenantId: tasacion.tenantId, ordenSiguiente: tasacion._count.fotos };
    });

    const path = `${tenantId}/${tasacionId}/${randomUUID()}${ext}`;
    // Bucket privado: se guarda la KEY (no una URL pública). El acceso es
    // siempre por URL firmada de vida corta.
    await this.storage.uploadPrivado(BUCKET, path, file.buffer, tipoDe(file));

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
    const url = await this.db.withTenant(async (tx) => {
      const tasacion = await tx.tasacion.findUnique({
        where: { id: tasacionId },
        select: { agenteId: true },
      });
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(tasacion, await scopeDePermiso(ctx, tx));

      const foto = await tx.tasacionFoto.findFirst({
        where: { id: fotoId, tasacionId },
        select: { url: true },
      });
      if (!foto) throw new NotFoundException('Foto no encontrada.');

      await tx.tasacionFoto.delete({ where: { id: fotoId } });
      return foto.url;
    });

    // El archivo se borra DESPUÉS de confirmar la transacción, no adentro: una
    // llamada de red a Storage dentro de la transacción la mantiene abierta
    // —con su conexión del pool— mientras Storage responde. La base manda: si
    // el borrado del archivo falla, queda un huérfano en un bucket PRIVADO
    // (nadie lo ve sin URL firmada, y ya nada lo referencia), que es mucho
    // mejor que una foto en la ficha que apunta a un archivo inexistente.
    // `url` es una key (subidas nuevas) o una URL pública (legacy); `keyDe`
    // normaliza ambos casos.
    const path = this.storage.keyDe(BUCKET, url);
    if (path) {
      await this.storage.remove(BUCKET, path).catch((e: unknown) => {
        this.logger.warn(
          `No se pudo borrar ${BUCKET}/${path} de Storage: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
    return { id: fotoId };
  }
}
