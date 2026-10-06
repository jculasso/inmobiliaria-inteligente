import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { registrarEventos } from './historial';
import { LIMITE_LISTA_CON_SONDA, type PropiedadAlquiler, type PropiedadAlquilerDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

const CAMPOS = { id: true, direccion: true, unidad: true, ciudad: true, tipo: true, obs: true } as const;

const unidad = (p: { direccion: string; unidad: string | null }) => [p.direccion, p.unidad].filter(Boolean).join(' ');

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
    return this.db.withTenant(async (tx) => {
      const p = (await tx.alqPropiedad.create({ data: { ...dto, tenantId: ctx.tenantId }, select: CAMPOS })) as PropiedadAlquilerDto;
      await registrarEventos(tx, ctx, { entidad: 'propiedad', entidadId: p.id, accion: 'alta', resumen: `Alta de ${unidad(p)}` });
      return p;
    });
  }

  async actualizar(ctx: TenantContext, id: string, dto: PropiedadAlquiler): Promise<PropiedadAlquilerDto> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.alqPropiedad.findUnique({ where: { id }, select: { id: true } });
      if (!actual) throw new NotFoundException('Propiedad no encontrada.');
      const p = (await tx.alqPropiedad.update({ where: { id }, data: dto, select: CAMPOS })) as PropiedadAlquilerDto;
      await registrarEventos(tx, ctx, { entidad: 'propiedad', entidadId: id, accion: 'edicion', resumen: `Datos de ${unidad(p)} editados` });
      return p;
    });
  }

  /** Se borra solo si nunca tuvo un contrato (decidido con Javier el 6/10/2026). */
  async borrar(ctx: TenantContext, id: string): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const p = await tx.alqPropiedad.findUnique({ where: { id }, select: { direccion: true, unidad: true, _count: { select: { contratos: true } } } });
      if (!p) throw new NotFoundException('Propiedad no encontrada.');
      const n = p._count.contratos;
      if (n) throw new ConflictException(`${unidad(p)} no se puede borrar: tiene ${n} ${n === 1 ? 'contrato' : 'contratos'}. Lo que tiene historia queda.`);
      await tx.alqPropiedad.delete({ where: { id } });
      await registrarEventos(tx, ctx, { entidad: 'propiedad', entidadId: id, accion: 'borrado', resumen: `${unidad(p)} borrada` });
      return { id };
    });
  }
}
