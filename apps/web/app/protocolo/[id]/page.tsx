import { notFound } from 'next/navigation';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getProtocolo } from '../../../lib/protocolo-api';
import { ApiError } from '../../../lib/api-client';
import { DetalleProtocolo } from '../../../components/protocolo/detalle-protocolo';

export default async function ProtocoloDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const { id } = await params;
  try {
    const protocolo = await getProtocolo(ctx.accessToken, id);
    return <DetalleProtocolo inicial={protocolo} />;
  } catch (err) {
    // 404 también cubre "existe pero es de otro agente": la API no filtra
    // existencia fuera del alcance del rol.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
