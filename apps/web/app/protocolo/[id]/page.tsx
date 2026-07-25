import { notFound } from 'next/navigation';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getProtocolo } from '../../../lib/protocolo-api';
import { ApiError } from '../../../lib/api-client';
import { DetalleProtocolo } from '../../../components/protocolo/detalle-protocolo';

export default async function ProtocoloDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const { id } = await params;
  // Las alertas del dashboard linkean con ?semana=N para abrir directo donde
  // está el problema, sin que el usuario tenga que buscarlo.
  const semanaPedida = Number((await searchParams).semana);
  try {
    const protocolo = await getProtocolo(ctx.accessToken, id);
    return (
      <DetalleProtocolo
        inicial={protocolo}
        semanaInicial={semanaPedida >= 1 && semanaPedida <= 5 ? semanaPedida : undefined}
      />
    );
  } catch (err) {
    // 404 también cubre "existe pero es de otro agente": la API no filtra
    // existencia fuera del alcance del rol.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
