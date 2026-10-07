import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listPlantillas } from '../../../lib/alquileres-api';
import { PlantillasVista } from '../../../components/alquileres/plantillas-vista';

export const metadata = { title: 'Plantillas de contrato · Alquileres' };

export default async function PlantillasPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <PlantillasVista plantillas={await listPlantillas(ctx.accessToken)} />;
}
