import { z } from 'zod';
import {
  AgregadoKpiSchema,
  ObjetivoSetDtoSchema,
  OperacionDtoSchema,
  RankingItemSchema,
  ResumenKpisSchema,
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
    searchParams: {
      anio: filtro.anio,
      mes: filtro.mes,
      tipo: filtro.tipo,
      estado: filtro.estado,
      usuarioId: filtro.usuarioId,
    },
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

/** Agregados de los 12 meses del año en una sola llamada de red. */
export async function getKpisMensual(accessToken: string, anio: number) {
  return apiFetch('/tablero/kpis/mensual', z.array(AgregadoKpiSchema), {
    accessToken,
    searchParams: { anio },
  });
}

const ResumenRangoSchema = z.object({
  agregado: AgregadoKpiSchema,
  ranking: z.array(RankingItemSchema),
});

/** Agregado + ranking de [mesInicio..mesFin] en una sola llamada de red. */
export async function getResumenRango(
  accessToken: string,
  anio: number,
  mesInicio: number,
  mesFin: number,
) {
  return apiFetch('/tablero/kpis/rango', ResumenRangoSchema, {
    accessToken,
    searchParams: { anio, mesInicio, mesFin },
  });
}

// --- Resumen por período (Anual / Trimestral / Mensual), como el prototipo ---

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

export type PeriodoResumen = 'anual' | 'trimestral' | 'mensual';

export interface ResumenPeriodoResult {
  agregado: AgregadoKpi;
  ranking: RankingItem[];
}

/**
 * Volumen y comisión de cada trimestre del año (para el gráfico de barras +
 * línea de "Acumulado Trimestral"). Antes pedía los 12 meses uno por uno
 * (`getKpisResumen` × 12 → 12 round-trips); ahora es una sola llamada a
 * `getKpisMensual` agrupada en los 4 trimestres del lado del cliente.
 */
export async function getAgregadosPorTrimestre(
  accessToken: string,
  anio: number,
): Promise<AgregadoKpi[]> {
  const porMes = await getKpisMensual(accessToken, anio);
  return [1, 2, 3, 4].map((q) => sumarAgregados(mesesDelTrimestre(q).map((m) => porMes[m - 1]!)));
}

/**
 * Antes esto pedía 2 llamadas (resumen+ranking) para anual/mensual y 6 (3
 * meses × 2) para trimestral — ahora siempre 1, vía `/tablero/kpis/rango`.
 */
export async function getResumenPeriodo(
  accessToken: string,
  opts: { anio: number; periodo: PeriodoResumen; mes?: number; trimestre?: number },
): Promise<ResumenPeriodoResult> {
  const { anio, periodo, mes, trimestre } = opts;

  const [mesInicio, mesFin] =
    periodo === 'trimestral'
      ? [mesesDelTrimestre(trimestre ?? 1)[0], mesesDelTrimestre(trimestre ?? 1)[2]]
      : periodo === 'mensual'
        ? [mes ?? 1, mes ?? 1]
        : [1, 12];

  return getResumenRango(accessToken, anio, mesInicio, mesFin);
}
