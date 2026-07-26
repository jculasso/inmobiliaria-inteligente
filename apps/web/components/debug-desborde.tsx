'use client';

import { useEffect, useState } from 'react';

/**
 * Modo diagnóstico del "baile": se activa agregando `?debug=1` a la URL.
 *
 * Existe porque no hay forma de medir desde afuera lo que pasa en el teléfono
 * de otra persona. Marca qué elemento se está saliendo del ancho de la pantalla
 * y cuántos píxeles, sobre la app real y en el dispositivo real.
 *
 * Queda encendido mientras dure la pestaña (sessionStorage), así se puede
 * recorrer toda la app sin volver a poner el parámetro en cada URL. Se apaga
 * con `?debug=0`.
 *
 * No expone ningún dato: solo etiquetas de HTML y clases de CSS.
 */

const CLAVE = 'debug-desborde';

interface Hallazgo {
  ancho: number;
  desborde: number;
  culpables: { descripcion: string; px: number }[];
  deslizables: { descripcion: string; px: number }[];
}

/** Nombre corto y legible de un elemento, para poder buscarlo en el código. */
function describir(el: Element): string {
  const clases = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
  return `${el.tagName.toLowerCase()}${clases ? ` .${clases}` : ''}`;
}

function medir(): Hallazgo {
  const ancho = window.innerWidth;

  const culpables = [...document.querySelectorAll('body *')]
    .filter((el) => {
      if (el.closest('[data-debug-desborde]')) return false; // el propio cartel
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= ancho + 1) return false;
      // Solo se descarta lo que vive dentro de un panel que se desliza: ahí
      // pasarse del ancho es lo esperable, y ese panel ya se reporta aparte.
      // Lo recortado por `overflow: clip`/`hidden` SÍ se reporta: la página no
      // se arrastra, pero es contenido que el usuario no llega a ver.
      let p = el.parentElement;
      while (p) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === 'auto' || ov === 'scroll') return false;
        p = p.parentElement;
      }
      return true;
    })
    .map((el) => ({ descripcion: describir(el), px: Math.round(el.getBoundingClientRect().right - ancho) }))
    .sort((a, b) => b.px - a.px)
    .slice(0, 3);

  const deslizables = [...document.querySelectorAll('body *')]
    .filter((el) => {
      if (el.closest('[data-debug-desborde]')) return false;
      if (el.scrollWidth - el.clientWidth <= 2) return false;
      const ov = getComputedStyle(el).overflowX;
      return (ov === 'auto' || ov === 'scroll') && el.getBoundingClientRect().width > 0;
    })
    .map((el) => ({ descripcion: describir(el), px: el.scrollWidth - el.clientWidth }))
    .sort((a, b) => b.px - a.px)
    .slice(0, 3);

  return {
    ancho,
    desborde: document.documentElement.scrollWidth - ancho,
    culpables,
    deslizables,
  };
}

export function DebugDesborde() {
  const [activo, setActivo] = useState(false);
  const [datos, setDatos] = useState<Hallazgo | null>(null);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('debug');
    if (param === '1') sessionStorage.setItem(CLAVE, '1');
    if (param === '0') sessionStorage.removeItem(CLAVE);
    setActivo(sessionStorage.getItem(CLAVE) === '1');
  }, []);

  useEffect(() => {
    if (!activo) return;
    // Se remide al rato de cada cambio: el contenido llega asincrónico y lo que
    // desborda suele aparecer recién cuando cargan los datos.
    const remedir = () => setDatos(medir());
    remedir();
    const t = setInterval(remedir, 1200);
    window.addEventListener('resize', remedir);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', remedir);
    };
  }, [activo]);

  if (!activo || !datos) return null;

  const limpio = datos.desborde <= 0 && datos.culpables.length === 0 && datos.deslizables.length === 0;

  return (
    <div
      data-debug-desborde
      className={`fixed inset-x-0 bottom-0 z-[9999] max-h-[45vh] overflow-y-auto px-3 py-2 font-mono text-[10px] leading-tight text-white ${
        limpio ? 'bg-emerald-700/95' : 'bg-black/90'
      }`}
    >
      <div className="font-bold">
        {limpio ? '✓ LIMPIO' : '⚠ DESBORDE'} · ancho {datos.ancho}px · página +{datos.desborde}px
      </div>

      {datos.culpables.length > 0 && (
        <div className="mt-1">
          <div className="text-amber-300">SE SALEN DE LA PANTALLA:</div>
          {datos.culpables.map((c, i) => (
            <div key={i}>
              +{c.px}px — {c.descripcion}
            </div>
          ))}
        </div>
      )}

      {datos.deslizables.length > 0 && (
        <div className="mt-1">
          <div className="text-sky-300">PANELES QUE SE DESLIZAN:</div>
          {datos.deslizables.map((d, i) => (
            <div key={i}>
              {d.px}px — {d.descripcion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
