import { z } from 'zod';
import {
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
