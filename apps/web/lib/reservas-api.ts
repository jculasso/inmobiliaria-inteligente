import { z } from 'zod';
import {
  ContratoDtoSchema,
  InventarioDtoSchema,
  ReservaDelContratoDtoSchema,
  ReservaDtoSchema,
  ReservaResumenDtoSchema,
  type CambioEstadoReserva,
  type CobrarSenaInput,
  type ContratoInput,
  type FiltroReservas,
  type GarantiaInput,
  type InventarioInput,
  type ReservaInput,
} from '@vacker/types';
import { apiFetch, apiFetchArchivo } from './api-client';

// La reserva y el inventario del contrato (entrega C, reglas 150 a 168).
// En archivo propio para no engordar `alquileres-api.ts`.

export async function listReservas(accessToken: string, estado: FiltroReservas = 'abiertas') {
  return apiFetch('/alquileres/reservas', z.array(ReservaResumenDtoSchema), {
    accessToken,
    searchParams: estado === 'abiertas' ? {} : { estado },
  });
}

export async function getReserva(accessToken: string, id: string) {
  return apiFetch(`/alquileres/reservas/${id}`, ReservaDtoSchema, { accessToken });
}

export async function crearReserva(accessToken: string, dto: ReservaInput) {
  return apiFetch('/alquileres/reservas', ReservaDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function actualizarReserva(accessToken: string, id: string, dto: ReservaInput) {
  return apiFetch(`/alquileres/reservas/${id}`, ReservaDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function cambiarEstadoReserva(
  accessToken: string,
  id: string,
  cambio: CambioEstadoReserva,
) {
  return apiFetch(`/alquileres/reservas/${id}/estado`, ReservaDtoSchema, {
    accessToken,
    method: 'POST',
    body: cambio,
  });
}

export async function guardarGarantiasReserva(
  accessToken: string,
  id: string,
  garantias: GarantiaInput[],
) {
  return apiFetch(`/alquileres/reservas/${id}/garantias`, ReservaDtoSchema, {
    accessToken,
    method: 'PUT',
    body: { garantias },
  });
}

/** Regla 169: cobrar la seña da el recibo de Cobros, a nombre del interesado. */
export async function cobrarSenaReserva(accessToken: string, id: string, pago: CobrarSenaInput) {
  return apiFetch(`/alquileres/reservas/${id}/sena`, ReservaDtoSchema, {
    accessToken,
    method: 'POST',
    body: pago,
  });
}

/** Regla 159: el contrato que sale de la reserva, y la reserva convertida, todo junto. */
export async function convertirReserva(accessToken: string, id: string, dto: ContratoInput) {
  return apiFetch(`/alquileres/reservas/${id}/convertir`, ContratoDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

/** Regla 161: la reserva de la que salió un contrato, con su seña. */
export async function getReservaDelContrato(accessToken: string, contratoId: string) {
  return apiFetch(`/alquileres/reservas/del-contrato/${contratoId}`, ReservaDelContratoDtoSchema, {
    accessToken,
  });
}

/** Regla 163: la reserva en Word, desde una plantilla de reserva. */
export async function generarReservaEnWord(
  accessToken: string,
  reservaId: string,
  plantillaId: string,
) {
  return apiFetchArchivo(`/alquileres/reservas/${reservaId}/generar-desde-plantilla`, {
    accessToken,
    method: 'POST',
    body: { plantillaId },
    nombrePorDefecto: 'Reserva.docx',
  });
}

/** El Word de ejemplo de una reserva, con todos sus marcadores. */
export async function descargarEjemploReserva(accessToken: string) {
  return apiFetchArchivo('/alquileres/plantillas/ejemplo-reserva', {
    accessToken,
    nombrePorDefecto: 'Plantilla de reserva - ejemplo.docx',
  });
}

export async function getInventario(accessToken: string, contratoId: string) {
  return apiFetch(`/alquileres/contratos/${contratoId}/inventario`, InventarioDtoSchema, {
    accessToken,
  });
}

export async function guardarInventario(
  accessToken: string,
  contratoId: string,
  inventario: InventarioInput,
) {
  return apiFetch(`/alquileres/contratos/${contratoId}/inventario`, InventarioDtoSchema, {
    accessToken,
    method: 'PUT',
    body: inventario,
  });
}

/** Regla 174: el anexo de inventario en Word; sin plantilla, con el modelo de la plataforma. */
export async function generarAnexoInventario(
  accessToken: string,
  contratoId: string,
  plantillaId: string | null,
) {
  return apiFetchArchivo(`/alquileres/contratos/${contratoId}/anexo-inventario`, {
    accessToken,
    method: 'POST',
    body: { plantillaId },
    nombrePorDefecto: 'Anexo-inventario.docx',
  });
}

/** Regla 174: el Word de ejemplo del anexo de inventario. */
export async function descargarEjemploAnexo(accessToken: string) {
  return apiFetchArchivo('/alquileres/plantillas/ejemplo-inventario', {
    accessToken,
    nombrePorDefecto: 'Plantilla de anexo de inventario - ejemplo.docx',
  });
}
