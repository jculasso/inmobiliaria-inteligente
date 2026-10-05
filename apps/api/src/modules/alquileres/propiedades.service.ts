import { Injectable, NotFoundException } from '@nestjs/common';
import { LIMITE_LISTA_CON_SONDA, type PropiedadAlquiler, type PropiedadAlquilerDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

const CAMPOS = { id: true, direccion: true, unidad: true, ciudad: true, tipo: true, obs: true } as const;

/** Las unidades que se alquilan. Tabla propia del módulo, no el espejo de Tokko. */
@Injectable()
export class PropiedadesAlquilerService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Todas, por dirección. La búsqueda la hace la pantalla (ver `PersonasService.listar`). */
  async listar(): Promise<PropiedadAlquilerDto[]> {
    return this.db.withTenant((tx) =>
      tx.alqPropiedad.findMany({
        select: CAMPOS,
        orderBy: [{ direccion: 'asc' }, { unidad: 'asc' }],
        take: LIMITE_LISTA_CON_SONDA,
      }),
    ) as Promise<PropiedadAlquilerDto[]>;
  }

  async crear(ctx: TenantContext, dto: PropiedadAlquiler): Promise<PropiedadAlquilerDto> {
    return this.db.withTenant((tx) => tx.alqPropiedad.create({ data: { ...dto, tenantId: ctx.tenantId }, select: CAMPOS })) as Promise<PropiedadAlquilerDto>;
  }

  async actualizar(id: string, dto: PropiedadAlquiler): Promise<PropiedadAlquilerDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.alqPropiedad.findUnique({ where: { id }, select: { id: true } });
      if (!actual) throw new NotFoundException('Propiedad no encontrada.');
      return tx.alqPropiedad.update({ where: { id }, data: dto, select: CAMPOS }) as Promise<PropiedadAlquilerDto>;
    });
  }
}
