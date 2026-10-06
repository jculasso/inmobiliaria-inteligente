'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Cuánto en segundo plano hace que los datos de la pantalla ya no sirvan. */
const VIEJO_MS = 10 * 60 * 1000;

/**
 * Instalada como app, la pantalla puede quedar abierta días: al volver mostraba
 * números viejos, el «Hoy» de la agenda no cambiaba a medianoche y el
 * protocolo chocaba con su propia versión vieja al guardar. Al volver después
 * de un rato, se vuelven a pedir los datos (sin recargar la página ni perder
 * lo que se esté escribiendo).
 *
 * Y si el navegador devuelve una página guardada en memoria (botón atrás de
 * Android después de cerrar sesión), se recarga: podía mostrar la pantalla de
 * la sesión anterior (revisión PWA del 6/10/2026).
 */
export function AlVolver() {
  const router = useRouter();
  useEffect(() => {
    let oculto = 0;
    const alCambiar = () => {
      if (document.visibilityState === 'hidden') {
        oculto = Date.now();
        // Lo último que se escribió y no se guardó: el blur dispara los guardados al salir del campo.
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else if (oculto && Date.now() - oculto > VIEJO_MS) {
        router.refresh();
      }
    };
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    document.addEventListener('visibilitychange', alCambiar);
    window.addEventListener('pageshow', alMostrar);
    return () => {
      document.removeEventListener('visibilitychange', alCambiar);
      window.removeEventListener('pageshow', alMostrar);
    };
  }, [router]);
  return null;
}
