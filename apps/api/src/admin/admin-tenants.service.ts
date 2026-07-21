import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateTenant, TenantConfig, UpdateTenant } from '@vacker/types';
import { SupabaseStorageService } from '../common/supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';

const LOGO_BUCKET = 'tenants-logos';
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export interface LogoFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * CRUD de inmobiliarias (tenants), cross-tenant. Usa `PrismaService` directo
 * (BYPASSRLS) — está sancionado para operaciones de `admin_plataforma` (ver
 * apps/api/src/prisma/prisma.service.ts). El único gate es `@Roles('admin_plataforma')`
 * en el controller.
 */
@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async list() {
    return this.db.tenant.findMany({ orderBy: { nombre: 'asc' } });
  }

  async create(dto: CreateTenant) {
    const existe = await this.db.tenant.findUnique({ where: { slug: dto.slug } });
    if (existe) {
      throw new BadRequestException(`Ya existe una inmobiliaria con el slug "${dto.slug}".`);
    }
    return this.db.tenant.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
        plan: dto.plan,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateTenant) {
    const actual = await this.db.tenant.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Inmobiliaria no encontrada.');

    if (dto.slug && dto.slug !== actual.slug) {
      const existe = await this.db.tenant.findUnique({ where: { slug: dto.slug } });
      if (existe) {
        throw new BadRequestException(`Ya existe una inmobiliaria con el slug "${dto.slug}".`);
      }
    }

    const data: Prisma.TenantUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.estado !== undefined) data.estado = dto.estado;
    if (dto.config !== undefined) {
      // Merge, no reemplazo — así el form de admin puede mandar solo el
      // campo que edita sin pisar el resto del branding ya cargado.
      const actualConfig = (actual.config ?? {}) as TenantConfig;
      data.config = { ...actualConfig, ...dto.config } as Prisma.InputJsonValue;
    }

    return this.db.tenant.update({ where: { id }, data });
  }

  /**
   * Sube (o reemplaza) el logo y lo persiste en `config.logoUrl` reusando
   * `update()` — que ya mergea el config en vez de reemplazarlo, así no pisa
   * el resto del branding (colores, nombre corto).
   */
  async subirLogo(id: string, file: LogoFile) {
    const actual = await this.db.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!actual) throw new NotFoundException('Inmobiliaria no encontrada.');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen.');
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('La imagen no puede superar los 5MB.');
    }

    const ext = extensionDe(file.mimetype, file.originalname);
    const path = `${id}/logo${ext}`;
    const logoUrl = await this.storage.upload(LOGO_BUCKET, path, file.buffer, file.mimetype);

    return this.update(id, { config: { logoUrl } });
  }
}

function extensionDe(mimetype: string, originalname: string): string {
  const fromName = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  if (fromName) return fromName;
  const sub = mimetype.split('/')[1];
  return sub ? `.${sub}` : '';
}
