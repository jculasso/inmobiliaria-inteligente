'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Registra el service worker y avisa cuando hay una versión nueva esperando.
 *
 * El aviso es explícito y no automático: recargar sola la página mientras
 * alguien está cargando una tasación le haría perder lo escrito. Se le ofrece
 * el cambio y decide cuándo.
 */
export function ServiceWorker() {
  const [esperando, setEsperando] = useState<ServiceWorker | null>(null);
  const pidioActualizar = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // En desarrollo no se registra: la caché confunde el hot reload.
    if (process.env.NODE_ENV !== 'production') return;

    let cancelado = false;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registro) => {
        if (cancelado) return;

        // Ya había una versión nueva instalada de antes.
        if (registro.waiting) setEsperando(registro.waiting);

        registro.addEventListener('updatefound', () => {
          const nuevo = registro.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            // `controller` existente = no es la primera instalación, así que
            // esto es realmente una actualización y vale avisar.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              setEsperando(nuevo);
            }
          });
        });
      })
      .catch(() => {
        // Que falle el registro no puede romper la app: se sigue usando online.
      });

    // Se recarga solo si la persona pidió actualizar: el primer service worker
    // también dispara `controllerchange` (al tomar una página que no tenía),
    // y recargar ahí le borraba lo que estuviera escribiendo.
    let recargando = false;
    const onControllerChange = () => {
      if (recargando || !pidioActualizar.current) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelado = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!esperando) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-brand bg-ink px-4 py-3 text-white shadow-lg sm:inset-x-auto sm:right-4"
    >
      <span className="min-w-0 flex-1 text-sm font-medium">Hay una versión nueva disponible.</span>
      <button
        type="button"
        onClick={() => {
          pidioActualizar.current = true;
          esperando.postMessage('ACTUALIZAR');
        }}
        className="shrink-0 rounded-brand bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-surface"
      >
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setEsperando(null)}
        aria-label="Ahora no"
        className="shrink-0 px-1 text-lg leading-none text-white/60 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
