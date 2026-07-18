import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTenant, UpdateTenant } from '@vacker/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * CRUD de inmobiliarias (tenants), cross-tenant. Usa `PrismaService` directo
 * (BYPASSRLS) — está sancionado para operaciones de `admin_plataforma` (ver
 * apps/api/src/prisma/prisma.service.ts). El único gate es `@Roles('admin_plataforma')`
 * en el controller.
 */
@Injectable()
export class AdminTenantsService {
  constructor(private readonly db: PrismaService) {}

  async list() {
    return this.db.tenant.findMany({ orderBy: { nombre: 'asc' } });
  }

  async create(dto: CreateTenant) {
    const existe = await this.db.tenant.findUnique({ where: { slug: dto.slug } });
    if (existe) {
      throw new BadRequestException(`Ya existe una inmobiliaria con el slug "${dto.slug}".`);
    }
    return this.db.tenant.create({
      data: { nombre: dto.nombre, slug: dto.slug, plan: dto.plan },
    });
  }

  async update(id: string, dto: UpdateTenant) {
    const actual = await this.db.tenant.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Inmobiliaria no encontrada.');
    return this.db.tenant.update({ where: { id }, data: dto });
  }
}
