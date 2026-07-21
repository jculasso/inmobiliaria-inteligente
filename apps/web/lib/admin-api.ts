import { z } from 'zod';
import {
  TenantDtoSchema,
  UsuarioAdminDtoSchema,
  type CreateTenant,
  type CreateUsuarioAdmin,
  type ResetPassword,
  type UpdateTenant,
  type UpdateUsuarioAdmin,
} from '@vacker/types';
import { apiFetch, apiFetchForm } from './api-client';

// --- Inmobiliarias (tenants) ---

export async function listTenants(accessToken: string) {
  return apiFetch('/admin/tenants', z.array(TenantDtoSchema), { accessToken });
}

export async function createTenant(accessToken: string, dto: CreateTenant) {
  return apiFetch('/admin/tenants', TenantDtoSchema, { accessToken, method: 'POST', body: dto });
}

export async function updateTenant(accessToken: string, id: string, dto: UpdateTenant) {
  return apiFetch(`/admin/tenants/${id}`, TenantDtoSchema, { accessToken, method: 'PATCH', body: dto });
}

export async function subirLogoTenant(accessToken: string, id: string, file: File) {
  return apiFetchForm(`/admin/tenants/${id}/logo`, TenantDtoSchema, { accessToken, file });
}

// --- Usuarios de una inmobiliaria (con acceso real) ---

export async function listUsuariosDeTenant(accessToken: string, tenantId: string) {
  return apiFetch(`/admin/tenants/${tenantId}/usuarios`, z.array(UsuarioAdminDtoSchema), {
    accessToken,
  });
}

export async function createUsuarioAdmin(
  accessToken: string,
  tenantId: string,
  dto: CreateUsuarioAdmin,
) {
  return apiFetch(`/admin/tenants/${tenantId}/usuarios`, UsuarioAdminDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function updateUsuarioAdmin(
  accessToken: string,
  tenantId: string,
  id: string,
  dto: UpdateUsuarioAdmin,
) {
  return apiFetch(`/admin/tenants/${tenantId}/usuarios/${id}`, UsuarioAdminDtoSchema, {
    accessToken,
    method: 'PATCH',
    body: dto,
  });
}

export async function resetPasswordUsuario(
  accessToken: string,
  tenantId: string,
  id: string,
  dto: ResetPassword,
) {
  return apiFetch(
    `/admin/tenants/${tenantId}/usuarios/${id}/reset-password`,
    z.object({ id: z.string(), ok: z.literal(true) }),
    { accessToken, method: 'POST', body: dto },
  );
}

export async function activarAccesoUsuario(
  accessToken: string,
  tenantId: string,
  id: string,
  dto: ResetPassword,
) {
  return apiFetch(`/admin/tenants/${tenantId}/usuarios/${id}/activar-acceso`, UsuarioAdminDtoSchema, {
    accessToken,
    method: 'POST',
    body: dto,
  });
}

export async function subirFotoUsuario(accessToken: string, tenantId: string, id: string, file: File) {
  return apiFetchForm(`/admin/tenants/${tenantId}/usuarios/${id}/foto`, UsuarioAdminDtoSchema, {
    accessToken,
    file,
  });
}

export async function eliminarFotoUsuario(accessToken: string, tenantId: string, id: string) {
  return apiFetch(`/admin/tenants/${tenantId}/usuarios/${id}/foto`, UsuarioAdminDtoSchema, {
    accessToken,
    method: 'DELETE',
  });
}
