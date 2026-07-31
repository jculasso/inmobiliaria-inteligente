const API = 'https://api.resend.com/emails';

/** 20 s: si Resend no contestó, contestar tarde no ayuda a nadie. */
const TIMEOUT_MS = 20_000;

export class MailError extends Error {}

export interface Adjunto {
  nombre: string;
  contenido: Buffer;
}

export interface Mail {
  de: string;
  para: string[];
  responderA?: string;
  asunto: string;
  html: string;
  /** Alternativa en texto: sin esto varios filtros suben el puntaje de spam. */
  texto: string;
  adjuntos?: Adjunto[];
}

/**
 * Manda un mail por Resend.
 *
 * Va con `fetch` y no con el SDK: es un POST con un JSON, y el SDK traería una
 * dependencia entera para eso. Mismo criterio que el cliente de Tokko.
 *
 * La API key NUNCA aparece en un mensaje de error ni en un log: los errores de
 * Resend se devuelven tal como vienen, y si alguna vez incluyeran el header lo
 * estaríamos filtrando al usuario.
 */
export async function enviarMail(mail: Mail, apiKey: string): Promise<{ id: string }> {
  if (!apiKey) {
    // Mensaje accionable: sin esto el error es un 401 sin pista y el
    // implementador no tiene forma de saber que falta una variable.
    throw new MailError(
      'Falta configurar RESEND_API_KEY en el servidor. Sin esa clave no se puede mandar el reporte.',
    );
  }
  if (mail.para.length === 0) {
    throw new MailError('No hay destinatarios marcados para recibir el reporte.');
  }

  const control = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API, {
      method: 'POST',
      signal: control,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mail.de,
        to: mail.para,
        reply_to: mail.responderA,
        subject: mail.asunto,
        html: mail.html,
        text: mail.texto,
        attachments: mail.adjuntos?.map((a) => ({
          filename: a.nombre,
          content: a.contenido.toString('base64'),
        })),
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new MailError('Resend no respondió en 20 segundos.');
    }
    throw new MailError('No se pudo conectar con Resend.');
  }

  const cuerpo = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) {
    throw new MailError(cuerpo?.message ?? `Resend rechazó el envío (${res.status}).`);
  }
  if (!cuerpo?.id) throw new MailError('Resend aceptó el envío pero no devolvió un identificador.');
  return { id: cuerpo.id };
}
