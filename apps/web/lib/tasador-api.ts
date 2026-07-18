import { z } from 'zod';
import {
  TasacionDtoSchema,
  type CambiarEstado,
  type CreateTasacion,
  type TasacionFiltro,
  type UpdateTasacion,
} from '@vacker/types';
import { apiFetch } from './api-client';

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
