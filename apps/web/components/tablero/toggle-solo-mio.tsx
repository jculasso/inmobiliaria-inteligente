'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Toggle "Ver solo lo mío": un CEO/Team Leader alterna entre ver todo su
 * alcance y ver solo sus propias ventas/tasaciones, vía el query param
 * `soloMio`. No cambia el rol real. Usa estado optimista + useTransition: el
 * check se marca al instante (el navigate hace un round-trip al server) y un
 * spinner indica que está actualizando.
 */
export function ToggleSoloMio() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const propActivo = searchParams.get('soloMio') === '1';
  const [activo, setActivo] = useState(propActivo);
  useEffect(() => {
    setActivo(propActivo);
  }, [propActivo]);

  function toggle() {
    const next = !activo;
    setActivo(next); // marca al instante
    const params = new URLSearchParams(searchParams);
    if (next) params.set('soloMio', '1');
    else params.delete('soloMio');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-ink transition-opacity ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      <input type="checkbox" checked={activo} onChange={toggle} className="accent-brand-red" />
      Ver solo lo mío
      {isPending && (
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand-red" />
      )}
    </label>
  );
}
