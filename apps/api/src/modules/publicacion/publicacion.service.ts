import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CredencialEstado, PropiedadDto, PruebaConexion, ResultadoImportacion } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { desencriptarSecreto, encriptarSecreto } from '../../common/cripto-secreto';
import { TokkoError, listarPropiedades, ultimasPropiedades } from './tokko.client';

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

  async guardar(secreto: string, ctx: TenantContext): Promise<CredencialEstado> {
    const encKey = this.encKey();
    const secretoEnc = encriptarSecreto(secreto, encKey, ENC_VAR);
    const ultimos4 = secreto.slice(-4);

    return this.db.withTenant(async (tx) => {
      const row = await tx.integracionCredencial.upsert({
        where: { tenantId_proveedor: { tenantId: ctx.tenantId, proveedor: PROVEEDOR } },
        create: {
          tenantId: ctx.tenantId,
          proveedor: PROVEEDOR,
          secretoEnc,
          ultimos4,
          actualizadoPor: ctx.userId,
        },
        update: { secretoEnc, ultimos4, actualizadoPor: ctx.userId },
        select: { ultimos4: true, updatedAt: true },
      });
      return { configurada: true, ultimos4: row.ultimos4, actualizadoEl: row.updatedAt.toISOString() };
    });
  }

  async borrar(): Promise<CredencialEstado> {
    await this.db.withTenant(async (tx) => {
      await tx.integracionCredencial.deleteMany({ where: { proveedor: PROVEEDOR } });
    });
    return { configurada: false, ultimos4: null, actualizadoEl: null };
  }

  /**
   * Prueba el circuito completo de una sola vez: que exista la credencial, que
   * la clave de cifrado sea la correcta para descifrarla, y que Tokko la acepte.
   *
   * Devuelve `ok: false` con un mensaje en vez de tirar 500, porque es una
   * pantalla de configuración: el usuario necesita saber QUÉ está mal, y un
   * error acá es un resultado esperable, no una falla del servidor.
   */
  async probarConexion(): Promise<PruebaConexion> {
    const fallo = (error: string): PruebaConexion => ({ ok: false, propiedades: null, error });

    let secreto: string;
    try {
      const guardado = await this.db.withTenant((tx) =>
        tx.integracionCredencial.findFirst({
          where: { proveedor: PROVEEDOR },
          select: { secretoEnc: true },
        }),
      );
      if (!guardado) return fallo('Todavía no hay una clave de Tokko cargada.');
      secreto = desencriptarSecreto(guardado.secretoEnc, this.encKey(), ENC_VAR);
    } catch {
      // Descifrado fallido = la clave de cifrado del servidor cambió respecto de
      // cuando se guardó. Hay que volver a cargar la credencial, no hay forma
      // de recuperarla.
      return fallo(
        'No se pudo descifrar la clave guardada. Volvé a cargarla: la clave de cifrado del servidor cambió.',
      );
    }

    try {
      const { totalCount } = await listarPropiedades(secreto, 1);
      return { ok: true, propiedades: totalCount, error: null };
    } catch (e) {
      return fallo(e instanceof TokkoError ? e.message : 'Error inesperado al consultar Tokko.');
    }
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

      let creadas = 0;
      let actualizadas = 0;
      let sinAgente = 0;

      for (const p of propiedades) {
        const emailTokko = (p.producer?.email ?? '').toLowerCase().trim();
        const agenteId = porEmail.get(emailTokko) ?? null;
        if (!agenteId) sinAgente += 1;

        const datos = {
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
        };

        const existe = await tx.propiedad.findFirst({
          where: { tokkoId: p.id },
          select: { id: true },
        });
        if (existe) {
          await tx.propiedad.update({ where: { id: existe.id }, data: datos });
          actualizadas += 1;
        } else {
          await tx.propiedad.create({ data: { ...datos, tenantId: ctx.tenantId, tokkoId: p.id } });
          creadas += 1;
        }
      }

      return { leidas: propiedades.length, creadas, actualizadas, sinAgente };
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
}
