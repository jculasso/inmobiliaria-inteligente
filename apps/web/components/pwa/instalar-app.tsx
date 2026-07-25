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
  const ua = window.navigator.userAgent;
  // El iPad se presenta como "Macintosh" desde iPadOS 13; lo delata el táctil.
  return /iphone|ipod|ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Solo teléfonos y tablets. En una notebook la app ya se usa en el navegador y
 * ofrecerle instalarla no aporta nada: el objetivo de la app instalable es
 * tenerla a mano en el celular.
 */
function esMovil(): boolean {
  return esIOS() || /android|mobile/i.test(window.navigator.userAgent);
}

/**
 * Invitación a instalar la app en el celular.
 *
 * Solo en teléfonos y tablets: en una computadora la app ya se usa en el
 * navegador y el cartel sería ruido.
 *
 * En Android el navegador ofrece un instalador nativo, así que alcanza con un
 * botón. En iPhone **no existe** esa posibilidad: Apple obliga a hacerlo a mano
 * desde Compartir → "Agregar a inicio", y nadie lo descubre solo — por eso ahí
 * se muestran los pasos en vez de un botón que no podría funcionar.
 */
export function InstalarApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    if (estaInstalada()) return;
    if (!esMovil()) return;
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

  // Banner FIJO, no inline: se decide recién en el efecto (después del primer
  // pintado), así que insertado en el flujo empujaba las tarjetas hacia abajo
  // apenas cargaba la página.
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md overflow-hidden rounded-brand border border-line bg-white p-4 shadow-lg sm:inset-x-auto sm:left-4">
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
          <p className="text-sm font-bold text-ink">Acceso directo en tu teléfono</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Agregá Inmobiliaria Inteligente a la pantalla de inicio para abrirla con un toque, a
            pantalla completa. No ocupa espacio ni descarga nada: es la misma plataforma, y las
            actualizaciones llegan solas.
          </p>

          {mostrarIOS ? (
            <p className="mt-2 rounded-brand bg-surface px-2.5 py-2 text-xs leading-relaxed text-ink">
              Para agregarla: tocá <strong>Compartir</strong> en la barra de Safari y elegí{' '}
              <strong>Agregar a inicio</strong>.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void instalar()}
              className="mt-2.5 rounded-brand bg-brand-red px-3.5 py-1.5 text-sm font-bold text-white hover:bg-brand-red-dark"
            >
              Agregar a la pantalla de inicio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
