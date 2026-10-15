import { defectosDeContrato, puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import {
  getConfiguracionAlquileres,
  listPersonas,
  listPropiedadesAlquiler,
} from '../../../../lib/alquileres-api';
import { ContratoForm } from '../../../../components/alquileres/contrato-form';

export const metadata = { title: 'Nuevo contrato · Alquileres' };

export default async function NuevoContratoPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [personas, propiedades, configuracion] = await Promise.all([
    listPersonas(ctx.accessToken),
    listPropiedadesAlquiler(ctx.accessToken),
    getConfiguracionAlquileres(ctx.accessToken),
  ]);
  // Regla 99: un contrato nuevo arranca con los valores de la inmobiliaria.
  return (
    <ContratoForm
      personas={personas}
      propiedades={propiedades}
      defectos={defectosDeContrato(configuracion)}
    />
  );
}
