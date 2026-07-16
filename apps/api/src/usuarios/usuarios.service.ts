import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Lista los usuarios del tenant actual (acotado por RLS). */
  async list() {
    return this.db.withTenant((tx) =>
      tx.usuario.findMany({
        include: { roles: { select: { rol: true } } },
        orderBy: { nombre: 'asc' },
      }),
    );
  }
}
