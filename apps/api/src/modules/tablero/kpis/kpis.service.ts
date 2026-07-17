import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
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
  puntas: { include: { usuario: { select: { id: true, nombre: true } } } },
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

      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada');
      const puntasAnio = aplanarPuntas(escrituradas);
      const puntasMes =
        filtro.mes != null ? puntasDeMes(escrituradas, filtro.mes) : [];

      // Pendiente de cobro = comisión de puntas de operaciones señadas del año.
      const senadas = await this.ventas(tx, filtro.anio, 'senada');
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

  /** Ranking de vendedores por volumen (dentro del alcance). */
  async ranking(filtro: KpiFiltro, ctx: TenantContext): Promise<RankingItem[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada');
      const puntas =
        filtro.mes != null
          ? puntasDeMes(escrituradas, filtro.mes)
          : aplanarPuntas(escrituradas);
      return ranking(puntas, toScopeSet(scope));
    });
  }

  /** Seguimiento real vs objetivo del año, por vendedor. */
  async objetivos(filtro: KpiFiltro, ctx: TenantContext): Promise<SeguimientoObjetivo[]> {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const scopeSet = toScopeSet(scope);

      const escrituradas = await this.ventas(tx, filtro.anio, 'escriturada');
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

  private ventas(
    tx: Prisma.TransactionClient,
    anio: number,
    estado: 'escriturada' | 'senada',
  ): Promise<VentaRow[]> {
    return tx.operacion.findMany({
      where: { tipo: 'venta', estado, anio },
      include: ventaConPuntas,
    });
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
