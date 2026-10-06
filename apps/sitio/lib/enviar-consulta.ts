/**
 * El envío del formulario de contacto, aparte del componente para poder
 * probarlo sin navegador.
 *
 * Sin conexión, `fetch` rechaza con un `TypeError` cuyo mensaje es el del
 * navegador, en inglés («Failed to fetch», «Load failed» en Safari), y eso se
 * mostraba tal cual debajo del formulario. Y sin un tope de tiempo, con una
 * red que no contesta el botón se quedaba en «Enviando…» para siempre.
 */
export const MENSAJE_SIN_CONEXION =
  'No pudimos enviar la consulta: parece que no hay conexión. Revise internet y vuelva a intentar.';
export const MENSAJE_DEMORA =
  'El envío está tardando demasiado. Revise su conexión y vuelva a intentar.';
export const MENSAJE_GENERICO = 'No pudimos enviar la consulta. Vuelva a intentar en unos minutos.';

/** Cuánto se espera la respuesta antes de avisar. El endpoint manda un correo: unos segundos alcanzan. */
export const TIEMPO_MAXIMO_MS = 15_000;

export type ResultadoEnvio = { ok: true } | { ok: false; mensaje: string };

export async function enviarConsulta(
  datos: Record<string, unknown>,
  {
    fetchImpl = fetch,
    tiempoMaximoMs = TIEMPO_MAXIMO_MS,
  }: { fetchImpl?: typeof fetch; tiempoMaximoMs?: number } = {},
): Promise<ResultadoEnvio> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempoMaximoMs);
  try {
    const r = await fetchImpl('/api/contacto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      signal: control.signal,
    });
    if (r.ok) return { ok: true };
    // El endpoint responde sus errores en castellano (`{ mensaje }`); si no
    // vino nada legible, el genérico.
    const cuerpo = (await r.json().catch(() => null)) as { mensaje?: unknown } | null;
    return {
      ok: false,
      mensaje: typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : MENSAJE_GENERICO,
    };
  } catch (err) {
    if (control.signal.aborted) return { ok: false, mensaje: MENSAJE_DEMORA };
    if (err instanceof TypeError) return { ok: false, mensaje: MENSAJE_SIN_CONEXION };
    return { ok: false, mensaje: MENSAJE_GENERICO };
  } finally {
    clearTimeout(reloj);
  }
}
