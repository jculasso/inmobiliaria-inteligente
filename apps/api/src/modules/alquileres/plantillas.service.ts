import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PlantillaDto, PlantillaMetadatos } from '@vacker/types';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { BUCKET_CONTRATOS } from './firma/firma.service';
import { registrarEventos } from './historial';
import { datosDePlantilla, SELECT_PLANTILLA } from './plantilla-modelo';
import { plantillaDeEjemplo } from './plantilla-ejemplo';
import { completarPlantillaWord, problemasDePlantilla, type ArchivoSubido } from './plantilla-word';

export const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Un .docx listo para devolver: los bytes y el nombre con que se guarda. */
export interface Docx {
  buffer: Buffer;
  nombre: string;
}

const SELECT_DTO = {
  id: true,
  nombre: true,
  tipoContrato: true,
  archivo: true,
  nombreArchivo: true,
  tamano: true,
  updatedAt: true,
} as const;

const aDto = (p: {
  id: string;
  nombre: string;
  tipoContrato: string | null;
  archivo: string | null;
  nombreArchivo: string | null;
  tamano: number | null;
  updatedAt: Date;
}): PlantillaDto => ({
  id: p.id,
  nombre: p.nombre,
  tipoContrato: p.tipoContrato as PlantillaDto['tipoContrato'],
  formato: p.archivo ? 'word' : 'texto',
  nombreArchivo: p.nombreArchivo,
  tamano: p.tamano,
  actualizada: p.updatedAt.toISOString(),
});

/**
 * Multer lee el nombre del archivo como latin1, así que «Contrato Peña.docx»
 * llega como «Contrato PeÃ±a.docx». Si al releerlo como UTF-8 queda un texto
 * válido, ese era el nombre real.
 */
export function nombreDelArchivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  return utf8.includes('�') ? original : utf8;
}

/** Revisa el Word y, si algo está mal, lo rechaza nombrando cada marcador. */
function validar(archivo: ArchivoSubido): void {
  const problemas = problemasDePlantilla(archivo);
  if (problemas.length === 0) return;
  throw new BadRequestException({
    message:
      problemas.length === 1
        ? problemas[0]
        : `La plantilla tiene ${problemas.length} problemas:\n• ${problemas.join('\n• ')}`,
    details: problemas,
  });
}

/**
 * El contrato desde una plantilla de Word (entrega 15, rehecha el 7/10/2026
 * a pedido de Javier): cada inmobiliaria sube sus contratos en .docx con
 * marcadores, y de cada contrato se descarga el Word completo. El PDF que se
 * firma lo sube la inmobiliaria después, en «Documento y firma».
 *
 * El .docx se guarda en el mismo bucket privado que los PDF de los contratos,
 * bajo la carpeta de la inmobiliaria.
 */
