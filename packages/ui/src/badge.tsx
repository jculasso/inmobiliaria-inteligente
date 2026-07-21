import * as React from 'react';
import { cn } from './lib/cn';

/**
 * Estados de módulo/UI definidos en el prototipo de la Home (CLAUDE.md §6):
 *  - activo → verde  · dev → ámbar  · soon → gris
 */
const variantClasses = {
  activo: 'bg-success/10 text-success',
  dev: 'bg-warning/10 text-warning',
  soon: 'bg-inactive text-muted',
} as const;

export type BadgeVariant = keyof typeof variantClasses;

/** Etiqueta por defecto de cada estado (se puede sobrescribir con children). */
export const BADGE_LABEL: Record<BadgeVariant, string> = {
  activo: 'Activo',
  dev: 'En desarrollo',
  soon: 'Próximamente',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'activo', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children ?? BADGE_LABEL[variant]}
    </span>
  );
}
