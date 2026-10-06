import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
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
import { CLAVE_TEMPORAL_KEY, IS_PUBLIC_KEY } from './decorators';
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

    const principal = await this.principalCache.obtener(token, () => this.resolvePrincipal(token));

    // Con la contraseña temporal puesta solo se puede leer el perfil y
    // cambiarla. La web ya redirige a /cambiar-clave, pero eso lo decide el
    // cliente: el token sirve igual para llamar la API directo, y la clave
    // temporal la conoce también quien la generó.
    if (principal.debeCambiarPassword) {
      const permitido = this.reflector.getAllAndOverride<boolean>(CLAVE_TEMPORAL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!permitido) {
        throw new ForbiddenException(
          'Tenés que elegir una contraseña propia antes de seguir. Cambiá la contraseña temporal.',
        );
      }
    }

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
    const identity = await this.authProvider.verifyToken(token);

    // Resolución de tenant + roles desde la base (lookup por authUserId, sin
    // RLS). `authUserId` es el id de Supabase Auth; `usuario.id` (la PK usada
    // en las FKs de negocio) puede ser distinto para vendedores creados desde
    // el Tablero antes de "activarles" el acceso.
    const usuario = await this.prisma.usuario.findUnique({
      where: { authUserId: identity.userId },
      include: {
        roles: true,
        tenant: {
          select: { nombre: true, plan: true, modulos: true, config: true, estado: true },
        },
      },
    });
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no habilitado en la plataforma.');
    }
    const roles = usuario.roles.map((r) => r.rol as Rol);

    // Una inmobiliaria suspendida (por falta de pago, baja) no opera: hasta el
    // 6/10/2026 el estado se guardaba pero nadie lo miraba, así que suspender
    // no cambiaba nada. La excepción es el admin de plataforma: su cuenta vive
    // en una inmobiliaria como cualquier otra, y tiene que poder seguir usando
    // el panel —entre otras cosas, para reactivarla—.
    if (usuario.tenant.estado !== 'activo' && !roles.includes('admin_plataforma')) {
      throw new ForbiddenException(
        'Tu inmobiliaria está suspendida. Comunicate con el administrador de la plataforma.',
      );
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
      roles,
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
