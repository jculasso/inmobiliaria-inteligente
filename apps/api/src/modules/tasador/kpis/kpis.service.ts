import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EstadoTasacion, RankingCaptacionItem, ResumenTasadorKpi, TasadorKpiFiltro } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope, type Scope } from '../../tablero/scope.util';
import { agregar, ranking, type ScopeSet, type TasacionCalc } from './kpis.calc';

const tasacionKpiSelect = {
  id: true,
  agenteId: true,
  estado: true,
  fecha: true,
  agente: { select: { nombre: true } },
} satisfies Prisma.TasacionSelect;

type TasacionKpiRow = Prisma.TasacionGetPayload<{ select: typeof tasacionKpiSelect }>;

/** KPIs del Tasador de Propiedades: total, tasa de captación, distribución por estado y ranking. */
@Injectable()
export class KpisService {
  constructor(private readonly db: TenantPrismaService) {}

  async resumen(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<ResumenTasadorKpi> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const tasaciones = await this.tasaciones(tx, filtro, scope);
      return agregar(aplanar(tasaciones), toScopeSet(scope));
    });
  }

  async ranking(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<RankingCaptacionItem[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const tasaciones = await this.tasaciones(tx, filtro, scope);
      return ranking(aplanar(tasaciones), toScopeSet(scope));
    });
  }

  /**
   * Agregados de los 12 meses del año en una sola consulta — alimenta el
   * gráfico de tendencia del dashboard sin pedir `resumen()` 12 veces (mismo
   * patrón que `tablero/kpis/kpis.service.ts` método `mensual`).
   */
  async mensual(anio: number, ctx: TenantContext): Promise<ResumenTasadorKpi[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const where: Prisma.TasacionWhereInput = {
        fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) },
      };
      if (scope.usuarioIds !== null) where.agenteId = { in: scope.usuarioIds };
      const rows = await tx.tasacion.findMany({ where, select: tasacionKpiSelect });
      const scopeSet = toScopeSet(scope);
      return Array.from({ length: 12 }, (_, i) =>
        agregar(
          aplanar(rows.filter((r) => r.fecha.getUTCMonth() === i)),
          scopeSet,
        ),
      );
    });
  }

  /** Trae las tasaciones del rango de fecha, acotadas por el alcance del rol. */
  private tasaciones(
    tx: Prisma.TransactionClient,
    filtro: TasadorKpiFiltro,
    scope: Scope,
  ): Promise<TasacionKpiRow[]> {
    const where: Prisma.TasacionWhereInput = { fecha: rangoDeFecha(filtro) };
    if (scope.usuarioIds !== null) where.agenteId = { in: scope.usuarioIds };
    return tx.tasacion.findMany({ where, select: tasacionKpiSelect });
  }
}

function toScopeSet(scope: Scope): ScopeSet {
  return scope.usuarioIds === null ? null : new Set(scope.usuarioIds);
}

function aplanar(rows: TasacionKpiRow[]): TasacionCalc[] {
  return rows.map((r) => ({
    id: r.id,
    agenteId: r.agenteId,
    nombre: r.agente.nombre,
    estado: r.estado as EstadoTasacion,
  }));
}

/**
 * Rango `[inicio, fin)` sobre `fecha` según el período pedido. A diferencia de
 * Tablero (que no tiene endpoint de trimestre y suma 3 meses del lado del
 * cliente), acá el rango se resuelve en el servidor en una sola consulta.
 */
function rangoDeFecha(filtro: TasadorKpiFiltro): Prisma.DateTimeFilter {
  const { anio, periodo } = filtro;
  if (periodo === 'mensual') {
    const mes = filtro.mes ?? 1;
    return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  }
  if (periodo === 'trimestral') {
    const trimestre = filtro.trimestre ?? 1;
    const mesInicio = (trimestre - 1) * 3;
    return {
      gte: new Date(Date.UTC(anio, mesInicio, 1)),
      lt: new Date(Date.UTC(anio, mesInicio + 3, 1)),
    };
  }
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}
