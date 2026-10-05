import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { listPersonas, listPropiedadesAlquiler } from '../../../../lib/alquileres-api';
import { ContratoForm } from '../../../../components/alquileres/contrato-form';

export const metadata = { title: 'Nuevo contrato · Alquileres' };

export default async function NuevoContratoPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [personas, propiedades] = await Promise.all([listPersonas(ctx.accessToken), listPropiedadesAlquiler(ctx.accessToken)]);
  return <ContratoForm personas={personas} propiedades={propiedades} />;
}
