import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import { getContrato, getContratoCompleto, getDocumentoContrato, getHistorialContrato } from '../../../../lib/alquileres-api';
import { ContratoFicha } from '../../../../components/alquileres/contrato-ficha';
import { FirmaContrato } from '../../../../components/alquileres/firma-contrato';
import { Historial } from '../../../../components/alquileres/historial';
import { CargosIngreso } from '../../../../components/alquileres/cargos-ingreso';
import { DepositoPanel } from '../../../../components/alquileres/deposito-panel';
import { Garantias } from '../../../../components/alquileres/garantias';

export const metadata = { title: 'Contrato · Alquileres' };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  const [contrato, { documento }, historial, completo] = await Promise.all([
    getContrato(ctx.accessToken, id),
    getDocumentoContrato(ctx.accessToken, id),
    getHistorialContrato(ctx.accessToken, id),
    getContratoCompleto(ctx.accessToken, id),
  ]);
  const garantes = contrato.partes.filter((p) => p.papel === 'garante').map((p) => ({ personaId: p.personaId, nombre: p.nombre }));
  return (
    <div className="flex flex-col gap-4">
      <ContratoFicha contrato={contrato} />
      <CargosIngreso contratoId={id} estado={contrato.estado} moneda={contrato.moneda} cargos={completo.cargos} />
      <DepositoPanel contratoId={id} deposito={completo.deposito} />
      <Garantias contratoId={id} garantias={completo.garantias} garantes={garantes} />
      <FirmaContrato contratoId={id} documento={documento} />
      <Historial eventos={historial} />
    </div>
  );
}
