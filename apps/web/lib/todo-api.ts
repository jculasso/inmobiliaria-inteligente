import { z } from 'zod';
import { TodoEstadoDtoSchema, TodoEventosDtoSchema, type TodoVista } from '@vacker/types';
import { apiFetch } from './api-client';

/** Estado de conexión con Google del usuario actual. */
export async function getTodoEstado(accessToken: string) {
  return apiFetch('/todo/estado', TodoEstadoDtoSchema, { accessToken });
}

/** URL de Google para iniciar la conexión del calendario (el front redirige a ella). */
export async function getTodoConnectUrl(accessToken: string) {
  return apiFetch('/todo/google/connect', z.object({ url: z.string() }), { accessToken });
}

/** Eventos del calendario principal en la vista/fecha pedidas. */
export async function getTodoEventos(accessToken: string, vista: TodoVista, fecha?: string) {
  return apiFetch('/todo/eventos', TodoEventosDtoSchema, {
    accessToken,
    searchParams: { vista, fecha },
  });
}

/** Desconecta el Google del usuario actual. */
export async function desconectarTodo(accessToken: string) {
  return apiFetch('/todo/google', z.object({ ok: z.boolean() }), {
    accessToken,
    method: 'DELETE',
  });
}