@Injectable()
export class PlantillasService {
  private readonly logger = new Logger(PlantillasService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async listar(): Promise<PlantillaDto[]> {
    return this.db.withTenant(async (tx) =>
      (await tx.alqPlantilla.findMany({ select: SELECT_DTO, orderBy: { nombre: 'asc' } })).map(
        aDto,
      ),
    );
  }

  /** El Word de ejemplo, con todos los marcadores y un contrato armado con ellos. */
  ejemplo(): Docx {
    return { buffer: plantillaDeEjemplo(), nombre: 'Plantilla de contrato - ejemplo.docx' };
  }

  async crear(
    ctx: TenantContext,
    meta: PlantillaMetadatos,
    archivo: ArchivoSubido,
  ): Promise<PlantillaDto> {
    validar(archivo);
    const id = randomUUID();
    const clave = await this.subir(ctx, id, archivo);
    try {
      return await this.db.withTenant(async (tx) =>
        aDto(
          await tx.alqPlantilla.create({
            data: {
              id,
              ...meta,
              tenantId: ctx.tenantId,
              creadoPorId: ctx.userId,
              ...this.columnasDelArchivo(clave, archivo),
            },
            select: SELECT_DTO,
          }),
        ),
      );
    } catch (e) {
      await this.borrarArchivo(clave);
      throw e;
    }
  }

  /** Cambia el Word de una plantilla (también una de texto, que así pasa a ser de Word). */
  async reemplazarArchivo(
    ctx: TenantContext,
    id: string,
    archivo: ArchivoSubido,
  ): Promise<PlantillaDto> {
    validar(archivo);
    const anterior = await this.db.withTenant((tx) =>
      tx.alqPlantilla.findUnique({ where: { id }, select: { archivo: true } }),
    );
    if (!anterior) throw new NotFoundException('La plantilla no existe.');
    const clave = await this.subir(ctx, id, archivo);
    const dto = await this.db.withTenant(async (tx) =>
      aDto(
        await tx.alqPlantilla.update({
          where: { id },
          // El texto del editor anterior ya no sirve: manda el Word.
          data: { ...this.columnasDelArchivo(clave, archivo), cuerpo: null },
          select: SELECT_DTO,
        }),
      ),
    );
    if (anterior.archivo) await this.borrarArchivo(anterior.archivo);
    return dto;
  }

  async actualizar(id: string, meta: PlantillaMetadatos): Promise<PlantillaDto> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqPlantilla.updateMany({ where: { id }, data: meta });
      if (!count) throw new NotFoundException('La plantilla no existe.');
      return aDto(await tx.alqPlantilla.findUniqueOrThrow({ where: { id }, select: SELECT_DTO }));
    });
  }

  async borrar(id: string): Promise<{ id: string }> {
    const p = await this.db.withTenant(async (tx) => {
      const fila = await tx.alqPlantilla.findUnique({ where: { id }, select: { archivo: true } });
      if (!fila) throw new NotFoundException('La plantilla no existe.');
      await tx.alqPlantilla.delete({ where: { id } });
      return fila;
    });
    if (p.archivo) await this.borrarArchivo(p.archivo);
    return { id };
  }

  /** El Word que subió la inmobiliaria, tal cual. */
  async descargar(id: string): Promise<Docx> {
    const p = await this.db.withTenant((tx) =>
      tx.alqPlantilla.findUnique({
        where: { id },
        select: { nombre: true, archivo: true, nombreArchivo: true },
      }),
    );
    if (!p) throw new NotFoundException('La plantilla no existe.');
    if (!p.archivo) throw new BadRequestException(PLANTILLA_DE_TEXTO);
    return {
      buffer: await this.storage.descargarPrivado(BUCKET_CONTRATOS, p.archivo),
      nombre: p.nombreArchivo ?? `${p.nombre}.docx`,
    };
  }

  /**
   * El Word del contrato, completo con sus datos. No se guarda como el
   * documento del contrato: se revisa, se pasa a PDF y se sube en «Documento
   * y firma». Queda en el historial que se generó.
   *
   * Tres consultas en paralelo (plantilla, contrato con sus partes y tramos,
   * y el nombre de la inmobiliaria), más las dos del historial: las mismas
   * con un tramo que con cuarenta.
   */
  async generar(ctx: TenantContext, contratoId: string, plantillaId: string): Promise<Docx> {
    const { plantilla, contrato, inmobiliaria } = await this.db.withTenant(async (tx) => {
      const [plantilla, contrato, tenant] = await Promise.all([
        tx.alqPlantilla.findUnique({
          where: { id: plantillaId },
          select: { nombre: true, archivo: true },
        }),
        tx.alqContrato.findUnique({ where: { id: contratoId }, select: SELECT_PLANTILLA }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true } }),
      ]);
      if (!plantilla) throw new NotFoundException('La plantilla no existe.');
      if (!contrato) throw new NotFoundException('El contrato no existe.');
      return { plantilla, contrato, inmobiliaria: tenant.nombre };
    });
    if (!plantilla.archivo) throw new BadRequestException(PLANTILLA_DE_TEXTO);

    const original = await this.storage.descargarPrivado(BUCKET_CONTRATOS, plantilla.archivo);
    let buffer: Buffer;
    try {
      buffer = completarPlantillaWord(
        original,
        datosDePlantilla(contrato, inmobiliaria, hoyArgentina()),
      );
    } catch (e) {
      this.logger.error(`Plantilla ${plantillaId}: ${e instanceof Error ? e.message : String(e)}`);
      throw new BadRequestException(
        'No se pudo completar la plantilla. Volvé a subir el Word desde Plantillas de contrato.',
      );
    }

    await this.db.withTenant((tx) =>
      registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: contratoId,
        contratoId,
        accion: 'documento',
        resumen: `Contrato en Word generado desde la plantilla «${plantilla.nombre}»`,
      }),
    );
    return { buffer, nombre: `Contrato-${contrato.codigo}.docx` };
  }

  /** Cada versión es un objeto nuevo: reemplazar no pisa el anterior hasta que la base cambió. */
  private async subir(ctx: TenantContext, id: string, archivo: ArchivoSubido): Promise<string> {
    const clave = `${ctx.tenantId}/plantillas/${id}/${randomUUID()}.docx`;
    await this.storage.uploadPrivado(BUCKET_CONTRATOS, clave, archivo.buffer, TIPO_DOCX);
    return clave;
  }

  private columnasDelArchivo(clave: string, archivo: ArchivoSubido) {
    return {
      archivo: clave,
      nombreArchivo: nombreDelArchivo(archivo.originalname),
      tamano: archivo.size,
      archivoSubidoEl: new Date(),
    };
  }

  /**
   * Un archivo que quedó sin plantilla no se le muestra a nadie: si Storage
   * falla al borrarlo, se anota y se sigue. El usuario ya hizo lo que pidió.
   */
  private async borrarArchivo(clave: string): Promise<void> {
    try {
      await this.storage.remove(BUCKET_CONTRATOS, clave);
    } catch (e) {
      this.logger.warn(`No se pudo borrar ${clave}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

const PLANTILLA_DE_TEXTO =
  'Es una plantilla de texto del sistema anterior: subí la versión en Word para usarla.';
