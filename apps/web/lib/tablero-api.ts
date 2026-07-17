import { z } from 'zod';
import {
  ObjetivoSetDtoSchema,
  OperacionDtoSchema,
  RankingItemSchema,
  ResumenKpisSchema,
  SeguimientoObjetivoSchema,
  VendedorDtoSchema,
  type CreateOperacion,
  type CreateVendedor,
  type KpiFiltro,
  type ObjetivoInput,
  type OperacionFiltro,
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
