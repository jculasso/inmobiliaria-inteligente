import { listTenants } from '../../lib/admin-api';
import { sesionServidor } from '../../lib/server-principal';
import { TenantsTable } from '../../components/admin/tenants-table';

export default async function AdminPage() {
  const s = await sesionServidor();
  // El layout ya validó sesión + rol; si esto igual falla es un problema
  // transitorio (ej. timeout hacia el backend) — mejor mostrar el error que
  // devolver una página en blanco sin explicación.
  if (!s) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');

  // En paralelo con `/me`: la lista no depende del rol (lo validó el layout).
  const [principal, tenants] = await Promise.all([s.principal, listTenants(s.accessToken)]);
  if (!principal) throw new Error('No se pudo cargar tu perfil. Probá recargar la página.');

  return <TenantsTable tenants={tenants} />;
}
