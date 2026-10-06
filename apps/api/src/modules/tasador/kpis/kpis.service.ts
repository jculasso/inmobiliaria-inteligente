import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  DashboardTasador,
  EstadoTasacion,
  RankingCaptacionItem,
  ResumenTasadorKpi,
  TasadorKpiFiltro,
} from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { scopeDeVista, type Scope } from '../../tablero/scope.util';
import { rangoDeFiltro } from '../fecha.util';
import { agregar, ranking, type ScopeSet, type TasacionCalc } from './kpis.calc';

const tasacionKpiSelect = {
  id: true,
  agenteId: true,
  estado: true,
  fecha: true,
  agente: { select: { nombre: true, fotoUrl: true } },
} satisfies Prisma.TasacionSelect;

type TasacionKpiRow = Prisma.TasacionGetPayload<{ select: typeof tasacionKpiSelect }>;

/** KPIs del Tasador de Propiedades: total, tasa de captación, distribución por estado y ranking. */
@Injectable()
export class KpisService {
  constructor(private readonly db: TenantPrismaService) {}

  async resumen(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<ResumenTasadorKpi> {
    return this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, filtro.verTodo);
      const tasaciones = await this.tasaciones(tx, filtro, scope);
      return agregar(aplanar(tasaciones), toScopeSet(scope));
    });
  }

  async ranking(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<RankingCaptacionItem[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, filtro.verTodo);
      const tasaciones = await this.tasaciones(tx, filtro, scope);
      return ranking(aplanar(tasaciones), toScopeSet(scope));
    });
  }

  /**
   * Agregados de los 12 meses del año en una sola consulta — alimenta el
   * gráfico de tendencia del dashboard sin pedir `resumen()` 12 veces (mismo
   * patrón que `tablero/kpis/kpis.service.ts` método `mensual`).
   */
  async mensual(anio: number, ctx: TenantContext, verTodo = false): Promise<ResumenTasadorKpi[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, verTodo);
      const where: Prisma.TasacionWhereInput = {
        fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) },
      };
      if (scope.usuarioIds !== null) where.agenteId = { in: scope.usuarioIds };
      const rows = await tx.tasacion.findMany({ where, select: tasacionKpiSelect });
      const scopeSet = toScopeSet(scope);
      return Array.from({ length: 12 }, (_, i) =>
        agregar(aplanar(rows.filter((r) => r.fecha.getUTCMonth() === i)), scopeSet),
      );
    });
  }

  /**
   * La portada del Tasador: resumen y ranking del período pedido más los doce
   * meses del año, de UNA consulta en UNA transacción. El período (mes,
   * trimestre o año) siempre cae dentro del año, así que se traen las
   * tasaciones del año y el período se recorta en memoria. Mismas funciones
   * puras que `resumen`, `ranking` y `mensual`, que siguen vivos: lo fija
   * `kpis.dashboard.spec.ts`.
   */
  async dashboard(filtro: TasadorKpiFiltro, ctx: TenantContext): Promise<DashboardTasador> {
    return this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, filtro.verTodo);
      const scopeSet = toScopeSet(scope);
      const rows = await this.tasaciones(tx, { ...filtro, periodo: 'anual' }, scope);
      const { gte, lt } = rangoDeFiltro(filtro) as { gte: Date; lt: Date };
      const delPeriodo = aplanar(rows.filter((r) => r.fecha >= gte && r.fecha < lt));
      return {
        resumen: agregar(delPeriodo, scopeSet),
        ranking: ranking(delPeriodo, scopeSet),
        mensual: Array.from({ length: 12 }, (_, i) =>
          agregar(aplanar(rows.filter((r) => r.fecha.getUTCMonth() === i)), scopeSet),
        ),
      };
    });
  }

  /** Trae las tasaciones del rango de fecha, acotadas por el alcance del rol. */
  private tasaciones(
    tx: Prisma.TransactionClient,
    filtro: TasadorKpiFiltro,
    scope: Scope,
  ): Promise<TasacionKpiRow[]> {
    const where: Prisma.TasacionWhereInput = { fecha: rangoDeFiltro(filtro) };
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
    fotoUrl: r.agente.fotoUrl,
    estado: r.estado as EstadoTasacion,
  }));
}
