'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Toggle "Ver solo lo mío": un CEO/Team Leader alterna entre ver todo su
 * alcance y ver solo sus propias ventas/tasaciones (seguimiento), vía el
 * query param `soloMio`. No cambia el rol real — solo el filtro de la vista.
 * Renderizar solo para roles con alcance amplio (ver `puedeVerSoloLoMio`).
 */
export function ToggleSoloMio() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activo = searchParams.get('soloMio') === '1';

  function toggle() {
    const params = new URLSearchParams(searchParams);
    if (activo) params.delete('soloMio');
    else params.set('soloMio', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-ink">
      <input type="checkbox" checked={activo} onChange={toggle} className="accent-brand-red" />
      Ver solo lo mío
    </label>
  );
}
