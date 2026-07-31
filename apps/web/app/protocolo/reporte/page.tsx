import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeVerReporteProtocolo } from '../../../lib/rbac';
import { getReporteSemanal } from '../../../lib/protocolo-api';
import { ReporteSemanalVista } from '../../../components/protocolo/reporte-semanal';
import { BotonReportePdf } from '../../../components/protocolo/boton-reporte-pdf';

// Se pide siempre fresco: el sentido de esta pantalla es correr el reporte
// cuando uno tiene un rato, no leer una copia de ayer.
export const dynamic = 'force-dynamic';

/** El mediodía fija el día: con 00:00 el offset de Argentina lo corre al anterior. */
function fmtDia(dia: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dia}T12:00:00-03:00`));
}

export default async function ReportePage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  // La API ya responde 403, pero sin esto la pantalla se vería rota en vez de
  // explicar por qué. El gate usa la MISMA constante que el @Roles.
  if (!puedeVerReporteProtocolo(ctx.principal.roles)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Este reporte es para la dirección</CardTitle>
          <CardDescription>
            Reúne las alertas de toda la inmobiliaria, agrupadas por vendedor. Tus propias
            propiedades y sus alertas las tenés en el dashboard del módulo.
          </CardDescription>
        </CardHeader>
        <Link href="/protocolo" className="text-sm font-semibold text-brand-red hover:underline">
          ← Ir al dashboard
        </Link>
      </Card>
    );
  }

  const reporte = await getReporteSemanal(ctx.accessToken);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Reporte semanal</h2>
          <p className="text-xs text-muted">
            Las alertas de las propiedades en comercialización, agrupadas por vendedor. Es el mismo
            que se manda por mail — generado al {fmtDia(reporte.generadoEl)}.
          </p>
        </div>
        <BotonReportePdf />
      </div>

      <ReporteSemanalVista reporte={reporte} />
    </div>
  );
}
