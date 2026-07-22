/**
 * Genera un PDF y lo abre en una pestaña nueva con feedback inmediato. La
 * pestaña se abre YA (dentro del gesto del click) para que el navegador no la
 * bloquee como popup; muestra "<titulo>…" y, cuando el PDF está listo, esa
 * misma pestaña navega al archivo. Compartido por dashboard, historial y reporte.
 *
 * `titulo` es un texto fijo del código (no input del usuario) → seguro de
 * interpolar en el HTML de la pestaña placeholder.
 */
export async function abrirPdfEnPestana(
  generar: () => Promise<{ url: string }>,
  opts: { titulo: string; onError: (mensaje: string) => void },
): Promise<void> {
  const win = window.open('', '_blank');
  if (win) {
    win.opener = null;
    win.document.write(
      `<!doctype html><meta charset="utf-8"><title>${opts.titulo}…</title>` +
        '<div style="font-family:system-ui,sans-serif;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;color:#1D1D1F">' +
        `<div><div style="font-size:15px;font-weight:700">${opts.titulo}…</div>` +
        '<div style="font-size:13px;color:#6B6B6B;margin-top:6px">Puede tardar unos segundos.</div></div></div>',
    );
  }
  try {
    const { url } = await generar();
    if (win) win.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    win?.close();
    opts.onError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
  }
}
