import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertAvatarValido,
  pathDesdeUrl,
  rutaAvatar,
  AVATAR_BUCKET,
  type AvatarFile,
} from '../common/avatar';
import type { CreateUsuarioAdmin, ResetPassword, UpdateUsuarioAdmin } from '@vacker/types';
import { SupabaseStorageService } from '../common/supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { PrincipalCacheService } from '../auth/principal-cache.service';

const usuarioAdminInclude = {
  roles: { select: { rol: true } },
} satisfies Prisma.UsuarioInclude;

type UsuarioAdminRow = Prisma.UsuarioGetPayload<{ include: typeof usuarioAdminInclude }>;

/**
 * Alta/gestión de usuarios con acceso real (cuenta de Supabase Auth + perfil
 * de negocio), cross-tenant. Es el paso que faltaba: `VendedoresService` (Tablero)
 * crea solo el registro de negocio, sin login (ver su comentario de cabecera).
 */
@Injectable()
export class AdminUsuariosService {
  constructor(
    private readonly db: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly storage: SupabaseStorageService,
    private readonly principalCache: PrincipalCacheService,
  ) {}

  async list(tenantId: string) {
    await this.assertTenantExiste(tenantId);
    const rows = await this.db.usuario.findMany({
      where: { tenantId },
      include: usuarioAdminInclude,
      orderBy: { nombre: 'asc' },
    });
    return rows.map(toDto);
  }

  /** Crea la cuenta en Supabase Auth y, si el alta de negocio falla, la revierte. */
  async create(tenantId: string, dto: CreateUsuarioAdmin) {
    await this.assertTenantExiste(tenantId);
    const existe = await this.db.usuario.findFirst({ where: { tenantId, email: dto.email } });
    if (existe) {
      throw new BadRequestException(`Ya existe un usuario con el email ${dto.email} en esta inmobiliaria.`);
    }

    const authUser = await this.supabaseAdmin.createUser(dto.email, dto.password);
    try {
      const roles = [...new Set(dto.roles)];
      await this.db.usuario.create({
        data: {
          id: authUser.id,
          authUserId: authUser.id,
          tenantId,
          nombre: dto.nombre,
          email: dto.email,
          telefono: dto.telefono ?? null,
          estado: 'activo',
          roles: { create: roles.map((rol) => ({ rol, tenantId })) },
        },
      });
    } catch (err) {
      await this.supabaseAdmin.deleteUser(authUser.id);
      throw err;
    }

    const row = await this.db.usuario.findUniqueOrThrow({
      where: { id: authUser.id },
      include: usuarioAdminInclude,
    });
    return toDto(row);
  }

  async update(tenantId: string, id: string, dto: UpdateUsuarioAdmin) {
    const usuario = await this.assertUsuarioDeTenant(tenantId, id);

    const data: Prisma.UsuarioUpdateInput = {};

    // El email vive en dos lados: acá y en Supabase Auth (que es contra lo que
    // se loguea). Se cambia PRIMERO en Auth: si eso falla, no queremos quedar
    // con un mail en nuestra tabla que no sirve para entrar.
    if (dto.email !== undefined && dto.email !== usuario.email) {
      const repetido = await this.db.usuario.findFirst({
        where: { tenantId, email: dto.email, NOT: { id } },
        select: { id: true },
      });
      if (repetido) {
        throw new BadRequestException(`Ya hay otro usuario con el email "${dto.email}".`);
      }
      if (!usuario.authUserId) {
        throw new BadRequestException('Este usuario todavía no tiene acceso — activalo primero.');
      }
      await this.supabaseAdmin.setEmail(usuario.authUserId, dto.email);
      data.email = dto.email;
      // El principal cacheado trae el email viejo.
      this.principalCache.invalidarUsuario(id);
    }

    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.estado !== undefined) data.estado = dto.estado;
    if (dto.telefono !== undefined) data.telefono = dto.telefono ?? null;
    if (Object.keys(data).length > 0) {
      await this.db.usuario.update({ where: { id }, data });
    }

    if (dto.roles !== undefined) {
      await this.db.usuarioRol.deleteMany({ where: { usuarioId: id } });
      await this.db.usuarioRol.createMany({
        data: [...new Set(dto.roles)].map((rol) => ({ usuarioId: id, rol, tenantId })),
      });
    }

