import { Card } from '@vacker/ui';

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
          className="w-full rounded-brand p-4 text-left transition-colors hover:bg-black/[0.03]"
        >
          {content}
        </button>
      </Card>
    );
  }

  return <Card className={`p-4 ${TONE_BG[tone]}`}>{content}</Card>;
}
