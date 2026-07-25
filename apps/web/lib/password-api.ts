import { z } from 'zod';
import { type CambiarPassword } from '@vacker/types';
import { apiFetch } from './api-client';

/** Cambia la contraseña del usuario autenticado. */
export async function cambiarPassword(accessToken: string, dto: CambiarPassword) {
  return apiFetch('/me/password', z.object({ ok: z.boolean() }), {
    accessToken,
    method: 'POST',
    body: dto,
  });
}
