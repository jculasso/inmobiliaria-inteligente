import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getModeloPlantilla, listContratos, listPlantillas } from '../../../lib/alquileres-api';
import { PlantillasVista } from '../../../components/alquileres/plantillas-vista';

export const metadata = { title: 'Plantillas de contrato · Alquileres' };

export default async function PlantillasPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const [plantillas, modelo, contratos] = await Promise.all([listPlantillas(ctx.accessToken), getModeloPlantilla(ctx.accessToken), listContratos(ctx.accessToken)]);
  return <PlantillasVista plantillas={plantillas} modelo={modelo.cuerpo} contratos={contratos} />;
}
