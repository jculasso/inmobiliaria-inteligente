'use client';

import type { ReactNode } from 'react';

export const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red';

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function CheckPills({
  label,
  opciones,
  valores,
  onToggle,
}: {
  label: string;
  opciones: readonly string[];
  valores: string[];
  onToggle: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              valores.includes(o)
                ? 'border-brand-red bg-brand-red/10 text-brand-red'
                : 'border-line text-muted hover:border-brand-red/40'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
