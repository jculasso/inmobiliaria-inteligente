'use client';

import { useEffect, useState } from 'react';

/**
 * Aviso que aparece solo si la carga se extiende más de lo normal — el
 * backend (Render free tier) se duerme por inactividad y la primera
 * request tras un rato sin uso puede tardar bastante en "despertarlo".
 * Sin timeout, cualquier loading.tsx de más de unos segundos se siente
 * como un cuelgue en vez de una demora esperable.
 */
export function ColdStartHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;
  return (
    <p className="mt-4 text-center text-xs text-muted">
      Puede tardar unos segundos si el servidor estaba inactivo — ya está cargando.
    </p>
  );
}
