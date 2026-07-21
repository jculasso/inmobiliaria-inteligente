import { listTenants } from '../../lib/admin-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { TenantsTable } from '../../components/admin/tenants-table';

export default async function AdminPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya validó sesión + rol; si esto igual falla es un problema
  // transitorio (ej. timeout hacia el backend) — mejor mostrar el error que
  // devolver una página en blanco sin explicación.
  if (!ctx) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');

  const tenants = await listTenants(ctx.accessToken);

  return <TenantsTable tenants={tenants} />;
}
