import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../../lib/server-principal';
import {
  getContrato,
  getContratoCompleto,
  getDocumentoContrato,
  getHistorialContrato,
  listPlantillas,
  listPolizas,
  listReclamos,
} from '../../../../lib/alquileres-api';
import { ContratoFicha } from '../../../../components/alquileres/contrato-ficha';
import { FirmaContrato } from '../../../../components/alquileres/firma-contrato';
import { Historial } from '../../../../components/alquileres/historial';
import { CargosIngreso } from '../../../../components/alquileres/cargos-ingreso';
import { DepositoPanel } from '../../../../components/alquileres/deposito-panel';
import { Garantias } from '../../../../components/alquileres/garantias';
import { GenerarContrato } from '../../../../components/alquileres/generar-contrato';
import { ReclamosDelContrato } from '../../../../components/alquileres/reclamos-del-contrato';
import { Polizas } from '../../../../components/alquileres/polizas';

export const metadata = { title: 'Contrato · Alquileres' };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const { id } = await params;
  // Todo junto: ninguna de estas depende de otra (antes iban en dos tandas seguidas).
  const [contrato, { documento }, historial, completo, plantillas, reclamos, polizas] =
    await Promise.all([
      getContrato(ctx.accessToken, id),
      getDocumentoContrato(ctx.accessToken, id),
      getHistorialContrato(ctx.accessToken, id),
      getContratoCompleto(ctx.accessToken, id),
      listPlantillas(ctx.accessToken),
      listReclamos(ctx.accessToken, { estado: 'todos', contratoId: id }),
      listPolizas(ctx.accessToken, id),
    ]);
  const garantes = contrato.partes
    .filter((p) => p.papel === 'garante')
    .map((p) => ({ personaId: p.personaId, nombre: p.nombre }));
  return (
    <div className="flex flex-col gap-4">
      <ContratoFicha contrato={contrato} />
      <CargosIngreso
        contratoId={id}
        estado={contrato.estado}
        moneda={contrato.moneda}
        cargos={completo.cargos}
      />
      <DepositoPanel contratoId={id} deposito={completo.deposito} />
      <Garantias contratoId={id} garantias={completo.garantias} garantes={garantes} />
      <Polizas polizas={polizas} contratos={[]} contratoFijo={id} moneda={contrato.moneda} />
      <GenerarContrato contrato={contrato} plantillas={plantillas} documento={documento} />
      <FirmaContrato contratoId={id} documento={documento} />
      <ReclamosDelContrato contrato={contrato} reclamos={reclamos} />
      <Historial eventos={historial} />
    </div>
  );
}
