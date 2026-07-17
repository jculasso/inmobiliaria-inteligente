import { z } from 'zod';
import {
  ObjetivoSetDtoSchema,
  OperacionDtoSchema,
  RankingItemSchema,
  ResumenKpisSchema,
  SeguimientoObjetivoSchema,
  VendedorDtoSchema,
  type AgregadoKpi,
  type CreateOperacion,
  type CreateVendedor,
  type KpiFiltro,
  type ObjetivoInput,
  type OperacionFiltro,
  type RankingItem,
  type UpdateOperacion,
  type UpdateVendedor,
} from '@vacker/types';
import { apiFetch } from './api-client';

// --- Operaciones ---

export async function listOperaciones(accessToken: string, filtro: OperacionFiltro) {
  return apiFetch('/tablero/operaciones', z.array(OperacionDtoSchema), {
    accessToken,
    searchParams: { anio: filtro.anio, mes: filtro.mes, tipo: filtro.tipo },
  });
}

export async function createOperacion(accessToken: string, dto: CreateOperacion) {
  return apiFetch('/tablero/operaciones', OperacionDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function updateOperacion(accessToken: string, id: string, dto: UpdateOperacion) {
  return apiFetch(`/tablero/operaciones/${id}`, OperacionDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function deleteOperacion(accessToken: string, id: string) {
  return apiFetch(`/tablero/operaciones/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

// --- Vendedores ---

export async function listVendedores(accessToken: string) {
  return apiFetch('/tablero/vendedores', z.array(VendedorDtoSchema), { accessToken });
}

export async function createVendedor(accessToken: string, dto: CreateVendedor) {
  return apiFetch('/tablero/vendedores', VendedorDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function updateVendedor(accessToken: string, id: string, dto: UpdateVendedor) {
  return apiFetch(`/tablero/vendedores/${id}`, VendedorDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function desactivarVendedor(accessToken: string, id: string) {
  return apiFetch(
    `/tablero/vendedores/${id}`,
    z.object({ id: z.string(), estado: z.literal('inactivo') }),
    { accessToken, method: 'DELETE' },
  );
}

export async function setObjetivoVendedor(accessToken: string, id: string, dto: ObjetivoInput) {
  return apiFetch(`/tablero/vendedores/${id}/objetivo`, ObjetivoSetDtoSchema, {
    accessToken,
    method: 'PUT',
    body: dto,
  });
}

// --- KPIs ---

export async function getKpisResumen(accessToken: string, filtro: KpiFiltro) {
  return apiFetch('/tablero/kpis/resumen', ResumenKpisSchema, {
    accessToken,
    searchParams: { anio: filtro.anio, mes: filtro.mes },
  });
}

export async function getRanking(accessToken: string, filtro: KpiFiltro) {
  return apiFetch('/tablero/kpis/ranking', z.array(RankingItemSchema), {
    accessToken,
    searchParams: { anio: filtro.anio, mes: filtro.mes },
  });
}

export async function getObjetivosSeguimiento(accessToken: string, filtro: KpiFiltro) {
  return apiFetch('/tablero/kpis/objetivos', z.array(SeguimientoObjetivoSchema), {
    accessToken,
    searchParams: { anio: filtro.anio, mes: filtro.mes },
  });
}

export interface EvolucionMensualItem {
  mes: number;
  volumen: number;
}

/**
 * Volumen operado por cada mes del año (para el gráfico de evolución de
 * ventas). No hay un endpoint dedicado: se arma pidiendo `/kpis/resumen` con
 * cada mes en paralelo y tomando `mesActual.volumen` de cada respuesta.
 */
export async function getEvolucionAnual(
  accessToken: string,
  anio: number,
): Promise<EvolucionMensualItem[]> {
  const resumenes = await Promise.all(
    Array.from({ length: 12 }, (_, i) => getKpisResumen(accessToken, { anio, mes: i + 1 })),
  );
  return resumenes.map((r, i) => ({ mes: i + 1, volumen: r.mesActual?.volumen ?? 0 }));
}

// --- Resumen por período (Anual / Trimestral / Mensual), como el prototipo ---
// La API no tiene un endpoint de "trimestre": se arma pidiendo los 3 meses del
// trimestre en paralelo y sumando (mismo criterio que getEvolucionAnual).

const AGREGADO_VACIO: AgregadoKpi = {
  volumen: 0,
  operaciones: 0,
  puntas: 0,
  puntasCompradoras: 0,
  puntasVendedoras: 0,
  comision: 0,
  ticketPromedio: 0,
};

/** Meses [1..12] del trimestre 1..4. Ej: mesesDelTrimestre(1) -> [1,2,3]. */
export function mesesDelTrimestre(trimestre: number): [number, number, number] {
  const inicio = (trimestre - 1) * 3 + 1;
  return [inicio, inicio + 1, inicio + 2];
}

export function sumarAgregados(lista: AgregadoKpi[]): AgregadoKpi {
  const acc = lista.reduce(
    (a, b) => ({
      volumen: a.volumen + b.volumen,
      operaciones: a.operaciones + b.operaciones,
      puntas: a.puntas + b.puntas,
      puntasCompradoras: a.puntasCompradoras + b.puntasCompradoras,
      puntasVendedoras: a.puntasVendedoras + b.puntasVendedoras,
      comision: a.comision + b.comision,
      ticketPromedio: 0,
    }),
    { ...AGREGADO_VACIO },
  );
  return { ...acc, ticketPromedio: acc.puntas > 0 ? acc.volumen / acc.puntas : 0 };
}

export function mergearRanking(listas: RankingItem[][]): RankingItem[] {
  const porVendedor = new Map<string, RankingItem>();
  for (const item of listas.flat()) {
    const actual = porVendedor.get(item.usuarioId);
    if (!actual) {
      porVendedor.set(item.usuarioId, { ...item });
      continue;
    }
    actual.volumen += item.volumen;
    actual.operaciones += item.operaciones;
    actual.puntas += item.puntas;
    actual.puntasCompradoras += item.puntasCompradoras;
    actual.puntasVendedoras += item.puntasVendedoras;
    actual.comision += item.comision;
  }

  const items = [...porVendedor.values()].map((item) => ({
    ...item,
    ticketPromedio: item.puntas > 0 ? item.volumen / item.puntas : 0,
  }));
  const totalVolumen = items.reduce((sum, item) => sum + item.volumen, 0);
  return items
    .map((item) => ({ ...item, peso: totalVolumen > 0 ? item.volumen / totalVolumen : 0 }))
    .sort((a, b) => b.volumen - a.volumen);
}

export type PeriodoResumen = 'anual' | 'trimestral' | 'mensual';

export interface ResumenPeriodoResult {
  agregado: AgregadoKpi;
  ranking: RankingItem[];
}

export async function getResumenPeriodo(
  accessToken: string,
  opts: { anio: number; periodo: PeriodoResumen; mes?: number; trimestre?: number },
): Promise<ResumenPeriodoResult> {
  const { anio, periodo, mes, trimestre } = opts;

  if (periodo === 'trimestral') {
    const meses = mesesDelTrimestre(trimestre ?? 1);
    const [resumenes, rankings] = await Promise.all([
      Promise.all(meses.map((m) => getKpisResumen(accessToken, { anio, mes: m }))),
      Promise.all(meses.map((m) => getRanking(accessToken, { anio, mes: m }))),
    ]);
    return {
      agregado: sumarAgregados(resumenes.map((r) => r.mesActual ?? AGREGADO_VACIO)),
      ranking: mergearRanking(rankings),
    };
  }

  const filtroMes = periodo === 'mensual' ? mes : undefined;
  const [resumen, ranking] = await Promise.all([
    getKpisResumen(accessToken, { anio, mes: filtroMes }),
    getRanking(accessToken, { anio, mes: filtroMes }),
  ]);
  return {
    agregado: (periodo === 'mensual' ? resumen.mesActual : resumen.anual) ?? AGREGADO_VACIO,
    ranking,
  };
}
