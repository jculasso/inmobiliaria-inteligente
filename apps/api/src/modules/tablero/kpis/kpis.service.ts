import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AgregadoKpi,
  KpiFiltro,
  LadoPunta,
  RankingItem,
  ResumenKpis,
  SeguimientoObjetivo,
} from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope, type Scope } from '../scope.util';
import { decToNum } from '../tablero.util';
import {
  agregar,
  ranking,
  seguimientoObjetivos,
  type ObjetivoRow,
  type PuntaCalc,
  type ScopeSet,
} from './kpis.calc';

const ventaConPuntas = {
  puntas: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } } },
} satisfies Prisma.OperacionInclude;

type VentaRow = Prisma.OperacionGetPayload<{ include: typeof ventaConPuntas }>;

/** KPIs del Tablero Comercial. Toda la lógica de negocio vive acá (nunca en el front). */
@Injectable()
export class KpisService {
  constructor(private readonly db: TenantPrismaService) {}

  /** KPIs de cabecera: volumen anual/mes, puntas, comisión, pendiente de cobro, alquileres. */
  async resumen(filtro: KpiFiltro, ctx: TenantContext): Promise<ResumenKpis> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const scopeSet = toScopeSet(scope);

      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada', scope.usuarioIds);
      const puntasAnio = aplanarPuntas(escrituradas);
      const puntasMes =
        filtro.mes != null ? puntasDeMes(escrituradas, filtro.mes) : [];

      // Pendiente de cobro = comisión de puntas de operaciones señadas del año.
      const senadas = await this.ventas(tx, filtro.anio, 'senada', scope.usuarioIds);
      const puntasSenadas = aplanarPuntas(senadas).filter(
        (p) => scopeSet === null || scopeSet.has(p.usuarioId),
      );
      const opsSenadas = new Set(puntasSenadas.map((p) => p.operacionId));

      // Alquileres: métrica de tenant (no se atribuyen a un agente). Solo para
      // el alcance 'tenant'; los alcances acotados ven 0 (nada atribuido).
      const alquileres =
        scope.mode === 'tenant'
          ? await this.alquileres(tx, filtro.anio)
          : { firmados: 0, comision: 0, valorMensualPromedio: 0 };

