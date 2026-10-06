import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  RolAsignableSchema,
  type CreateVendedor,
  type ObjetivoInput,
  type UpdateVendedor,
} from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { SupabaseAdminService } from '../../../admin/supabase-admin.service';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';
import {
  assertAvatarValido,
  tipoDe,
  pathDesdeUrl,
  rutaAvatar,
  AVATAR_BUCKET,
  type AvatarFile,
} from '../../../common/avatar';
import { PrincipalCacheService } from '../../../auth/principal-cache.service';
import { decToNum } from '../tablero.util';

const vendedorInclude = {
  roles: { select: { rol: true } },
  lider: { select: { id: true, nombre: true } },
  objetivos: true,
} satisfies Prisma.UsuarioInclude;

type VendedorRow = Prisma.UsuarioGetPayload<{ include: typeof vendedorInclude }>;

/**
 * Gestión de usuarios comerciales (vendedores/team leaders). En este paso el
 * usuario se crea con un uuid generado, SIN cuenta de Supabase Auth todavía: es
 * un registro de datos para atribución de operaciones. El vínculo con Auth
 * (login) llega en el Paso 4.
 */
@Injectable()
export class VendedoresService {
  private readonly logger = new Logger(VendedoresService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly principalCache: PrincipalCacheService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /** Lista los usuarios comerciales del tenant con sus roles y objetivos. */
  async list() {
    return this.db.withTenant(async (tx) => {
      const rows = await tx.usuario.findMany({
        include: vendedorInclude,
        orderBy: { nombre: 'asc' },
      });
      return rows.map(toDto);
    });
  }

  async create(dto: CreateVendedor, ctx: TenantContext) {
    // Mismo criterio que en `update`: el rol de administrador solo lo da otro
    // administrador. Sin esto, dirección no podía AGREGARSE el rol pero sí
    // crear una cuenta nueva con él.
    assertPuedeDarRoles(dto.roles, ctx);
    return this.db.withTenant(async (tx) => {
      await this.assertEmailLibre(tx, dto.email);
      if (dto.liderId) await this.assertUsuarioExiste(tx, dto.liderId);

      const id = randomUUID();
      const roles = [...new Set(dto.roles)];
      await tx.usuario.create({
        data: {
          id,
          tenantId: ctx.tenantId,
          nombre: dto.nombre,
          email: dto.email,
          estado: dto.estado,
          liderId: dto.liderId ?? null,
          roles: { create: roles.map((rol) => ({ rol, tenantId: ctx.tenantId })) },
        },
      });
      if (dto.objetivo) await this.upsertObjetivo(tx, id, dto.objetivo, ctx.tenantId);
      const row = await tx.usuario.findUniqueOrThrow({ where: { id }, include: vendedorInclude });
      return toDto(row);
    });
  }

  /**
   * Edita un usuario en dos transacciones con Supabase Auth en el medio.
   *
   * El email también vive en Supabase Auth, que es contra lo que se valida el
   * login. Hasta el 6/10/2026 se cambiaba DENTRO de la transacción: una llamada
   * de red a otro servicio con la transacción abierta, ocupando una conexión
   * del pool mientras Auth respondía. Ahora:
   *
   * 1. Se valida todo (permisos, email libre, líder) en una lectura.
   * 2. Se cambia el email en Auth, fuera de la base. Si falla, no se guardó nada.
   * 3. Se escribe en la base. Si ESTO falla, se devuelve el email de Auth al
   *    anterior: la persona tiene que poder seguir entrando con el que figura acá.
   */
  async update(id: string, dto: UpdateVendedor, ctx: TenantContext) {
    const actual = await this.db.withTenant(async (tx) => {
      const actual = await tx.usuario.findUnique({
        where: { id },
        include: { roles: { select: { rol: true } } },
      });
      if (!actual) throw new NotFoundException('Usuario no encontrado.');
      assertPuedeAdministrar(
        actual.roles.map((r) => r.rol),
        ctx,
      );
      if (!actual.roles.some((r) => r.rol === 'admin_tenant')) {
        assertPuedeDarRoles(dto.roles ?? [], ctx);
      }
      if (dto.email !== undefined && dto.email !== actual.email) {
        // Cambiar el email de alguien que YA entra es cambiar con qué cuenta se
        // recupera su contraseña: quien lo cambie puede pedir «olvidé mi
        // clave» y quedarse con el acceso. Por eso, con acceso activo, solo lo
        // hace el administrador de la inmobiliaria.
        if (actual.authUserId && !ctx.roles.includes('admin_tenant')) {
          throw new ForbiddenException(
            'El email de alguien que ya tiene acceso solo lo cambia el administrador de la inmobiliaria.',
          );
        }
        await this.assertEmailLibre(tx, dto.email, id);
      }
      if (dto.liderId) {
        if (dto.liderId === id)
          throw new BadRequestException('Un usuario no puede ser su propio líder.');
        await this.assertUsuarioExiste(tx, dto.liderId);
      }
      return actual;
    });

    const authUserId =
      dto.email !== undefined && dto.email !== actual.email ? actual.authUserId : null;
    if (authUserId && dto.email) {
      await this.supabaseAdmin.setEmail(authUserId, dto.email);
    }

    try {
      return await this.db.withTenant(async (tx) => {
        const data: Prisma.UsuarioUpdateInput = {};
        if (dto.nombre !== undefined) data.nombre = dto.nombre;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.estado !== undefined) data.estado = dto.estado;
        if (dto.liderId !== undefined) {
          data.lider = dto.liderId ? { connect: { id: dto.liderId } } : { disconnect: true };
        }
        await tx.usuario.update({ where: { id }, data });

        if (dto.roles !== undefined) {
          // Solo se reemplazan los roles asignables desde este formulario
          // (vendedor/team_leader/direccion/admin_tenant). `admin_plataforma`
          // (o cualquier otro rol fuera de ese conjunto) no es tocado — si se
          // borrara acá, un simple "asignar líder" podría dejar sin acceso de
          // plataforma a quien lo tuviera.
          await tx.usuarioRol.deleteMany({
            where: { usuarioId: id, rol: { in: [...RolAsignableSchema.options] } },
          });
          await tx.usuarioRol.createMany({
            data: [...new Set(dto.roles)].map((rol) => ({
              usuarioId: id,
              rol,
              tenantId: ctx.tenantId,
            })),
          });
        }

        if (dto.objetivo) await this.upsertObjetivo(tx, id, dto.objetivo, ctx.tenantId);

        const row = await tx.usuario.findUniqueOrThrow({
          where: { id },
          include: vendedorInclude,
        });
        return toDto(row);
      });
    } catch (err) {
      if (authUserId) {
        await this.supabaseAdmin.setEmail(authUserId, actual.email).catch((e: unknown) => {
          this.logger.error(
            `El email de ${id} quedó distinto entre la base y Supabase Auth: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }
      throw err;
    } finally {
      // Email, roles o estado: cualquiera cambia lo que el principal cacheado
      // dice de esta persona. Una baja o un rol quitado tienen que aplicarse en
      // la próxima request, no 30 segundos después.
      this.principalCache.invalidarUsuario(id);
    }
  }

  /** Baja lógica: marca el usuario como inactivo (no se borra por integridad histórica). */
  async desactivar(id: string, ctx: TenantContext) {
    const r = await this.db.withTenant(async (tx) => {
      await this.assertPuedeAdministrarA(tx, id, ctx);
      await tx.usuario.update({ where: { id }, data: { estado: 'inactivo' } });
      return { id, estado: 'inactivo' as const };
    });
    // Sin esto, la persona dada de baja seguía operando hasta que venciera el
    // cache del principal.
    this.principalCache.invalidarUsuario(id);
    return r;
  }

  /** Crea o actualiza el objetivo anual de un vendedor (endpoint standalone). */
  async setObjetivo(id: string, dto: ObjetivoInput, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      await this.assertPuedeAdministrarA(tx, id, ctx);
      return this.upsertObjetivo(tx, id, dto, ctx.tenantId);
    });
  }

  /**
   * Upsert del objetivo, reusado por `create`/`update` (cuando el form manda
   * `objetivo` inline, en la misma transacción) y por `setObjetivo` (endpoint
   * aparte). Evita un segundo POST/PUT + transacción completa solo para el
   * objetivo — con la latencia cross-region hacia la base, eso se nota.
   */
  private async upsertObjetivo(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    dto: ObjetivoInput,
    tenantId: string,
  ) {
    const obj = await tx.objetivo.upsert({
      where: { tenantId_usuarioId_anio: { tenantId, usuarioId, anio: dto.anio } },
      update: {
        objComision: dto.objComision,
        objVolumen: dto.objVolumen,
        objPuntas: dto.objPuntas,
      },
      create: {
        tenantId,
        usuarioId,
        anio: dto.anio,
        objComision: dto.objComision,
        objVolumen: dto.objVolumen,
        objPuntas: dto.objPuntas,
      },
    });
    return {
      usuarioId: obj.usuarioId,
      anio: obj.anio,
      objComision: decToNum(obj.objComision),
      objVolumen: decToNum(obj.objVolumen),
      objPuntas: obj.objPuntas,
    };
  }

  /**
   * Cambia la foto de un vendedor desde el Tablero.
   *
   * Existe además de la del panel de plataforma porque quien incorpora a un
   * vendedor es la dirección de la inmobiliaria, y esperar a que la cambiemos
   * nosotros deja al equipo con la silueta gris durante días.
   *
   * Escribe en el MISMO archivo que el panel (ver `rutaAvatar`): un usuario,
   * una foto, no dos que se contradicen según por dónde se subió. Y corre
   * dentro de `withTenant`, así que RLS impide tocar a alguien de otra
   * inmobiliaria aunque se mande un id ajeno.
   */
  async subirFoto(id: string, file: AvatarFile, ctx: TenantContext) {
    assertAvatarValido(file);
    await this.db.withTenant((tx) => this.assertPuedeAdministrarA(tx, id, ctx));
    // La subida va FUERA de la transacción: con la transacción abierta, la
    // conexión del pool quedaba tomada mientras Storage recibía la imagen. La
    // ruta es fija por usuario, así que si lo que sigue falla no queda un
    // huérfano: la próxima subida pisa el mismo archivo.
    const fotoUrl = await this.storage.upload(
      AVATAR_BUCKET,
      rutaAvatar(ctx.tenantId, id, file),
      file.buffer,
      tipoDe(file),
    );
    return this.db.withTenant(async (tx) => {
      const row = await tx.usuario.update({
        where: { id },
        data: { fotoUrl },
        include: vendedorInclude,
      });
      return toDto(row);
    });
  }

  async eliminarFoto(id: string, ctx: TenantContext) {
    const { fotoUrl } = await this.db.withTenant((tx) => this.assertPuedeAdministrarA(tx, id, ctx));
    // Primero el archivo, fuera de la transacción: el bucket es PÚBLICO, y si
    // el borrado fallara después de limpiar la base, la foto que la persona
    // quiso sacar seguiría publicada en una URL conocida sin que nada la
    // referencie. Si falla acá, no se toca nada y se puede reintentar.
    if (fotoUrl) {
      const path = pathDesdeUrl(fotoUrl);
      if (path) await this.storage.remove(AVATAR_BUCKET, path);
    }
    return this.db.withTenant(async (tx) => {
      const row = await tx.usuario.update({
        where: { id },
        data: { fotoUrl: null },
        include: vendedorInclude,
      });
      return toDto(row);
    });
  }

  /**
   * Lee al usuario y verifica que quien llama lo pueda administrar. Lo usan
   * TODAS las acciones sobre otra persona —editar, dar de baja, objetivo,
   * foto—: hasta el 6/10/2026 el objetivo y la foto no lo miraban, así que
   * dirección podía cambiarle la foto a un administrador o a la cuenta de
   * plataforma.
   */
  private async assertPuedeAdministrarA(
    tx: Prisma.TransactionClient,
    id: string,
    ctx: TenantContext,
  ): Promise<{ fotoUrl: string | null }> {
    const actual = await tx.usuario.findUnique({
      where: { id },
      select: { fotoUrl: true, roles: { select: { rol: true } } },
    });
    if (!actual) throw new BadRequestException('El usuario referenciado no existe en el tenant.');
    assertPuedeAdministrar(
      actual.roles.map((r) => r.rol),
      ctx,
    );
    return { fotoUrl: actual.fotoUrl };
  }

  private async assertEmailLibre(
    tx: Prisma.TransactionClient,
    email: string,
    exceptId?: string,
  ): Promise<void> {
    const existe = await tx.usuario.findFirst({
      where: { email, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existe) throw new BadRequestException(`Ya existe un usuario con el email ${email}.`);
  }

  private async assertUsuarioExiste(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const u = await tx.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new BadRequestException('El usuario referenciado no existe en el tenant.');
  }
}

function toDto(row: VendedorRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    fotoUrl: row.fotoUrl,
    estado: row.estado,
    liderId: row.liderId,
    lider: row.lider ? { id: row.lider.id, nombre: row.lider.nombre } : null,
    roles: row.roles.map((r) => r.rol),
    objetivos: row.objetivos.map((o) => ({
      anio: o.anio,
      objComision: decToNum(o.objComision),
      objVolumen: decToNum(o.objVolumen),
      objPuntas: o.objPuntas,
    })),
  };
}

/**
 * Nadie edita ni da de baja a quien está por encima suyo (auditoría de
 * seguridad del 6/10/2026). Sin esto, un usuario de dirección podía cambiarle
 * el email a la cuenta de plataforma —que vive en una inmobiliaria como
 * cualquier usuario—, pedir «olvidé mi clave» y entrar como administrador de
 * TODAS las inmobiliarias.
 *
 * - La cuenta de plataforma no se toca desde una inmobiliaria: se administra
 *   desde el panel de plataforma.
 * - A un administrador de la inmobiliaria solo lo edita otro administrador.
 */
export function assertPuedeAdministrar(
  rolesDelOtro: string[],
  ctx: Pick<TenantContext, 'roles'>,
): void {
  if (rolesDelOtro.includes('admin_plataforma')) {
    throw new ForbiddenException(
      'Esta cuenta la administra la plataforma: no se puede editar desde acá.',
    );
  }
  if (rolesDelOtro.includes('admin_tenant') && !ctx.roles.includes('admin_tenant')) {
    throw new ForbiddenException(
      'A un administrador de la inmobiliaria solo lo edita otro administrador.',
    );
  }
}

/** El rol de administrador de la inmobiliaria solo lo da otro administrador. */
export function assertPuedeDarRoles(
  roles: readonly string[],
  ctx: Pick<TenantContext, 'roles'>,
): void {
  if (roles.includes('admin_tenant') && !ctx.roles.includes('admin_tenant')) {
    throw new ForbiddenException(
      'Solo un administrador de la inmobiliaria puede dar el rol de administrador.',
    );
  }
}
