import { z } from 'zod';
import {
  RankingCaptacionItemSchema,
  ResumenTasadorKpiSchema,
  TasacionDtoSchema,
  TasacionFotoDtoSchema,
  type CambiarEstado,
  type CreateTasacion,
  type TasacionFiltro,
  type TasadorKpiFiltro,
  type UpdateTasacion,
} from '@vacker/types';
import { apiFetch, apiFetchForm } from './api-client';

export async function listTasaciones(accessToken: string, filtro: TasacionFiltro) {
  return apiFetch('/tasador/tasaciones', z.array(TasacionDtoSchema), {
    accessToken,
    searchParams: {
      anio: filtro.anio,
      mes: filtro.mes,
      estado: filtro.estado,
      agenteId: filtro.agenteId,
    },
  });
}

export async function getTasacion(accessToken: string, id: string) {
  return apiFetch(`/tasador/tasaciones/${id}`, TasacionDtoSchema, { accessToken });
}

export async function createTasacion(accessToken: string, dto: CreateTasacion) {
  return apiFetch('/tasador/tasaciones', TasacionDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function updateTasacion(accessToken: string, id: string, dto: UpdateTasacion) {
  return apiFetch(`/tasador/tasaciones/${id}`, TasacionDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function cambiarEstadoTasacion(accessToken: string, id: string, dto: CambiarEstado) {
  return apiFetch(`/tasador/tasaciones/${id}/estado`, TasacionDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function deleteTasacion(accessToken: string, id: string) {
  return apiFetch(`/tasador/tasaciones/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

export async function generarInforme(accessToken: string, id: string) {
  return apiFetch(`/tasador/tasaciones/${id}/informe`, z.object({ url: z.string() }), {
    accessToken,
    method: 'POST',
  });
}

export async function subirFotoTasacion(accessToken: string, tasacionId: string, file: File) {
  return apiFetchForm(`/tasador/tasaciones/${tasacionId}/fotos`, TasacionFotoDtoSchema, { accessToken, file });
}

export async function eliminarFotoTasacion(accessToken: string, tasacionId: string, fotoId: string) {
  return apiFetch(`/tasador/tasaciones/${tasacionId}/fotos/${fotoId}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'DELETE',
  });
}

// --- KPIs / dashboard ---

export async function getKpisResumenTasador(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetch('/tasador/kpis/resumen', ResumenTasadorKpiSchema, {
    accessToken,
    searchParams: { anio: filtro.anio, periodo: filtro.periodo, mes: filtro.mes, trimestre: filtro.trimestre },
  });
}

export async function getRankingCaptaciones(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetch('/tasador/kpis/ranking', z.array(RankingCaptacionItemSchema), {
    accessToken,
    searchParams: { anio: filtro.anio, periodo: filtro.periodo, mes: filtro.mes, trimestre: filtro.trimestre },
  });
}

/** Agregados de los 12 meses del año en una sola llamada de red. */
export async function getKpisMensualTasador(accessToken: string, anio: number) {
  return apiFetch('/tasador/kpis/mensual', z.array(ResumenTasadorKpiSchema), {
    accessToken,
    searchParams: { anio },
  });
}

// --- Reporte de tasaciones (período) ---

export async function generarInformeReporte(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetch('/tasador/reporte/informe', z.object({ url: z.string() }), {
    accessToken,
    method: 'POST',
    searchParams: { anio: filtro.anio, periodo: filtro.periodo, mes: filtro.mes, trimestre: filtro.trimestre },
  });
}
