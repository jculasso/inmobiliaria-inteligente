import { z } from 'zod';
import {
  CandidataDtoSchema,
  ProtocoloDtoSchema,
  ProtocoloKpisSchema,
  ProtocoloResumenDtoSchema,
  type ArchivarProtocolo,
  type IniciarProtocolo,
  type ProtocoloFiltro,
  type UpdateAccion,
  type UpdateProtocolo,
} from '@vacker/types';
import { apiFetch } from './api-client';

/** Tasaciones captadas que todavía no arrancaron el protocolo. */
export async function listCaptadas(accessToken: string, soloMio = false) {
  return apiFetch('/protocolo/captadas', z.array(CandidataDtoSchema), {
    accessToken,
    searchParams: { soloMio: soloMio ? '1' : undefined },
  });
}

export async function getProtocoloKpis(accessToken: string, soloMio = false) {
  return apiFetch('/protocolo/kpis', ProtocoloKpisSchema, {
    accessToken,
    searchParams: { soloMio: soloMio ? '1' : undefined },
  });
}

export async function listProtocolos(accessToken: string, filtro: ProtocoloFiltro = {}) {
  return apiFetch('/protocolo', z.array(ProtocoloResumenDtoSchema), {
    accessToken,
    searchParams: {
      estado: filtro.estado,
      anio: filtro.anio,
      soloMio: filtro.soloMio ? '1' : undefined,
    },
  });
}

export async function getProtocolo(accessToken: string, id: string) {
  return apiFetch(`/protocolo/${id}`, ProtocoloDtoSchema, { accessToken });
}

export async function iniciarProtocolo(accessToken: string, dto: IniciarProtocolo) {
  return apiFetch('/protocolo', ProtocoloDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function updateProtocolo(accessToken: string, id: string, dto: UpdateProtocolo) {
  return apiFetch(`/protocolo/${id}`, ProtocoloDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function updateAccion(
  accessToken: string,
  id: string,
  accionId: string,
  dto: UpdateAccion,
) {
  return apiFetch(`/protocolo/${id}/acciones/${accionId}`, ProtocoloDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function archivarProtocolo(accessToken: string, id: string, dto: ArchivarProtocolo) {
  return apiFetch(`/protocolo/${id}/archivar`, ProtocoloDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

/** Genera el informe del propietario y devuelve la URL firmada del PDF. */
export async function generarInformeProtocolo(accessToken: string, id: string) {
  return apiFetch(`/protocolo/${id}/informe`, z.object({ url: z.string() }), {
    accessToken,
    method: 'POST',
  });
}

export async function desarchivarProtocolo(accessToken: string, id: string) {
  return apiFetch(`/protocolo/${id}/desarchivar`, ProtocoloDtoSchema, { accessToken, method: 'POST' });
}
