import * as React from 'react';
import { cn } from './lib/cn';

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-11 w-11 text-base',
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  nombre: string;
  fotoUrl?: string | null;
  size?: AvatarSize;
}

/**
 * Avatar circular: foto si `fotoUrl` está cargada, si no el círculo con la
 * inicial del nombre (mismo estilo ya usado en el ranking de captaciones del
 * Tasador, ahora compartido para no duplicarlo en cada lugar que muestra un
 * vendedor/agente).
 */
export function Avatar({ nombre, fotoUrl, size = 'sm', className, ...props }: AvatarProps) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nombre}
        className={cn('shrink-0 rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success to-[#167a45] font-extrabold text-white',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {(nombre || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
