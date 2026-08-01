import { apiFetchZip } from './api-client';

/** Descarga todos los datos de la inmobiliaria en planillas. */
export async function exportarDatos(accessToken: string) {
  return apiFetchZip('/exportacion', { accessToken });
}
