import { Card } from './card';

export type KpiTone = 'default' | 'success' | 'warning' | 'brand';

const TONE_BG: Record<KpiTone, string> = {
  default: '',
  success: 'bg-success/5',
  warning: 'bg-warning/5',
  brand: 'bg-brand-red/5',
};

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: string;
  tone?: KpiTone;
  /** Si viene, la tarjeta se vuelve clickeable (drill-down al detalle). */
  onClick?: () => void;
}

/**
 * La seña de que la tarjeta se abre: una lupa con un «+» en la esquina, gris y
 * chiquita, que toma el color de la marca al pasar el mouse. Pedido de Javier
 * el 5/10/2026 — «algo gráfico muy sutil para que el que usa el tablero sepa
 * que puede hacer zoom». Sutil a propósito: las tarjetas son números, y un
 * botón o un subrayado competiría con el número.
 */
function Lupa() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-muted/40 transition-colors group-hover:text-brand-red group-focus-visible:text-brand-red"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.75" />
      <path d="M10.5 10.5 14 14M7 5v4M5 7h4" />
    </svg>
  );
}

export function KpiCard({ label, value, sub, icon, tone = 'default', onClick }: KpiCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        {icon && (
          <span aria-hidden className="text-base leading-none">
            {icon}
          </span>
        )}
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-extrabold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  );

  if (onClick) {
    return (
      <Card className={`p-0 ${TONE_BG[tone]}`}>
        <button
          type="button"
          onClick={onClick}
          aria-label={`${label}: ${value}. Ver el detalle`}
          className="group relative w-full rounded-brand p-4 pr-8 text-left transition-colors hover:bg-black/[0.03]"
        >
          <Lupa />
          {content}
        </button>
      </Card>
    );
  }

  return <Card className={`p-4 ${TONE_BG[tone]}`}>{content}</Card>;
}
