import { redirect } from 'next/navigation';
import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../../lib/server-principal';
import { getContrato, listPersonas, listPropiedadesAlquiler } from '../../../../../lib/alquileres-api';
import { ContratoForm } from '../../../../../components/alquileres/contrato-form';

export const metadata = { title: 'Editar contrato · Alquileres' };

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [contrato, personas, propiedades] = await Promise.all([
    getContrato(ctx.accessToken, id),
    listPersonas(ctx.accessToken),
    listPropiedadesAlquiler(ctx.accessToken),
  ]);
  // Solo un borrador se edita completo: la API lo rechazaría igual.
  if (contrato.estado !== 'borrador') redirect(`/alquileres/contratos/${id}`);
  return <ContratoForm personas={personas} propiedades={propiedades} contrato={contrato} />;
}
