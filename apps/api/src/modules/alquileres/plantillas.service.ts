import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MARCADORES_POR_DOCUMENTO,
  type DocumentoPlantilla,
  type PlantillaDto,
  type PlantillaMetadatos,
} from '@vacker/types';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { BUCKET_CONTRATOS } from './firma/firma.service';
import { registrarEventos } from './historial';
import { datosDePlantilla, SELECT_PLANTILLA } from './plantilla-modelo';
import {
  anexoDeLaPlataforma,
  plantillaDeEjemplo,
  plantillaDeEjemploAnexo,
  plantillaDeEjemploReserva,
} from './plantilla-ejemplo';
import { datosDeReserva, SELECT_RESERVA_PLANTILLA } from './reserva-modelo';
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
  documento: true,
  archivo: true,
  nombreArchivo: true,
  tamano: true,
  updatedAt: true,
} as const;

const aDto = (p: {
  id: string;
  nombre: string;
  tipoContrato: string | null;
  documento: string;
  archivo: string | null;
  nombreArchivo: string | null;
  tamano: number | null;
  updatedAt: Date;
}): PlantillaDto => ({
  id: p.id,
  nombre: p.nombre,
  tipoContrato: p.tipoContrato as PlantillaDto['tipoContrato'],
  documento: documentoDe(p.documento),
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

/** Lo que dice la columna, leído sin confiar: lo que no se entiende es de contrato, como antes. */
const documentoDe = (d: string): DocumentoPlantilla =>
  d === 'reserva' || d === 'inventario' ? d : 'contrato';

const NOMBRE_DOCUMENTO: Record<DocumentoPlantilla, string> = {
  contrato: 'de contrato: se usa desde el contrato',
  reserva: 'de reserva: se usa desde la reserva',
  inventario: 'de anexo de inventario: se usa desde el inventario del contrato',
};

/** Reglas 162 y 174: cada plantilla se usa solo para lo que es. */
function assertDocumento(d: string, esperado: DocumentoPlantilla): void {
  const es = documentoDe(d);
  if (es !== esperado) throw new BadRequestException(`Es una plantilla ${NOMBRE_DOCUMENTO[es]}.`);
}

/**
 * Revisa el Word y, si algo está mal, lo rechaza nombrando cada marcador.
 * Contra los marcadores de SU documento (reglas 162 y 174): un Word de
 * reserva con `{contrato.codigo}` no pasa, porque una reserva no tiene
 * código de contrato.
 */
function validar(archivo: ArchivoSubido, documento: DocumentoPlantilla): void {
  const problemas = problemasDePlantilla(archivo, MARCADORES_POR_DOCUMENTO[documento]);
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

  /** Regla 174: el Word de ejemplo del anexo de inventario. */
  ejemploAnexo(): Docx {
    return {
      buffer: plantillaDeEjemploAnexo(),
      nombre: 'Plantilla de anexo de inventario - ejemplo.docx',
    };
  }

  /**
   * Regla 174: el anexo de inventario del contrato, con la plantilla de anexo
   * de la inmobiliaria o, si no subió ninguna (`plantillaId` null), con el
   * modelo de la plataforma. Como el contrato: no se guarda, y queda en el
   * historial.
   */
  async generarAnexo(
    ctx: TenantContext,
    contratoId: string,
    plantillaId: string | null,
  ): Promise<Docx> {
    const { plantilla, contrato, inmobiliaria } = await this.db.withTenant(async (tx) => {
      const [plantilla, contrato, tenant] = await Promise.all([
        plantillaId
          ? tx.alqPlantilla.findUnique({
              where: { id: plantillaId },
              select: { nombre: true, archivo: true, documento: true },
            })
          : Promise.resolve(null),
        tx.alqContrato.findUnique({
          where: { id: contratoId },
          select: { ...SELECT_PLANTILLA, estado: true },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true } }),
      ]);
      if (plantillaId && !plantilla) throw new NotFoundException('La plantilla no existe.');
      if (!contrato) throw new NotFoundException('El contrato no existe.');
      return { plantilla, contrato, inmobiliaria: tenant.nombre };
    });
    if (contrato.estado === 'anulado')
      throw new BadRequestException('El contrato está anulado: no se genera su anexo.');
    if (plantilla) assertDocumento(plantilla.documento, 'inventario');
    if (plantilla && !plantilla.archivo) throw new BadRequestException(PLANTILLA_DE_TEXTO);
    const datos = datosDePlantilla(contrato, inmobiliaria, hoyArgentina());
    let buffer: Buffer;
    if (plantilla?.archivo) buffer = await this.completar(plantillaId!, plantilla.archivo, datos);
    else buffer = completarPlantillaWord(anexoDeLaPlataforma(), datos);
    await this.db.withTenant((tx) =>
      registrarEventos(tx, ctx, {
        entidad: 'contrato',
        entidadId: contratoId,
        contratoId,
        accion: 'documento',
        resumen: `Anexo de inventario en Word generado ${plantilla ? `desde la plantilla «${plantilla.nombre}»` : 'con el modelo de la plataforma'}`,
      }),
    );
    return { buffer, nombre: `Anexo-inventario-${contrato.codigo}.docx` };
  }

  /** Regla 163: el Word de ejemplo de una reserva, con sus marcadores y un formulario. */
  ejemploReserva(): Docx {
    return { buffer: plantillaDeEjemploReserva(), nombre: 'Plantilla de reserva - ejemplo.docx' };
  }

  async crear(
    ctx: TenantContext,
    meta: PlantillaMetadatos,
    archivo: ArchivoSubido,
  ): Promise<PlantillaDto> {
    validar(archivo, meta.documento);
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
    const anterior = await this.db.withTenant((tx) =>
      tx.alqPlantilla.findUnique({ where: { id }, select: { archivo: true, documento: true } }),
    );
    if (!anterior) throw new NotFoundException('La plantilla no existe.');
    // El Word nuevo se revisa contra los marcadores del documento que ya es.
    validar(archivo, documentoDe(anterior.documento));
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
    // Una plantilla no cambia de documento: su Word se revisó contra los
    // marcadores del que es (regla 162).
    const { nombre, tipoContrato } = meta;
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.alqPlantilla.updateMany({
        where: { id },
        data: { nombre, tipoContrato },
      });
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
          select: { nombre: true, archivo: true, documento: true },
        }),
        tx.alqContrato.findUnique({ where: { id: contratoId }, select: SELECT_PLANTILLA }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true } }),
      ]);
      if (!plantilla) throw new NotFoundException('La plantilla no existe.');
      if (!contrato) throw new NotFoundException('El contrato no existe.');
      return { plantilla, contrato, inmobiliaria: tenant.nombre };
    });
    assertDocumento(plantilla.documento, 'contrato');
    if (!plantilla.archivo) throw new BadRequestException(PLANTILLA_DE_TEXTO);

    const buffer = await this.completar(
      plantillaId,
      plantilla.archivo,
      datosDePlantilla(contrato, inmobiliaria, hoyArgentina()),
    );

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

  /**
   * La reserva en Word (regla 163), con una plantilla de reserva. Como el
   * contrato: no se guarda, y queda en el historial de la reserva. Tres
   * consultas en paralelo y las dos del historial, con 1 garante o con 25.
   */
  async generarReserva(
    ctx: TenantContext,
    reservaId: string,
    plantillaId: string,
    hoy = hoyArgentina(),
  ): Promise<Docx> {
    const { plantilla, reserva, inmobiliaria } = await this.db.withTenant(async (tx) => {
      const [plantilla, reserva, tenant] = await Promise.all([
        tx.alqPlantilla.findUnique({
          where: { id: plantillaId },
          select: { nombre: true, archivo: true, documento: true },
        }),
        tx.alqReserva.findUnique({
          where: { id: reservaId },
          select: { ...SELECT_RESERVA_PLANTILLA, estado: true },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nombre: true } }),
      ]);
      if (!plantilla) throw new NotFoundException('La plantilla no existe.');
      if (!reserva) throw new NotFoundException('La reserva no existe.');
      return { plantilla, reserva, inmobiliaria: tenant.nombre };
    });
    assertDocumento(plantilla.documento, 'reserva');
    if (reserva.estado === 'anulada')
      throw new BadRequestException('La reserva está anulada: no se genera su Word.');
    if (!plantilla.archivo) throw new BadRequestException(PLANTILLA_DE_TEXTO);

    const buffer = await this.completar(
      plantillaId,
      plantilla.archivo,
      datosDeReserva(reserva, inmobiliaria, hoy),
    );
    await this.db.withTenant((tx) =>
      registrarEventos(tx, ctx, {
        entidad: 'reserva',
        entidadId: reservaId,
        accion: 'documento',
        resumen: `Reserva ${reserva.numero} en Word generada desde la plantilla «${plantilla.nombre}»`,
      }),
    );
    return { buffer, nombre: `Reserva-${reserva.numero}.docx` };
  }

  /** Baja el Word de la plantilla y lo completa; si no se puede, lo dice en castellano. */
  private async completar(
    plantillaId: string,
    archivo: string,
    datos: Record<string, unknown>,
  ): Promise<Buffer> {
    const original = await this.storage.descargarPrivado(BUCKET_CONTRATOS, archivo);
    try {
      return completarPlantillaWord(original, datos);
    } catch (e) {
      this.logger.error(`Plantilla ${plantillaId}: ${e instanceof Error ? e.message : String(e)}`);
      throw new BadRequestException(
        'No se pudo completar la plantilla. Volvé a subir el Word desde Plantillas.',
      );
    }
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
