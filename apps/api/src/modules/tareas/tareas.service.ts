import { Injectable, Logger } from '@nestjs/common';
import type { Rol } from '@vacker/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../prisma/tenant-context';
import { ReporteSemanalMailService } from '../protocolo/informe/reporte-semanal-mail.service';

export interface ResultadoPorTenant {
  tenant: string;
  enviado: boolean;
  destinatarios: number;
  motivo?: string;
}

export interface ResumenCorrida {
  tenants: number;
  enviados: number;
  detalle: ResultadoPorTenant[];
}

/** Roles del contexto sintético: alcance de toda la inmobiliaria, sin puntas propias. */
const ROLES_TAREA: Rol[] = ['admin_tenant'];

/**
 * El envío semanal de todas las inmobiliarias.
 *
 * Corre SIN usuario logueado, así que arma un contexto de tenant a mano. Usa
 * `PrismaService` directo —no `TenantPrismaService`— solo para listar los
 * tenants: esa tabla no está acotada por tenant, es justamente la que dice
 * cuáles hay. De ahí en adelante todo pasa por el servicio de siempre, con RLS.
 *
 * **Una inmobiliaria que falla no frena a las demás.** El error se registra y
 * se sigue: si el correo de una tiene mal configurado algo, las otras tres
 * igual reciben su reporte el lunes.
 */
@Injectable()
export class TareasService {
  private readonly logger = new Logger(TareasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ReporteSemanalMailService,
  ) {}

  async enviarReportesSemanales(): Promise<ResumenCorrida> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, nombre: true, modulos: true },
      orderBy: { nombre: 'asc' },
    });

    const detalle: ResultadoPorTenant[] = [];
    for (const t of tenants) {
      const modulos = t.modulos as Record<string, boolean> | null;
      if (!modulos?.protocolo) continue;

      // `app.user_id` tiene que ser un usuario real de ESE tenant: es lo que
      // las policies de RLS ven. Se toma un admin o alguien de dirección.
      const usuario = await this.prisma.usuario.findFirst({
        where: {
          tenantId: t.id,
          estado: 'activo',
          roles: { some: { rol: { in: ['admin_tenant', 'direccion'] } } },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!usuario) {
        detalle.push({
          tenant: t.nombre,
          enviado: false,
          destinatarios: 0,
          motivo: 'La inmobiliaria no tiene ningún usuario de dirección activo.',
        });
        continue;
      }

      const ctx: TenantContext = { tenantId: t.id, userId: usuario.id, roles: ROLES_TAREA };
      try {
        const r = await this.mail.enviar(ctx);
        detalle.push({
          tenant: t.nombre,
          enviado: r.enviado,
          destinatarios: r.destinatarios.length,
          motivo: r.motivo,
        });
      } catch (err) {
        const motivo = err instanceof Error ? err.message : 'Error desconocido.';
        this.logger.error(`Reporte semanal de ${t.nombre}: ${motivo}`);
        detalle.push({ tenant: t.nombre, enviado: false, destinatarios: 0, motivo });
      }
    }

    const enviados = detalle.filter((d) => d.enviado).length;
    this.logger.log(`Reporte semanal: ${enviados}/${detalle.length} inmobiliaria(s) con envío.`);
    return { tenants: detalle.length, enviados, detalle };
  }
}
