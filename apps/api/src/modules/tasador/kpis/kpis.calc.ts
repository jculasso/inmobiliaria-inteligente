import type { EstadoTasacion, RankingCaptacionItem, ResumenTasadorKpi } from '@vacker/types';

/**
 * KPIs del Tasador de Propiedades. Funciones PURAS: reciben tasaciones ya
 * traídas de la base (ya filtradas por rango de fecha y por scope) → testeables
 * en memoria, mismo criterio que `tablero/kpis/kpis.calc.ts`.
 */

/** Tasación aplanada para el cálculo. */
export interface TasacionCalc {
  id: string;
  agenteId: string;
  nombre: string;
  fotoUrl: string | null;
  estado: EstadoTasacion;
}

/** `null` = todo el alcance (sin filtro); un Set = solo esos usuarios. */
export type ScopeSet = Set<string> | null;

const ESTADOS: EstadoTasacion[] = ['En proceso', 'Presentada', 'Captada', 'No captada'];

function enAlcance(t: TasacionCalc, scope: ScopeSet): boolean {
  return scope === null || scope.has(t.agenteId);
}

/** Total, tasa de captación y distribución por estado sobre las tasaciones del alcance. */
export function agregar(tasaciones: TasacionCalc[], scope: ScopeSet): ResumenTasadorKpi {
  const porEstado = new Map<EstadoTasacion, number>(ESTADOS.map((e) => [e, 0]));
  let total = 0;
  let captadas = 0;
  for (const t of tasaciones) {
    if (!enAlcance(t, scope)) continue;
    total += 1;
    porEstado.set(t.estado, (porEstado.get(t.estado) ?? 0) + 1);
    if (t.estado === 'Captada') captadas += 1;
  }
  return {
    total,
    tasaCaptacion: total ? captadas / total : 0,
    distribucionEstado: ESTADOS.map((estado) => ({ estado, cantidad: porEstado.get(estado) ?? 0 })),
  };
}

/** Ranking de agentes por cantidad de captaciones (solo agentes dentro del alcance). */
export function ranking(tasaciones: TasacionCalc[], scope: ScopeSet): RankingCaptacionItem[] {
  const porAgente = new Map<string, { nombre: string; fotoUrl: string | null; captadas: number; total: number }>();
  let captadasTotal = 0;

  for (const t of tasaciones) {
    if (!enAlcance(t, scope)) continue;
    const item = porAgente.get(t.agenteId) ?? { nombre: t.nombre, fotoUrl: t.fotoUrl, captadas: 0, total: 0 };
    item.total += 1;
    if (t.estado === 'Captada') {
      item.captadas += 1;
      captadasTotal += 1;
    }
    porAgente.set(t.agenteId, item);
  }

  return [...porAgente.entries()]
    // El ranking es "de captaciones" — un agente sin ninguna no aporta nada
    // a esa clasificación, así que no tiene sentido listarlo con 0.
    .filter(([, item]) => item.captadas > 0)
    .map(([usuarioId, item]) => ({
      usuarioId,
      nombre: item.nombre,
      fotoUrl: item.fotoUrl,
      captadas: item.captadas,
      total: item.total,
      tasaCaptacion: item.total ? item.captadas / item.total : 0,
      peso: captadasTotal ? item.captadas / captadasTotal : 0,
    }))
    .sort((a, b) => b.captadas - a.captadas);
}