    const row = await this.db.usuario.findUniqueOrThrow({ where: { id }, include: usuarioAdminInclude });
    return toDto(row);
  }

  async resetPassword(tenantId: string, id: string, dto: ResetPassword) {
    const usuario = await this.assertUsuarioDeTenant(tenantId, id);
    if (!usuario.authUserId) {
      throw new BadRequestException('Este usuario todavía no tiene acceso — activalo primero.');
    }
    await this.supabaseAdmin.setPassword(usuario.authUserId, dto.password);
    // La clave queda temporal: al entrar, se le pide elegir una propia (mismo
    // criterio que el alta). Así el admin nunca conoce la contraseña final.
    await this.db.usuario.update({ where: { id }, data: { debeCambiarPassword: true } });
    this.principalCache.invalidarUsuario(id);
    return { id, ok: true as const };
  }

  /**
   * Activa el acceso de un usuario que hoy solo existe como registro de datos
   * (creado desde el Tablero, sin cuenta de Supabase Auth): crea la cuenta y
   * la vincula vía `authUserId`, sin tocar `id` — así conserva intactas todas
   * sus operaciones/tasaciones ya atribuidas.
   */
  async activarAcceso(tenantId: string, id: string, dto: ResetPassword) {
    const usuario = await this.assertUsuarioDeTenant(tenantId, id);
    if (usuario.authUserId) {
      throw new BadRequestException('Este usuario ya tiene acceso.');
    }

    const authUser = await this.supabaseAdmin.createUser(usuario.email, dto.password);
    try {
      await this.db.usuario.update({
        where: { id },
        data: { authUserId: authUser.id, debeCambiarPassword: true },
      });
    } catch (err) {
      await this.supabaseAdmin.deleteUser(authUser.id);
      throw err;
    }

    const row = await this.db.usuario.findUniqueOrThrow({ where: { id }, include: usuarioAdminInclude });
    return toDto(row);
  }

  /**
   * Sube (o reemplaza) la foto de perfil. Path determinístico por usuario
   * (no `randomUUID()` como en las fotos de tasación) + `x-upsert: true` en
   * el storage: subir de nuevo simplemente sobreescribe, sin dejar archivos
   * huérfanos que limpiar.
   */
  async subirFoto(tenantId: string, id: string, file: AvatarFile) {
    await this.assertUsuarioDeTenant(tenantId, id);
    assertAvatarValido(file);

    const path = rutaAvatar(tenantId, id, file);
    const fotoUrl = await this.storage.upload(AVATAR_BUCKET, path, file.buffer, file.mimetype);

    await this.db.usuario.update({ where: { id }, data: { fotoUrl } });
    const row = await this.db.usuario.findUniqueOrThrow({ where: { id }, include: usuarioAdminInclude });
    return toDto(row);
  }

  async eliminarFoto(tenantId: string, id: string) {
    const usuario = await this.assertUsuarioDeTenant(tenantId, id);
    if (usuario.fotoUrl) {
      const path = pathDesdeUrl(usuario.fotoUrl);
      if (path) await this.storage.remove(AVATAR_BUCKET, path);
    }
    await this.db.usuario.update({ where: { id }, data: { fotoUrl: null } });
    const row = await this.db.usuario.findUniqueOrThrow({ where: { id }, include: usuarioAdminInclude });
    return toDto(row);
  }

  private async assertTenantExiste(tenantId: string): Promise<void> {
    const t = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException('Inmobiliaria no encontrada.');
  }

  private async assertUsuarioDeTenant(
    tenantId: string,
    id: string,
  ): Promise<{ id: string; email: string; authUserId: string | null; fotoUrl: string | null }> {
    const u = await this.db.usuario.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true, authUserId: true, fotoUrl: true },
    });
    if (!u) throw new NotFoundException('Usuario no encontrado en esta inmobiliaria.');
    return u;
  }
}


function toDto(row: UsuarioAdminRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    estado: row.estado,
    fotoUrl: row.fotoUrl,
    telefono: row.telefono,
    roles: row.roles.map((r) => r.rol),
    tieneAcceso: row.authUserId !== null,
    debeCambiarPassword: row.debeCambiarPassword,
  };
}
