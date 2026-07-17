import { Prisma } from '@prisma/client';
import type { AuthPrincipal } from '../../auth/auth-principal';
import type { TenantContext } from '../../prisma/tenant-context';

/** Deriva el TenantContext (tenant/user/roles) a partir del principal autenticado. */
export function ctxDe(user: AuthPrincipal): TenantContext {
  return { tenantId: user.tenantId, userId: user.userId, roles: user.roles };
}

/** Convierte un Decimal de Prisma (o null) a number para las respuestas de la API. */
export function decToNum(value: Prisma.Decimal | null | undefined): number {
  return value == null ? 0 : Number(value);
}

/** Parsea `YYYY-MM-DD` a Date (UTC) o null. */
export function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

/** Formatea un Date de Prisma (@db.Date) como `YYYY-MM-DD` o null. */
export function fromDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Deriva { anio, mes } de la fecha de firma (o, en su defecto, la de reserva),
 * como hace el prototipo (`opAnio`/`opMes`). null si no hay ninguna.
 */
export function derivarPeriodo(
  fechaFirma: string | null | undefined,
  fechaReserva: string | null | undefined,
): { anio: number | null; mes: number | null } {
  const ref = fechaFirma ?? fechaReserva ?? null;
  if (!ref) return { anio: null, mes: null };
  return { anio: Number(ref.slice(0, 4)), mes: Number(ref.slice(5, 7)) };
}
