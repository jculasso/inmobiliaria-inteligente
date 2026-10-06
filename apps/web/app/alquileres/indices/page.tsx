import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getIndices } from '../../../lib/alquileres-api';
import { IndicesVista } from '../../../components/alquileres/indices-vista';

export const metadata = { title: 'Índices · Alquileres' };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Punto 3 de Javier: dónde ver el ICL y el IPC. El rango del ICL va en la dirección. */
export default async function IndicesPage({ searchParams }: { searchParams: Promise<{ ver?: string; desde?: string; hasta?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const q = await searchParams;
  const desde = q.desde && FECHA.test(q.desde) ? q.desde : undefined;
  const hasta = q.hasta && FECHA.test(q.hasta) ? q.hasta : undefined;
  const [icl, ipc] = await Promise.all([getIndices(ctx.accessToken, { indice: 'ICL', desde, hasta }), getIndices(ctx.accessToken, { indice: 'IPC' })]);
  return <IndicesVista icl={icl} ipc={ipc} ver={q.ver === 'ipc' ? 'ipc' : 'icl'} />;
}
