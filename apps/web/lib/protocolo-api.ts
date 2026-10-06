import { z } from 'zod';
import {
  AccionActualizadaSchema,
  CandidataDtoSchema,
  ProtocoloDtoSchema,
  ProtocoloKpisSchema,
  ProtocoloResumenDtoSchema,
  DestinatarioReporteSchema,
  ReporteSemanalSchema,
  ResultadoEnvioSchema,
  type ArchivarProtocolo,
  type ProtocoloDto,
  type IniciarProtocolo,
  type ProtocoloFiltro,
  type UpdateAccion,
  type UpdateProtocolo,
} from '@vacker/types';
import { apiFetch, apiFetchPdf } from './api-client';

/** Tasaciones captadas que todavía no arrancaron el protocolo. */
export async function listCaptadas(accessToken: string, verTodo = false) {
  return apiFetch('/protocolo/captadas', z.array(CandidataDtoSchema), {
    accessToken,
    searchParams: { verTodo: verTodo ? '1' : undefined },
  });
}

export async function getProtocoloKpis(accessToken: string, verTodo = false) {
  return apiFetch('/protocolo/kpis', ProtocoloKpisSchema, {
    accessToken,
    searchParams: { verTodo: verTodo ? '1' : undefined },
  });
}

export async function listProtocolos(accessToken: string, filtro: ProtocoloFiltro = {}) {
  return apiFetch('/protocolo', z.array(ProtocoloResumenDtoSchema), {
    accessToken,
    searchParams: {
      estado: filtro.estado,
      anio: filtro.anio,
      mes: filtro.mes,
      trimestre: filtro.trimestre,
      verTodo: filtro.verTodo ? '1' : undefined,
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
  return apiFetch(`/protocolo/${id}`, ProtocoloDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

/**
 * Tildar una acción. Pide la respuesta liviana (`?liviana=1`: la acción, la
 * versión nueva y los derivados) y la aplica sobre la ficha que la pantalla ya
 * tiene: antes la API devolvía la ficha entera, con sus 29 acciones, en cada
 * tilde (revisión de performance del 6/10/2026). Si la API todavía es la
 * anterior y devuelve la ficha entera, se usa esa.
 */
export async function updateAccion(
  accessToken: string,
  actual: ProtocoloDto,
  accionId: string,
  dto: UpdateAccion,
): Promise<ProtocoloDto> {
  const r = await apiFetch(
    `/protocolo/${actual.id}/acciones/${accionId}`,
    z.union([AccionActualizadaSchema, ProtocoloDtoSchema]),
    { accessToken, method: 'PATCH', body: dto, searchParams: { liviana: 1 } },
  );
  if (!('accion' in r)) return r;
  return {
    ...actual,
    version: r.version,
    avance: r.avance,
    semanaActual: r.semanaActual,
    alertas: r.alertas,
    proximaAccion: r.proximaAccion,
    acciones: actual.acciones.map((a) => (a.id === r.accion.id ? r.accion : a)),
  };
}

export async function archivarProtocolo(accessToken: string, id: string, dto: ArchivarProtocolo) {
  return apiFetch(`/protocolo/${id}/archivar`, ProtocoloDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

/** Quiénes tienen marcado que reciben el reporte. */
export async function getDestinatariosReporte(accessToken: string) {
  return apiFetch('/protocolo/reporte-semanal/destinatarios', z.array(DestinatarioReporteSchema), {
    accessToken,
  });
}

/** Manda el reporte semanal por mail a quienes lo tengan marcado. */
export async function enviarReporteSemanal(accessToken: string) {
  return apiFetch('/protocolo/reporte-semanal/enviar', ResultadoEnvioSchema, {
    accessToken,
    method: 'POST',
  });
}

/** Genera el reporte semanal en PDF (el mismo que muestra la pantalla). */
export async function generarReporteSemanalPdf(accessToken: string) {
  return apiFetchPdf('/protocolo/reporte-semanal/pdf', { accessToken });
}

/** Genera el informe del propietario y devuelve el PDF. */
export async function generarInformeProtocolo(accessToken: string, id: string) {
  return apiFetchPdf(`/protocolo/${id}/informe`, { accessToken });
}

export async function desarchivarProtocolo(accessToken: string, id: string) {
  return apiFetch(`/protocolo/${id}/desarchivar`, ProtocoloDtoSchema, {
    accessToken,
    method: 'POST',
  });
}

/**
 * Reporte semanal de alertas agrupado por vendedor — el mismo que sale por
 * mail, servido a pedido. Solo dirección y admin del tenant (la API valida
 * con `ROLES_REPORTE_PROTOCOLO`).
 */
export async function getReporteSemanal(accessToken: string) {
  return apiFetch('/protocolo/reporte-semanal', ReporteSemanalSchema, { accessToken });
}
