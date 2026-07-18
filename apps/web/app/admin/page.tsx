import { listTenants } from '../../lib/admin-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { TenantsTable } from '../../components/admin/tenants-table';

export default async function AdminPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const tenants = await listTenants(ctx.accessToken);

  return <TenantsTable tenants={tenants} />;
}
