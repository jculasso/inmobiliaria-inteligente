import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateVendedor, ObjetivoInput, UpdateVendedor } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
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
  constructor(private readonly db: TenantPrismaService) {}

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
    return this.db.withTenant(async (tx) => {
      await this.assertEmailLibre(tx, dto.email);
      if (dto.liderId) await this.assertUsuarioExiste(tx, dto.liderId);

      const id = randomUUID();
      await tx.usuario.create({
        data: {
          id,
          tenantId: ctx.tenantId,
          nombre: dto.nombre,
          email: dto.email,
          estado: dto.estado,
          liderId: dto.liderId ?? null,
          roles: { create: dto.roles.map((rol) => ({ rol, tenantId: ctx.tenantId })) },
        },
      });
      const row = await tx.usuario.findUniqueOrThrow({ where: { id }, include: vendedorInclude });
      return toDto(row);
    });
  }

  async update(id: string, dto: UpdateVendedor, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.usuario.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException('Usuario no encontrado.');
      if (dto.email !== undefined && dto.email !== actual.email) {
        await this.assertEmailLibre(tx, dto.email, id);
      }
      if (dto.liderId) {
        if (dto.liderId === id) throw new BadRequestException('Un usuario no puede ser su propio líder.');
        await this.assertUsuarioExiste(tx, dto.liderId);
      }

      const data: Prisma.UsuarioUpdateInput = {};
      if (dto.nombre !== undefined) data.nombre = dto.nombre;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.liderId !== undefined) {
        data.lider = dto.liderId ? { connect: { id: dto.liderId } } : { disconnect: true };
      }
      await tx.usuario.update({ where: { id }, data });

      if (dto.roles !== undefined) {
        await tx.usuarioRol.deleteMany({ where: { usuarioId: id } });
        await tx.usuarioRol.createMany({
          data: dto.roles.map((rol) => ({ usuarioId: id, rol, tenantId: ctx.tenantId })),
        });
      }

      const row = await tx.usuario.findUniqueOrThrow({ where: { id }, include: vendedorInclude });
      return toDto(row);
    });
  }

  /** Baja lógica: marca el usuario como inactivo (no se borra por integridad histórica). */
  async desactivar(id: string) {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.usuario.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException('Usuario no encontrado.');
      await tx.usuario.update({ where: { id }, data: { estado: 'inactivo' } });
      return { id, estado: 'inactivo' as const };
    });
  }

  /** Crea o actualiza el objetivo anual de un vendedor. */
  async setObjetivo(id: string, dto: ObjetivoInput, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      await this.assertUsuarioExiste(tx, id);
      const obj = await tx.objetivo.upsert({
        where: { tenantId_usuarioId_anio: { tenantId: ctx.tenantId, usuarioId: id, anio: dto.anio } },
        update: { objComision: dto.objComision, objVolumen: dto.objVolumen, objPuntas: dto.objPuntas },
        create: {
          tenantId: ctx.tenantId,
          usuarioId: id,
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
    });
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