      return {
        anio: filtro.anio,
        mes: filtro.mes,
        anual: agregar(puntasAnio, scopeSet),
        mesActual: filtro.mes != null ? agregar(puntasMes, scopeSet) : undefined,
        pendienteCobro: puntasSenadas.reduce((s, p) => s + p.comision, 0),
        operacionesSenadas: opsSenadas.size,
        alquileres,
      };
    });
  }

  /**
   * Agregados de los 12 meses del año en una sola consulta — reemplaza el
   * patrón anterior del front (`getAgregadosPorTrimestre`) de pedir
   * `resumen()` 12 veces (una por mes) solo para armar el gráfico trimestral.
   */
  async mensual(anio: number, ctx: TenantContext): Promise<AgregadoKpi[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const escrituradas = await this.ventas(tx, anio, 'escriturada', scope.usuarioIds);
      const scopeSet = toScopeSet(scope);
      return Array.from({ length: 12 }, (_, i) => agregar(puntasDeMes(escrituradas, i + 1), scopeSet));
    });
  }

  /** Ranking de vendedores por volumen (dentro del alcance). */
  async ranking(filtro: KpiFiltro, ctx: TenantContext): Promise<RankingItem[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada', scope.usuarioIds);
      const puntas =
        filtro.mes != null
          ? puntasDeMes(escrituradas, filtro.mes)
          : aplanarPuntas(escrituradas);
      return ranking(puntas, toScopeSet(scope));
    });
  }

  /**
   * Agregado + ranking de un rango de meses [mesInicio..mesFin] en una sola
   * consulta — el front pedía esto con 2 llamadas (resumen+ranking) para
   * anual/mensual, y 6 (3 meses × 2) para trimestral. Reemplaza ambos casos:
   * anual = [1,12], mensual = [m,m], trimestral = los 3 meses del trimestre.
   */
  async resumenRango(
    anio: number,
    mesInicio: number,
    mesFin: number,
    ctx: TenantContext,
  ): Promise<{ agregado: AgregadoKpi; ranking: RankingItem[] }> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const scopeSet = toScopeSet(scope);
      const escrituradas = await this.ventas(tx, anio, 'escriturada', scope.usuarioIds);
      const enRango = escrituradas.filter((v) => v.mes != null && v.mes >= mesInicio && v.mes <= mesFin);
      const puntas = aplanarPuntas(enRango);
      return { agregado: agregar(puntas, scopeSet), ranking: ranking(puntas, scopeSet) };
    });
  }

  /** Seguimiento real vs objetivo del año, por vendedor. */
  async objetivos(filtro: KpiFiltro, ctx: TenantContext): Promise<SeguimientoObjetivo[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const scopeSet = toScopeSet(scope);

      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada', scope.usuarioIds);
      const puntas = aplanarPuntas(escrituradas);

      const objRows = await tx.objetivo.findMany({
        where: { anio: filtro.anio },
        include: { usuario: { select: { nombre: true } } },
      });
      const objetivos: ObjetivoRow[] = objRows.map((o) => ({
        usuarioId: o.usuarioId,
        nombre: o.usuario.nombre,
        objComision: decToNum(o.objComision),
        objVolumen: decToNum(o.objVolumen),
        objPuntas: o.objPuntas,
      }));

      return seguimientoObjetivos(puntas, objetivos, filtro.anio, scopeSet);
    });
  }

  /**
   * Trae ventas por estado/año. Cuando el alcance está acotado, pre-filtra en
   * SQL las operaciones con al menos una punta del conjunto (menos filas); el
   * filtro por-punta fino lo sigue haciendo `agregar`/`ranking` con el scopeSet.
   */
  private ventas(
    tx: Prisma.TransactionClient,
    anio: number,
    estado: 'escriturada' | 'senada',
    usuarioIds: string[] | null,
  ): Promise<VentaRow[]> {
    const where: Prisma.OperacionWhereInput = { tipo: 'venta', estado, anio };
    if (usuarioIds !== null) {
      where.puntas = { some: { usuarioId: { in: usuarioIds } } };
    }
    return tx.operacion.findMany({ where, include: ventaConPuntas });
  }

  private async alquileres(tx: Prisma.TransactionClient, anio: number) {
    const rows = await tx.operacion.findMany({
      where: { tipo: 'alquiler', estado: 'firmado', anio },
      select: { comTotal: true, valorMensual: true },
    });
    const firmados = rows.length;
    const comision = rows.reduce((s, r) => s + decToNum(r.comTotal), 0);
    const valorMensualPromedio = firmados
      ? rows.reduce((s, r) => s + decToNum(r.valorMensual), 0) / firmados
      : 0;
    return { firmados, comision, valorMensualPromedio };
  }
}

function toScopeSet(scope: Scope): ScopeSet {
  return scope.usuarioIds === null ? null : new Set(scope.usuarioIds);
}

/** Aplana operaciones→puntas para el cálculo (precio de la op como aporte de cada punta). */
function aplanarPuntas(ventas: VentaRow[]): PuntaCalc[] {
  const out: PuntaCalc[] = [];
  for (const v of ventas) {
    const precio = decToNum(v.precio);
    for (const p of v.puntas) {
      out.push({
        operacionId: v.id,
        usuarioId: p.usuarioId,
        nombre: p.usuario.nombre,
        fotoUrl: p.usuario.fotoUrl,
        lado: p.lado as LadoPunta,
        precio,
        comision: decToNum(p.comision),
      });
    }
  }
  return out;
}

function puntasDeMes(ventas: VentaRow[], mes: number): PuntaCalc[] {
  return aplanarPuntas(ventas.filter((v) => v.mes === mes));
}
