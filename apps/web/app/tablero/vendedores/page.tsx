import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { listVendedores } from '../../../lib/tablero-api';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeGestionarVendedores, puedeVerVendedores } from '../../../lib/rbac';
import { VendedoresTable } from '../../../components/tablero/vendedores-table';
import { EncabezadoPagina } from '../../../components/piezas';

export default async function VendedoresPage() {
  // Acá el rol va ANTES (no `sesionServidor`): decide si se piden los
  // vendedores, que para quien no los puede ver serían un 403.
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
      <EncabezadoPagina titulo="Vendedores" />
      <VendedoresTable
        vendedores={vendedores}
        puedeGestionar={puedeGestionarVendedores(ctx.principal.roles)}
      />
    </div>
  );
}
