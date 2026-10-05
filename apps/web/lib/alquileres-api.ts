import { ResumenAlquileresSchema } from '@vacker/types';
import { apiFetch } from './api-client';

/** Cuánto tiene cargado la inmobiliaria en el módulo (GET /alquileres/resumen). */
export async function getResumenAlquileres(accessToken: string) {
  return apiFetch('/alquileres/resumen', ResumenAlquileresSchema, { accessToken });
}
