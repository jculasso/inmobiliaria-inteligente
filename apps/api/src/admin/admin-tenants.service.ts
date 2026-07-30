import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MODULOS_DEFAULT, type CreateTenant, type TenantConfig, type UpdateTenant } from '@vacker/types';
import { SupabaseStorageService } from '../common/supabase-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { desencriptarSecreto, encriptarSecreto } from '../common/cripto-secreto';
import { TokkoError, listarPropiedades } from '../modules/publicacion/tokko.client';

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
    private readonly config: ConfigService,
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
        modulos: (dto.modulos ?? MODULOS_DEFAULT) as Prisma.InputJsonValue,
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
    // Los módulos se reemplazan enteros: el form manda siempre los 4 checks,
    // y un merge dejaría prendido lo que el admin acaba de apagar.
    if (dto.modulos !== undefined) data.modulos = dto.modulos as Prisma.InputJsonValue;
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

  // --- Credencial de integración (Tokko), por inmobiliaria ---
  //
  // Vive en el panel de plataforma y no en el módulo de Publicación: cargar
  // una API key es configuración de alta, no una tarea diaria. Tenerla en la
  // pantalla donde se publica hacía que cualquiera con rol `publicador`
  // pudiera reemplazarla y romper la integración sin querer.
  //
  // Corre con PrismaService (cross-tenant) porque el admin de plataforma
  // administra TODAS las inmobiliarias, igual que el resto de este servicio.

  private encKey(): string {
    const k = this.config.get<string>('INTEGRACIONES_ENC_KEY');
    if (!k) {
      throw new BadRequestException(
        'Falta configurar INTEGRACIONES_ENC_KEY en el servidor. Sin esa clave no se pueden guardar credenciales.',
      );
    }
    return k;
  }

  async credencial(tenantId: string) {
    await this.assertExiste(tenantId);
    const row = await this.db.integracionCredencial.findFirst({
      where: { tenantId, proveedor: 'tokko' },
      select: { ultimos4: true, updatedAt: true },
    });
    return {
      configurada: row !== null,
      ultimos4: row?.ultimos4 ?? null,
      actualizadoEl: row?.updatedAt.toISOString() ?? null,
    };
  }

  async guardarCredencial(tenantId: string, secreto: string, usuarioId: string) {
    await this.assertExiste(tenantId);
    const secretoEnc = encriptarSecreto(secreto, this.encKey(), 'INTEGRACIONES_ENC_KEY');
    const row = await this.db.integracionCredencial.upsert({
      where: { tenantId_proveedor: { tenantId, proveedor: 'tokko' } },
      create: {
        tenantId,
        proveedor: 'tokko',
        secretoEnc,
        ultimos4: secreto.slice(-4),
        actualizadoPor: usuarioId,
      },
      update: { secretoEnc, ultimos4: secreto.slice(-4), actualizadoPor: usuarioId },
      select: { ultimos4: true, updatedAt: true },
    });
    return { configurada: true, ultimos4: row.ultimos4, actualizadoEl: row.updatedAt.toISOString() };
  }

  async borrarCredencial(tenantId: string) {
    await this.assertExiste(tenantId);
    await this.db.integracionCredencial.deleteMany({ where: { tenantId, proveedor: 'tokko' } });
    return { configurada: false, ultimos4: null, actualizadoEl: null };
  }

  /**
   * Prueba el circuito completo: que la credencial exista, que se pueda
   * descifrar con la clave del servidor, y que Tokko la acepte. Devuelve el
   * error en vez de tirarlo — es una pantalla de configuración y saber QUÉ
   * está mal es la mitad del trabajo.
   */
  async probarCredencial(tenantId: string) {
    const fallo = (error: string) => ({ ok: false, propiedades: null, error });
    const row = await this.db.integracionCredencial.findFirst({
      where: { tenantId, proveedor: 'tokko' },
      select: { secretoEnc: true },
    });
    if (!row) return fallo('Todavía no hay una clave de Tokko cargada.');

    let secreto: string;
    try {
      secreto = desencriptarSecreto(row.secretoEnc, this.encKey(), 'INTEGRACIONES_ENC_KEY');
    } catch {
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

  private async assertExiste(tenantId: string): Promise<void> {
    const t = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException('Inmobiliaria no encontrada.');
  }
}

function extensionDe(mimetype: string, originalname: string): string {
  const fromName = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  if (fromName) return fromName;
  const sub = mimetype.split('/')[1];
  return sub ? `.${sub}` : '';
}
