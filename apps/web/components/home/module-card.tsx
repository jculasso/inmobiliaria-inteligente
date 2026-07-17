import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@vacker/ui';
import type { BadgeVariant } from '@vacker/ui';

const ACCENTO: Record<BadgeVariant, string> = {
  activo: 'bg-success',
  dev: 'bg-warning',
  soon: 'bg-[#CBCBD0]',
};

const ICONO_FONDO: Record<BadgeVariant, string> = {
  activo: 'bg-success/10',
  dev: 'bg-warning/10',
  soon: 'bg-[#F0F0F2]',
};

export interface ModuleCardProps {
  nombre: string;
  descripcion: string;
  icono: string;
  estado: BadgeVariant;
  href: string | null;
  /** Sin sesión: la card se ve "apagada" y no ofrece ninguna acción. */
  bloqueada: boolean;
  /** Con sesión: si el rol tiene alcance sobre el módulo (además de estar Activo). */
  habilitado?: boolean;
  /** Mini-preview de datos reales (solo para el módulo activo y desbloqueado). */
  preview?: ReactNode;
}

export function ModuleCard({
  nombre,
  descripcion,
  icono,
  estado,
  href,
  bloqueada,
  habilitado = false,
  preview,
}: ModuleCardProps) {
  const puedeEntrar = !bloqueada && habilitado && estado === 'activo' && href !== null;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-brand border border-line bg-white p-6 shadow-sm transition-all ${
        puedeEntrar ? 'hover:-translate-y-1 hover:shadow-lg' : ''
      } ${bloqueada ? 'opacity-70 grayscale-[35%]' : ''}`}
    >
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${bloqueada ? 'bg-line' : ACCENTO[estado]}`} />

      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${ICONO_FONDO[estado]}`}>
          {icono}
        </div>
        {!bloqueada && <Badge variant={estado} />}
      </div>

      <h3 className="mt-4 text-lg font-bold text-ink">{nombre}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{descripcion}</p>

      {preview && !bloqueada && <div className="mt-3">{preview}</div>}

      <div className="mt-5">
        {bloqueada ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            🔒 Iniciá sesión para ver más
          </p>
        ) : puedeEntrar ? (
          <Button asChild variant="primary">
            <Link href={href}>Entrar</Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            No disponible
          </Button>
        )}
      </div>
    </div>
  );
}
