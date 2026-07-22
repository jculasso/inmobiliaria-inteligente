import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  fotoUrl: true,
  estado: true,
  liderId: true,
  roles: { select: { rol: true } },
} satisfies Prisma.UsuarioSelect;

type UsuarioRow = Prisma.UsuarioGetPayload<{ select: typeof usuarioSelect }>;

@Injectable()
export class UsuariosService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Lista los usuarios del tenant actual (acotado por RLS). */
  async list() {
    return this.db.withTenant(async (tx) => {
      const rows = await tx.usuario.findMany({
        // `select` explícito (no `include`): no exponemos `authUserId` ni
        // timestamps/`tenantId` en la respuesta de la API.
        select: usuarioSelect,
        orderBy: { nombre: 'asc' },
      });
      return rows.map(toDto);
    });
  }
}

function toDto(row: UsuarioRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    fotoUrl: row.fotoUrl,
    estado: row.estado,
    liderId: row.liderId,
    roles: row.roles.map((r) => r.rol),
  };
}
