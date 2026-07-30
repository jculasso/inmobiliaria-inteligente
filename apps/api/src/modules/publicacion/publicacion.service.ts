import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CredencialEstado, PropiedadDto, ResultadoImportacion } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { desencriptarSecreto } from '../../common/cripto-secreto';
import { ultimasPropiedades } from './tokko.client';

const PROVEEDOR = 'tokko';
const ENC_VAR = 'INTEGRACIONES_ENC_KEY';

/**
 * Credencial de Tokko de cada inmobiliaria y prueba de conexión.
 *
 * Regla que atraviesa todo el servicio: **el secreto no sale de acá**. Ni en un
 * DTO, ni en un log, ni en un mensaje de error. Lo único que se devuelve es si
 * está configurada, sus últimos 4 caracteres y cuándo se cambió.
 */
@Injectable()
export class PublicacionService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly config: ConfigService,
  ) {}

  private encKey(): string {
    const k = this.config.get<string>(ENC_VAR);
    if (!k) {
      // Mensaje accionable: sin esto el error es un 500 sin pista y el
      // implementador no tiene forma de saber que falta una variable.
      throw new BadRequestException(
        `Falta configurar ${ENC_VAR} en el servidor. Sin esa clave no se pueden guardar credenciales.`,
      );
    }
    return k;
  }

  async estado(): Promise<CredencialEstado> {
    return this.db.withTenant(async (tx) => {
      const row = await tx.integracionCredencial.findFirst({
        where: { proveedor: PROVEEDOR },
        select: { ultimos4: true, updatedAt: true },
      });
      return {
        configurada: row !== null,
        ultimos4: row?.ultimos4 ?? null,
        actualizadoEl: row?.updatedAt.toISOString() ?? null,
      };
    });
  }




  /** La credencial en claro, o un error explicando por qué no se pudo. */
  private async secreto(): Promise<string> {
    const guardado = await this.db.withTenant((tx) =>
      tx.integracionCredencial.findFirst({
        where: { proveedor: PROVEEDOR },
        select: { secretoEnc: true },
      }),
    );
    if (!guardado) throw new BadRequestException('Todavía no hay una clave de Tokko cargada.');
    try {
      return desencriptarSecreto(guardado.secretoEnc, this.encKey(), ENC_VAR);
    } catch {
      throw new BadRequestException(
        'No se pudo descifrar la clave guardada. Volvé a cargarla desde la pantalla de Publicación.',
      );
    }
  }

  /**
   * Trae desde Tokko las N propiedades más recientes y las espeja acá.
   *
   * Es una LECTURA: no toca nada en Tokko. Se eligió empezar así porque el
   * importador —el único camino de escritura— trata el archivo como el
   * inventario completo y da de baja lo que no viaja en él.
   *
   * El vendedor que la captó sale del `producer` de Tokko, vinculado **por
   * email**. Vincular por nombre daría peor: en Tokko figura "Martin Picabea" y
   * en el sistema "Martin Piccabea", "Andres" contra "Andrés". Lo que no
   * vincula queda con el email a la vista, para poder resolverlo a mano después
   * — si se descartara, se perdería a quién pertenece.
   */
  async importar(cuantas: number, ctx: TenantContext): Promise<ResultadoImportacion> {
    const key = await this.secreto();
    const propiedades = await ultimasPropiedades(key, cuantas);

    return this.db.withTenant(async (tx) => {
      const usuarios = await tx.usuario.findMany({ select: { id: true, email: true } });
      const porEmail = new Map(usuarios.map((u) => [u.email.toLowerCase().trim(), u.id]));

      let sinAgente = 0;
      const filas = propiedades.map((p) => {
        const emailTokko = (p.producer?.email ?? '').toLowerCase().trim();
        const agenteId = porEmail.get(emailTokko) ?? null;
        if (!agenteId) sinAgente += 1;

        return {
          tenantId: ctx.tenantId,
          tokkoId: p.id,
          referenceCode: p.reference_code,
          titulo: p.publication_title,
          tipo: p.type?.name ?? null,
          operacion: p.operations?.[0]?.operation_type ?? null,
          precio: p.operations?.[0]?.prices?.[0]?.price ?? null,
          moneda: p.operations?.[0]?.prices?.[0]?.currency ?? null,
          direccion: p.address,
          ubicacion: p.location?.short_location ?? null,
          fotos: p.photos?.length ?? 0,
          fotoPortada: p.photos?.find((f) => f.is_front_cover)?.image ?? p.photos?.[0]?.image ?? null,
          publicUrl: p.public_url,
          estado: p.status == null ? null : String(p.status),
          agenteId,
          agenteEmailTokko: p.producer?.email ?? null,
          agenteNombreTokko: p.producer?.name ?? null,
          creadoEnTokko: p.created_at ? new Date(p.created_at) : null,
          importadoEl: new Date(),
          updatedAt: new Date(),
        };
      });

      /*
       * TRES consultas, no dos por propiedad.
       *
       * La primera versión hacía findFirst + create/update por cada una: 50
       * viajes a la base para 25 propiedades. Con la base en São Paulo y la API
       * en otro continente, eso se pasó de los 15 segundos de la transacción y
       * la traída de 25 se cancelaba.
       *
       * Se borra y se vuelve a insertar en lugar de actualizar fila por fila
       * porque Postgres no puede actualizar N filas con N valores distintos en
       * una sola consulta. Es seguro acá porque esto es un ESPEJO: la identidad
       * de una propiedad es su `tokkoId`, no el uuid de nuestra fila, y nada
       * apunta todavía a esta tabla. El día que algo la referencie, hay que
       * cambiarlo por un INSERT ... ON CONFLICT DO UPDATE.
       *
       * Todo pasa dentro de la misma transacción, así que no existe un momento
       * en el que las propiedades no estén.
       */
      const ids = filas.map((f) => f.tokkoId);
      const existentes = await tx.propiedad.findMany({
        where: { tokkoId: { in: ids } },
        select: { tokkoId: true },
      });
      const yaEstaban = existentes.length;

      await tx.propiedad.deleteMany({ where: { tokkoId: { in: ids } } });
      await tx.propiedad.createMany({ data: filas });

      return {
        leidas: propiedades.length,
        creadas: filas.length - yaEstaban,
        actualizadas: yaEstaban,
        sinAgente,
      };
    });
  }

  async listar(): Promise<PropiedadDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.propiedad.findMany({
        include: { agente: { select: { nombre: true } } },
        orderBy: [{ creadoEnTokko: 'desc' }, { tokkoId: 'desc' }],
        take: 100,
      });
      return filas.map((f) => ({
        id: f.id,
        tokkoId: f.tokkoId,
        referenceCode: f.referenceCode,
        titulo: f.titulo,
        tipo: f.tipo,
        operacion: f.operacion,
        precio: f.precio == null ? null : Number(f.precio),
        moneda: f.moneda,
        direccion: f.direccion,
        ubicacion: f.ubicacion,
        fotos: f.fotos,
        fotoPortada: f.fotoPortada,
        publicUrl: f.publicUrl,
        agente: f.agente?.nombre ?? null,
        agenteTokko: f.agenteNombreTokko,
        creadoEnTokko: f.creadoEnTokko?.toISOString() ?? null,
      }));
    });
  }

  /**
   * Vacía el espejo de propiedades.
   *
   * Es seguro por naturaleza y por eso no pide más ceremonia que una
   * confirmación: lo que se borra es una COPIA. Tokko sigue teniendo el
   * original, así que volver a traerlas es un click. Muy distinto de borrar una
   * tasación, donde se pierde trabajo hecho.
   */
  async vaciarPropiedades(): Promise<{ borradas: number }> {
    return this.db.withTenant(async (tx) => {
      const { count } = await tx.propiedad.deleteMany({});
      return { borradas: count };
    });
  }
}
