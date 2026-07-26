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
  <a class="btn sec" href="${url}" download="${esc(archivo)}">Descargar</a>
</header>
<iframe src="${url}" title="${esc(nombre)}"></iframe>`);
    win.document.close();

    // "Enviar" usa el compartir nativo del sistema con el ARCHIVO. Es lo que
    // se quiere para mandárselo al cliente: sin esto, compartir desde el
    // navegador adjunta además la dirección interna del PDF (un `blob:...`
    // larguísimo que no le sirve a nadie del otro lado).
    const boton = win.document.getElementById('compartir') as HTMLButtonElement | null;
    const archivoParaCompartir = new File([blob], archivo, { type: 'application/pdf' });
    if (boton && navigator.canShare?.({ files: [archivoParaCompartir] })) {
      boton.hidden = false;
      boton.addEventListener('click', () => {
        void navigator.share({ files: [archivoParaCompartir], title: nombre }).catch(() => {
          // Si se cancela el menú de compartir no hay nada que hacer.
        });
      });
    }
  } catch (err) {
    win?.close();
    opts.onError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
  }
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
