import { z } from 'zod';
import {
  RankingCaptacionItemSchema,
  ResumenTasadorKpiSchema,
  TasacionDtoSchema,
  TasacionFotoDtoSchema,
  TasacionResumenDtoSchema,
  type CambiarEstado,
  type CreateTasacion,
  type TasacionFiltro,
  type TasadorKpiFiltro,
  type UpdateTasacion,
} from '@vacker/types';
import { apiFetch, apiFetchPdf, apiFetchForm } from './api-client';

export async function listTasaciones(accessToken: string, filtro: TasacionFiltro) {
  return apiFetch('/tasador/tasaciones', z.array(TasacionDtoSchema), {
    accessToken,
    searchParams: {
      anio: filtro.anio,
      mes: filtro.mes,
      estado: filtro.estado,
      agenteId: filtro.agenteId,
      verTodo: filtro.verTodo ? 1 : undefined,
    },
  });
}

/** Igual que `listTasaciones` pero liviano (sin comparables/fotos/análisis) — para el dashboard. */
export async function listTasacionesResumen(accessToken: string, filtro: TasacionFiltro) {
  return apiFetch('/tasador/tasaciones/resumen', z.array(TasacionResumenDtoSchema), {
    accessToken,
    searchParams: {
      anio: filtro.anio,
      mes: filtro.mes,
      estado: filtro.estado,
      agenteId: filtro.agenteId,
      verTodo: filtro.verTodo ? 1 : undefined,
    },
  });
}

export async function getTasacion(accessToken: string, id: string) {
  return apiFetch(`/tasador/tasaciones/${id}`, TasacionDtoSchema, { accessToken });
}

/** El wizard solo lee `.id` (para navegar a `/[id]/editar`) — el backend responde liviano. */
export async function createTasacion(accessToken: string, dto: CreateTasacion) {
  return apiFetch('/tasador/tasaciones', z.object({ id: z.string() }), {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

/**
 * El wizard guarda por sección (hasta 6 PATCH por edición) y nunca usa la
 * fila devuelta — el backend responde liviano ({ id }) en vez del DTO
 * completo con comparables/fotos, que era trabajo de más en cada guardado.
 */
export async function updateTasacion(accessToken: string, id: string, dto: UpdateTasacion) {
  return apiFetch(`/tasador/tasaciones/${id}`, z.object({ id: z.string() }), {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

/** El modal ya conoce el resultado (lo construyó para el `body`); nadie lee el DTO completo de vuelta. */
export async function cambiarEstadoTasacion(accessToken: string, id: string, dto: CambiarEstado) {
  return apiFetch(`/tasador/tasaciones/${id}/estado`, z.object({ id: z.string() }), {
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

/** Devuelve el PDF del informe (la API lo manda en la respuesta, no una URL). */
export async function generarInforme(accessToken: string, id: string) {
  return apiFetchPdf(`/tasador/tasaciones/${id}/informe`, { accessToken });
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

/**
 * Traduce el filtro del Tasador a query params, en UN solo lugar.
 *
 * Antes cada función armaba el objeto campo por campo, y `generarInformeReporte`
 * se olvidaba de `verTodo`: la pantalla mostraba toda la inmobiliaria y el PDF
 * salía con el alcance por defecto —lo propio—. A un usuario de dirección sin
 * tasaciones propias le salía el reporte en cero.
 *
 * Que el mapeo esté acá es lo que impide que vuelvan a divergir: no hay dónde
 * olvidarse un campo.
 */
function paramsDelFiltro(filtro: TasadorKpiFiltro) {
  return {
    anio: filtro.anio,
    periodo: filtro.periodo,
    mes: filtro.mes,
    trimestre: filtro.trimestre,
    // `apiFetch` no acepta booleanos en los params; el backend lo lee con
    // `z.coerce.boolean()`, para el que `1` es true y la ausencia es false.
    verTodo: filtro.verTodo ? (1 as const) : undefined,
  };
}

export async function getKpisResumenTasador(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetch('/tasador/kpis/resumen', ResumenTasadorKpiSchema, {
    accessToken,
    searchParams: paramsDelFiltro(filtro),
  });
}

export async function getRankingCaptaciones(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetch('/tasador/kpis/ranking', z.array(RankingCaptacionItemSchema), {
    accessToken,
    searchParams: paramsDelFiltro(filtro),
  });
}

/** Agregados de los 12 meses del año en una sola llamada de red. */
export async function getKpisMensualTasador(accessToken: string, anio: number, verTodo?: boolean) {
  return apiFetch('/tasador/kpis/mensual', z.array(ResumenTasadorKpiSchema), {
    accessToken,
    searchParams: { anio, verTodo: verTodo ? 1 : undefined },
  });
}

// --- Reporte de tasaciones (período) ---

export async function generarInformeReporte(accessToken: string, filtro: TasadorKpiFiltro) {
  return apiFetchPdf('/tasador/reporte/informe', {
    accessToken,
    searchParams: paramsDelFiltro(filtro),
  });
}
