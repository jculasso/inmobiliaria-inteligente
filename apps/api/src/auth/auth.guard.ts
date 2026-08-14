import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import {
  MODULOS_DEFAULT,
  ModulosTenantSchema,
  PlanTenantSchema,
  TenantConfigSchema,
  type Rol,
} from '@vacker/types';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_CTX_KEY, type TenantContext } from '../prisma/tenant-context';
import { AUTH_PROVIDER, type AuthProvider } from './auth-provider.interface';
import type { AuthPrincipal } from './auth-principal';
import { IS_PUBLIC_KEY } from './decorators';
import { PrincipalCacheService } from './principal-cache.service';

interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;
  principal?: AuthPrincipal;
}

/**
 * Guard global: verifica el token (vía AuthProvider), resuelve el usuario desde
 * NUESTRA base (tenant + roles) y publica el contexto de tenant en el CLS para
 * que la capa de datos aplique RLS. Los endpoints @Public() se saltan.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly principalCache: PrincipalCacheService,
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
    if (cached) return cached;

    const identity = await this.authProvider.verifyToken(token);

    // Resolución de tenant + roles desde la base (lookup por authUserId, sin
    // RLS). `authUserId` es el id de Supabase Auth; `usuario.id` (la PK usada
    // en las FKs de negocio) puede ser distinto para vendedores creados desde
    // el Tablero antes de "activarles" el acceso.
    const usuario = await this.prisma.usuario.findUnique({
      where: { authUserId: identity.userId },
      include: {
        roles: true,
        tenant: { select: { nombre: true, plan: true, modulos: true, config: true } },
      },
    });
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no habilitado en la plataforma.');
    }

    // `plan`/`config` son columnas sueltas (String / Json) en la base, sin
    // constraint de enum — si alguna vez quedan con un valor inesperado, no
    // queremos que eso tumbe el login de nadie: fallback a defaults seguros.
    const plan = PlanTenantSchema.safeParse(usuario.tenant.plan);
    const config = TenantConfigSchema.safeParse(usuario.tenant.config);
    // Mismo criterio defensivo: si `modulos` quedara con una forma inesperada,
    // se cae al piso (solo Tablero) en vez de tumbar el login.
    const modulos = ModulosTenantSchema.safeParse(usuario.tenant.modulos);

    const principal: AuthPrincipal = {
      userId: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      fotoUrl: usuario.fotoUrl,
      tenantId: usuario.tenantId,
      roles: usuario.roles.map((r) => r.rol as Rol),
      debeCambiarPassword: usuario.debeCambiarPassword,
      tenant: {
        nombre: usuario.tenant.nombre,
        plan: plan.success ? plan.data : 'basico',
        modulos: modulos.success ? modulos.data : MODULOS_DEFAULT,
        // `TenantConfigSchema.parse({})` y no `{}` a secas: desde que la
        // configuración tiene coeficientes de tasación con valor por defecto,
        // un objeto vacío ya no es una configuración completa. Parsearlo
        // devuelve los valores por defecto, que es lo que este `else` quiso
        // decir siempre.
        config: config.success ? config.data : TenantConfigSchema.parse({}),
      },
    };
    this.principalCache.set(token, principal);
    return principal;
  }

  private extractBearer(req: RequestWithPrincipal): string | null {
    const raw = req.headers['authorization'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
