import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import {
  listContratos,
  listPersonas,
  listPropiedadesAlquiler,
} from '../../../../lib/alquileres-api';
import { ReservaForm } from '../../../../components/alquileres/reserva-form';

export const metadata = { title: 'Nueva reserva · Alquileres' };

export default async function NuevaReservaPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  // Los contratos: para proponer los propietarios de la propiedad que se elige.
  const [personas, propiedades, contratos] = await Promise.all([
    listPersonas(ctx.accessToken),
    listPropiedadesAlquiler(ctx.accessToken),
    listContratos(ctx.accessToken),
  ]);
  return <ReservaForm personas={personas} propiedades={propiedades} contratos={contratos} />;
}
