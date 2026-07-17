import type { SeguimientoObjetivo } from '@vacker/types';
import { Card, CardHeader, CardTitle } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';

function Avance({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  const color = clamped >= 1 ? 'bg-success' : clamped >= 0.7 ? 'bg-warning' : 'bg-brand-red';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
        <div className={`h-full ${color}`} style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className="text-xs text-muted">{Math.round(pct * 100)}%</span>
    </div>
  );
}

export function ObjetivosTable({ items }: { items: SeguimientoObjetivo[] }) {
  if (items.length === 0) return null;

  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-4">
        <CardTitle>Seguimiento de objetivos</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-2">Vendedor</th>
              <th className="px-5 py-2">Comisión (real / obj.)</th>
              <th className="px-5 py-2">Avance comisión</th>
              <th className="px-5 py-2">Volumen (real / obj.)</th>
              <th className="px-5 py-2">Puntas (real / obj.)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.usuarioId} className="border-t border-line">
                <td className="px-5 py-2 font-medium text-ink">{it.nombre}</td>
                <td className="px-5 py-2">
                  {fmtUSD(it.realComision)} / {fmtUSD(it.objComision)}
                </td>
                <td className="px-5 py-2">
                  <Avance pct={it.avanceComision} />
                </td>
                <td className="px-5 py-2">
                  {fmtUSD(it.realVolumen)} / {fmtUSD(it.objVolumen)}
                </td>
                <td className="px-5 py-2">
                  {it.realPuntas} / {it.objPuntas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
