import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { PlanTenantSchema, TenantConfigSchema, type Rol } from '@vacker/types';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_CTX_KEY, type TenantContext } from '../prisma/tenant-context';
import { AUTH_PROVIDER, type AuthProvider } from './auth-provider.interface';
import type { AuthPrincipal } from './auth-principal';
import { IS_PUBLIC_KEY } from './decorators';

interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;
  principal?: AuthPrincipal;
}

/** Cuánto se cachea la resolución tenant+roles de un token ya verificado. */
const PRINCIPAL_CACHE_TTL_MS = 30_000;

/**
 * Guard global: verifica el token (vía AuthProvider), resuelve el usuario desde
 * NUESTRA base (tenant + roles) y publica el contexto de tenant en el CLS para
 * que la capa de datos aplique RLS. Los endpoints @Public() se saltan.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // Cache en memoria del proceso, keyeada por el JWT literal — una pantalla
  // suele disparar varias requests casi simultáneas con el mismo token, y
  // cada una pagaba su propio round trip a la base solo para resolver
  // tenant+roles. Con Supabase en sa-east-1 y Render sin región cercana, ese
  // round trip extra por request se siente. TTL corto (30s): un cambio de rol
  // o baja de acceso tarda como mucho eso en reflejarse, aceptable para esta
  // escala (equipo chico, no es un sistema de alto riesgo).
  private readonly principalCache = new Map<string, { principal: AuthPrincipal; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Falta el token de acceso.');
    }

    const principal = await this.resolvePrincipal(token);
    req.principal = principal;
    const ctx: TenantContext = {
      tenantId: principal.tenantId,
      userId: principal.userId,
      roles: principal.roles,
    };
    this.cls.set(TENANT_CTX_KEY, ctx);
    return true;
  }

  private async resolvePrincipal(token: string): Promise<AuthPrincipal> {
    const cached = this.principalCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.principal;
    }

    const identity = await this.authProvider.verifyToken(token);

    // Resolución de tenant + roles desde la base (lookup por authUserId, sin
    // RLS). `authUserId` es el id de Supabase Auth; `usuario.id` (la PK usada
    // en las FKs de negocio) puede ser distinto para vendedores creados desde
    // el Tablero antes de "activarles" el acceso.
    const usuario = await this.prisma.usuario.findUnique({
      where: { authUserId: identity.userId },
      include: { roles: true, tenant: { select: { nombre: true, plan: true, config: true } } },
    });
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no habilitado en la plataforma.');
    }

    // `plan`/`config` son columnas sueltas (String / Json) en la base, sin
    // constraint de enum — si alguna vez quedan con un valor inesperado, no
    // queremos que eso tumbe el login de nadie: fallback a defaults seguros.
    const plan = PlanTenantSchema.safeParse(usuario.tenant.plan);
    const config = TenantConfigSchema.safeParse(usuario.tenant.config);

    const principal: AuthPrincipal = {
      userId: usuario.id,
      email: usuario.email,
      tenantId: usuario.tenantId,
      roles: usuario.roles.map((r) => r.rol as Rol),
      tenant: {
        nombre: usuario.tenant.nombre,
        plan: plan.success ? plan.data : 'basico',
        config: config.success ? config.data : {},
      },
    };
    this.principalCache.set(token, { principal, expiresAt: Date.now() + PRINCIPAL_CACHE_TTL_MS });
    // Equipo chico (decenas de usuarios activos, no miles): un barrido
    // ocasional alcanza para no acumular tokens vencidos indefinidamente.
    if (this.principalCache.size > 200) this.pruneExpired();
    return principal;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.principalCache) {
      if (value.expiresAt <= now) this.principalCache.delete(key);
    }
  }

  private extractBearer(req: RequestWithPrincipal): string | null {
    const raw = req.headers['authorization'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
