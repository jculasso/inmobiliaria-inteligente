'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * `router.refresh()` que se puede esperar.
 *
 * Guardar en Alquileres tarda (la API en Render), y después el refresh tarda
 * unos segundos más en traer la página nueva. Si el modal se cierra apenas
 * responde la API, durante esos segundos se ve la pantalla VIEJA: el contrato
 * recién activado sigue en «Borrador» con «Activar contrato» (invita a
 * activarlo dos veces), la garantía nueva no aparece, la lista de plantillas
 * dice que no hay ninguna (prueba en producción, 6/10/2026).
 *
 * `refrescar()` devuelve una promesa que se cumple cuando la página nueva ya
 * se pintó: se espera, y recién ahí se cierra el modal. Mientras tanto
 * `refrescando` es `true`, para el «Actualizando…» del botón.
 *
 * Se apoya en `useTransition`: con el refresh adentro de la transición,
 * `isPending` sigue en `true` hasta que llega y se pinta lo del servidor.
 */
export function useRefrescar() {
  const router = useRouter();
  const [refrescando, startTransition] = useTransition();
  // Cambia en la misma transición que el refresh: garantiza que el efecto
  // corra al terminar aunque React no llegue a pintar el `isPending` en true.
  const [vueltas, setVueltas] = useState(0);
  const esperando = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (refrescando || esperando.current.length === 0) return;
    const listos = esperando.current;
    esperando.current = [];
    for (const listo of listos) listo();
  }, [refrescando, vueltas]);

  const refrescar = useCallback(
    () =>
      new Promise<void>((resolve) => {
        esperando.current.push(resolve);
        startTransition(() => {
          setVueltas((n) => n + 1);
          router.refresh();
        });
      }),
    [router],
  );

  return { refrescar, refrescando };
}
