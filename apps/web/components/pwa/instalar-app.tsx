'use client';

import { useEffect, useState } from 'react';

/** Evento propio de Chrome/Edge; no está en los tipos del DOM. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLAVE_DESCARTADO = 'instalacion-descartada';

/**
 * Ya está instalada: corre en su propia ventana, sin barra del navegador.
 *
 * `matchMedia` se chequea antes de usarlo: no existe en algunos webviews (ni
 * en el entorno de tests), y sin esta guarda una función que solo decide si
 * mostrar un cartel tiraba abajo toda la Home.
 */
function estaInstalada(): boolean {
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // iOS no soporta display-mode y usa esta propiedad propia.
  return standalone || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function esIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Invitación a instalar la app.
 *
 * En Android y escritorio el navegador da un instalador nativo, así que
 * alcanza con un botón. En iPhone **no existe**: Apple obliga a hacerlo a mano
 * desde Compartir → "Agregar a inicio", y nadie lo descubre solo — por eso ahí
 * se muestran los pasos en vez de un botón que no podría funcionar.
 */
export function InstalarApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    if (estaInstalada()) return;
    if (localStorage.getItem(CLAVE_DESCARTADO) === '1') return;

    if (esIOS()) {
      setMostrarIOS(true);
      return;
    }

    const onPrompt = (e: Event) => {
      // Se frena el cartel automático del navegador para ofrecerlo dentro de
      // la app, con nuestro diseño y en un momento que no interrumpa.
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function descartar() {
    localStorage.setItem(CLAVE_DESCARTADO, '1');
    setPrompt(null);
    setMostrarIOS(false);
  }

  async function instalar() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  if (!prompt && !mostrarIOS) return null;

  return (
    <div className="relative overflow-hidden rounded-brand border border-line bg-white p-4 shadow-sm">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-red" />
      <button
        type="button"
        onClick={descartar}
        aria-label="No mostrar más"
        className="absolute right-2 top-2 px-1.5 text-lg leading-none text-muted hover:text-ink"
      >
        ×
      </button>

      <div className="flex items-start gap-3">
        {/* <img> y no next/image: es un PNG propio y fijo, el optimizador no aporta. */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Instalá la app en tu celular</p>

          {mostrarIOS ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Tocá <strong className="text-ink">Compartir</strong> abajo en Safari y elegí{' '}
              <strong className="text-ink">Agregar a inicio</strong>. Queda con su ícono, como
              cualquier otra app.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Se abre a pantalla completa y entrás de un toque, sin escribir la dirección.
              </p>
              <button
                type="button"
                onClick={() => void instalar()}
                className="mt-2.5 rounded-brand bg-brand-red px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-red-dark"
              >
                Instalar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
