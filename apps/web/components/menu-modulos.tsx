'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULO_KEYS, type ModuloKey, type ModulosTenant } from '@vacker/types';
import { NOMBRE_MODULO } from '../lib/modulos';

const ICONO: Record<ModuloKey, string> = {
  tablero: '📊',
  tasador: '🏷️',
  todo: '🗓️',
  protocolo: '📋',
  publicacion: '🌐',
};

const RUTA: Record<ModuloKey, string> = {
  tablero: '/tablero',
  tasador: '/tasador',
  todo: '/todo',
  protocolo: '/protocolo',
  publicacion: '/publicacion',
};

/**
 * Salto directo entre los módulos habilitados, sin pasar por la Home. Muestra
 * solo los que la inmobiliaria tiene contratados: ofrecer un módulo que después
 * rebota con "no disponible" es peor que no mostrarlo.
 */
export function MenuModulos({ modulos }: { modulos: ModulosTenant }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra al clickear afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  const habilitados = MODULO_KEYS.filter((k) => modulos[k]);
  if (habilitados.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-brand border border-line bg-white px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-surface"
      >
        <span aria-hidden>⊞</span>
        Módulos
        <span aria-hidden className={`text-xs text-muted transition-transform ${abierto ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-1 w-56 overflow-hidden rounded-brand border border-line bg-white shadow-lg"
        >
          {habilitados.map((key) => {
            const activo = pathname === RUTA[key] || pathname.startsWith(`${RUTA[key]}/`);
            return (
              <Link
                key={key}
                href={RUTA[key]}
                role="menuitem"
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                  activo ? 'bg-brand-red/5 font-bold text-brand-red' : 'text-ink hover:bg-surface'
                }`}
              >
                <span aria-hidden>{ICONO[key]}</span>
                {NOMBRE_MODULO[key]}
                {activo && <span className="ml-auto text-xs">•</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
