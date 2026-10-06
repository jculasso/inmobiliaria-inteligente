import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getConfiguracionAlquileres } from '../../../lib/alquileres-api';
import { ConfiguracionForm } from '../../../components/alquileres/configuracion-form';

export const metadata = { title: 'Configuración · Alquileres' };

export default async function ConfiguracionPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <ConfiguracionForm inicial={await getConfiguracionAlquileres(ctx.accessToken)} />;
}
