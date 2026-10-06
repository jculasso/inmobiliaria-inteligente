import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getContrato, getDocumentoContrato, getHistorialContrato } from '../../../../lib/alquileres-api';
import { ContratoFicha } from '../../../../components/alquileres/contrato-ficha';
import { FirmaContrato } from '../../../../components/alquileres/firma-contrato';
import { Historial } from '../../../../components/alquileres/historial';

export const metadata = { title: 'Contrato · Alquileres' };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [contrato, { documento }, historial] = await Promise.all([
    getContrato(ctx.accessToken, id),
    getDocumentoContrato(ctx.accessToken, id),
    getHistorialContrato(ctx.accessToken, id),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <ContratoFicha contrato={contrato} />
      <FirmaContrato contratoId={id} documento={documento} />
      <Historial eventos={historial} />
    </div>
  );
}
