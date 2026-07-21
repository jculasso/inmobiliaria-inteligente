import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listTenants, listUsuariosDeTenant } from '../../../../lib/admin-api';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { UsuariosAdminTable } from '../../../../components/admin/usuarios-admin-table';

export default async function AdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireServerPrincipal();
  // El layout ya validó sesión + rol; si esto igual falla es un problema
  // transitorio (ej. timeout hacia el backend) — mejor mostrar el error que
  // devolver una página en blanco sin explicación.
  if (!ctx) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');

  const [tenants, usuarios] = await Promise.all([
    listTenants(ctx.accessToken),
    listUsuariosDeTenant(ctx.accessToken, id),
  ]);
  const tenant = tenants.find((t) => t.id === id);
  if (!tenant) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm font-medium text-brand-red hover:underline">
          ← Todas las inmobiliarias
        </Link>
        <h2 className="mt-1 text-xl font-extrabold text-ink">{tenant.nombre}</h2>
        <p className="text-sm text-muted">
          Slug: {tenant.slug} · Plan: {tenant.plan} · Estado: {tenant.estado}
        </p>
      </div>

      <UsuariosAdminTable tenantId={tenant.id} usuarios={usuarios} />
    </div>
  );
}
