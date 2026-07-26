import type { PdfGenerado } from './api-client';

/** Escapa para interpolar sin riesgo en el HTML de la pestaña. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Genera un PDF y lo abre en una pestaña nueva con feedback inmediato.
 *
 * La pestaña se abre YA, dentro del gesto del click, para que el navegador no
 * la bloquee como popup — abrirla después del `await` es justamente lo que
 * hacía que no apareciera nada.
 *
 * Dentro se arma una página con el nombre del informe, un botón de descarga y
 * el PDF embebido. El botón hace falta porque las URLs `blob:` son opacas: sin
 * un enlace con `download`, el archivo se guarda con un identificador al azar
 * en vez del nombre del informe.
 */
export async function abrirPdfEnPestana(
  generar: () => Promise<PdfGenerado>,
  opts: { titulo: string; onError: (mensaje: string) => void; ventana?: Window | null },
): Promise<void> {
  // `ventana` la pasa quien ya tuvo que esperar algo antes de poder generar
  // (p. ej. el wizard, que primero guarda la tasación): en ese caso la abre él
  // apenas se hace click, porque para cuando llega acá el navegador ya no
  // considera que la acción viene de un gesto del usuario.
  const win = opts.ventana !== undefined ? opts.ventana : abrirPestanaEnEspera(opts.titulo);

  try {
    const { blob, nombre } = await generar();
    const url = URL.createObjectURL(blob);
    const archivo = `${nombre}.pdf`;

    if (!win) {
      // La pestaña quedó bloqueada igual: al menos se baja el archivo con su nombre.
      descargar(url, archivo);
      return;
    }

    win.document.open();
    win.document.write(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(nombre)}</title>
<style>
  html,body{margin:0;height:100%;font-family:system-ui,-apple-system,sans-serif;background:#F4F5F7}
  header{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;border-bottom:1px solid #E6E6E6}
  h1{flex:1;min-width:0;margin:0;font-size:13px;font-weight:700;color:#1D1D1F;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .btn{flex:none;background:#C1121F;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 14px;border-radius:10px;border:0;cursor:pointer;font-family:inherit}
  .btn.sec{background:#fff;color:#1D1D1F;border:1px solid #E6E6E6}
  iframe{display:block;width:100%;height:calc(100% - 49px);border:0}
</style>
<header>
  <h1>${esc(archivo)}</h1>
  <button type="button" id="compartir" class="btn" hidden>Enviar</button>
  <a id="descargar" class="btn sec" href="${url}" download="${esc(archivo)}">Descargar</a>
</header>
<iframe src="${url}" title="${esc(nombre)}"></iframe>`);
    win.document.close();

    // "Enviar" abre el menú de compartir del sistema con el ARCHIVO. Es lo que
    // se quiere para mandárselo al cliente: compartir desde el navegador
    // adjunta además la dirección interna del PDF (un `blob:...` larguísimo
    // que del otro lado no sirve para nada).
    prepararEnviar(win, blob, archivo, nombre);
  } catch (err) {
    win?.close();
    opts.onError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
  }
}

/**
 * Conecta el botón "Enviar" de la pestaña con el menú de compartir del sistema.
 *
 * Todo se hace con el `navigator` y el `File` de LA PESTAÑA, no los de la
 * página que la abrió. El navegador exige que compartir salga de un gesto del
 * usuario en ESE documento: al usar el `navigator` de la página original, el
 * click de la pestaña no contaba como gesto y en el iPhone el botón no hacía
 * absolutamente nada.
 *
 * Si el sistema no puede compartir archivos (o algo falla), se cae a la
 * descarga en vez de dejar un botón muerto.
 */
function prepararEnviar(win: Window, blob: Blob, archivo: string, titulo: string): void {
  const boton = win.document.getElementById('compartir') as HTMLButtonElement | null;
  if (!boton) return;

  // Constructores de la pestaña: un File creado en otro documento puede ser
  // rechazado al compartir.
  const w = win as Window & { File: typeof File };
  let archivoCompartible: File;
  try {
    archivoCompartible = new w.File([blob], archivo, { type: 'application/pdf' });
  } catch {
    return; // Sin File no hay nada que compartir; queda solo "Descargar".
  }

  const nav = win.navigator;
  if (!nav.canShare?.({ files: [archivoCompartible] })) return;

  boton.hidden = false;
  boton.addEventListener('click', () => {
    nav.share({ files: [archivoCompartible], title: titulo }).catch((err: unknown) => {
      // Cancelar el menú no es un error: no hay que hacer nada.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Cualquier otra falla no puede dejar al usuario sin salida: se descarga.
      win.document.getElementById('descargar')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
  });
}

/**
 * Abre la pestaña de espera. Tiene que llamarse de forma SÍNCRONA dentro del
 * handler del click: si se hace después de un `await`, el navegador la bloquea.
 */
export function abrirPestanaEnEspera(titulo: string): Window | null {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(
      `<!doctype html><meta charset="utf-8"><title>${esc(titulo)}…</title>` +
        '<div style="font-family:system-ui,sans-serif;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;color:#1D1D1F">' +
        `<div><div style="font-size:15px;font-weight:700">${esc(titulo)}…</div>` +
        '<div style="font-size:13px;color:#6B6B6B;margin-top:6px">Puede tardar unos segundos.</div></div></div>',
    );
  }
  return win;
}

function descargar(url: string, archivo: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
