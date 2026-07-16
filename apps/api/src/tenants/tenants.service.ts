import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly db: TenantPrismaService) {}

  /** Devuelve el tenant actual. RLS garantiza que solo se vea el propio. */
  async current() {
    return this.db.withTenant((tx) => tx.tenant.findFirstOrThrow());
  }
}
