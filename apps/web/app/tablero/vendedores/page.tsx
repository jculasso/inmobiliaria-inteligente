import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { listVendedores } from '../../../lib/tablero-api';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeGestionarVendedores, puedeVerVendedores } from '../../../lib/rbac';
import { VendedoresTable } from '../../../components/tablero/vendedores-table';

export default async function VendedoresPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  if (!puedeVerVendedores(ctx.principal.roles)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tenés acceso a esta sección</CardTitle>
          <CardDescription>
            Ver vendedores está disponible para Team Leader, Dirección y Administración del tenant.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const vendedores = await listVendedores(ctx.accessToken);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink">Vendedores</h2>
      <VendedoresTable vendedores={vendedores} puedeGestionar={puedeGestionarVendedores(ctx.principal.roles)} />
    </div>
  );
}
