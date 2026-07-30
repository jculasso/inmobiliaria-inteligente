import {
  CredencialEstadoSchema,
  PruebaConexionSchema,
  type CredencialEstado,
  type PruebaConexion,
} from '@vacker/types';
import { apiFetch } from './api-client';

/**
 * Credencial de Tokko del tenant.
 *
 * Ninguna de estas funciones recibe ni devuelve el secreto en claro salvo al
 * guardarlo: la API expone si está configurada y sus últimos 4 caracteres.
 */

export async function getCredencial(accessToken: string): Promise<CredencialEstado> {
  return apiFetch('/publicacion/credencial', CredencialEstadoSchema, { accessToken });
}

export async function guardarCredencial(accessToken: string, secreto: string): Promise<CredencialEstado> {
  return apiFetch('/publicacion/credencial', CredencialEstadoSchema, {
    accessToken,
    method: 'PUT',
    body: { secreto },
  });
}

export async function borrarCredencial(accessToken: string): Promise<CredencialEstado> {
  return apiFetch('/publicacion/credencial', CredencialEstadoSchema, {
    accessToken,
    method: 'DELETE',
  });
}

export async function probarConexion(accessToken: string): Promise<PruebaConexion> {
  return apiFetch('/publicacion/credencial/probar', PruebaConexionSchema, {
    accessToken,
    method: 'POST',
  });
}
