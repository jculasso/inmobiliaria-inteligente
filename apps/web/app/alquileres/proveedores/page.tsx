import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { getReporteGastos, listComprobantes, listContratos, listProveedores } from '../../../lib/alquileres-api';
import { ProveedoresVista } from '../../../components/alquileres/proveedores-vista';

export const metadata = { title: 'Proveedores · Alquileres' };

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ anio?: string; ver?: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  const q = await searchParams;
  const anio = Number(q.anio) || new Date().getFullYear();
  const estado = q.ver === 'todos' ? 'todos' : 'pendientes';
  const [proveedores, comprobantes, reporte, contratos] = await Promise.all([
    listProveedores(ctx.accessToken),
    listComprobantes(ctx.accessToken, { estado }),
    getReporteGastos(ctx.accessToken, anio),
    listContratos(ctx.accessToken),
  ]);
  return <ProveedoresVista proveedores={proveedores} comprobantes={comprobantes} reporte={reporte} contratos={contratos} estado={estado} />;
}
