import { z } from 'zod';
import {
  BandejaIndexacionDtoSchema,
  ContratoDtoSchema,
  IndexacionConfirmadaDtoSchema,
  ContratoResumenDtoSchema,
  type CambiarEstadoContrato,
  type ContratoInput,
  PersonaDtoSchema,
  PropiedadAlquilerDtoSchema,
  ResumenAlquileresSchema,
  type PersonaInput,
  type PropiedadAlquilerInput,
} from '@vacker/types';
import { apiFetch } from './api-client';

/** Cuánto tiene cargado la inmobiliaria en el módulo (GET /alquileres/resumen). */
export async function getResumenAlquileres(accessToken: string) {
  return apiFetch('/alquileres/resumen', ResumenAlquileresSchema, { accessToken });
}

export async function listPersonas(accessToken: string) {
  return apiFetch('/alquileres/personas', z.array(PersonaDtoSchema), { accessToken });
}

export async function crearPersona(accessToken: string, dto: PersonaInput) {
  return apiFetch('/alquileres/personas', PersonaDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarPersona(accessToken: string, id: string, dto: PersonaInput) {
  return apiFetch(`/alquileres/personas/${id}`, PersonaDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function listPropiedadesAlquiler(accessToken: string) {
  return apiFetch('/alquileres/propiedades', z.array(PropiedadAlquilerDtoSchema), { accessToken });
}

export async function crearPropiedadAlquiler(accessToken: string, dto: PropiedadAlquilerInput) {
  return apiFetch('/alquileres/propiedades', PropiedadAlquilerDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarPropiedadAlquiler(accessToken: string, id: string, dto: PropiedadAlquilerInput) {
  return apiFetch(`/alquileres/propiedades/${id}`, PropiedadAlquilerDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function listContratos(accessToken: string) {
  return apiFetch('/alquileres/contratos', z.array(ContratoResumenDtoSchema), { accessToken });
}

export async function getContrato(accessToken: string, id: string) {
  return apiFetch(`/alquileres/contratos/${id}`, ContratoDtoSchema, { accessToken });
}

export async function crearContrato(accessToken: string, dto: ContratoInput) {
  return apiFetch('/alquileres/contratos', ContratoDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function actualizarContrato(accessToken: string, id: string, dto: ContratoInput) {
  return apiFetch(`/alquileres/contratos/${id}`, ContratoDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function cambiarEstadoContrato(accessToken: string, id: string, cambio: CambiarEstadoContrato) {
  return apiFetch(`/alquileres/contratos/${id}/estado`, ContratoDtoSchema, { accessToken, method: 'POST', body: cambio });
}

/** La bandeja «a indexar»: tramos con su propuesta y el estado de los índices. */
export async function getBandejaIndexacion(accessToken: string) {
  return apiFetch('/alquileres/indexaciones', BandejaIndexacionDtoSchema, { accessToken });
}

/** Confirma un tramo. `importe` solo para índices sin fuente (Casa Propia). */
export async function confirmarIndexacion(accessToken: string, tramoId: string, importe: number | null) {
  return apiFetch(`/alquileres/indexaciones/${tramoId}/confirmar`, IndexacionConfirmadaDtoSchema, {
    accessToken,
    method: 'POST',
    body: { importe },
  });
}
