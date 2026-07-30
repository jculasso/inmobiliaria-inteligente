import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CredencialEstado, PruebaConexion } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { desencriptarSecreto, encriptarSecreto } from '../../common/cripto-secreto';
import { TokkoError, listarPropiedades } from './tokko.client';

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
}
