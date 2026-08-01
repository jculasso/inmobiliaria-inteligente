import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Recibe las consultas del sitio y las manda por correo a la dirección.
 *
 * Va acá y no contra la API del producto a propósito: la API está detrás de
 * autenticación y abrirle un endpoint público a un formulario sería sumarle
 * superficie de ataque al sistema donde vive un cliente real. El sitio
 * comercial se despliega aparte y se rompe aparte.
 */

const ConsultaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  inmobiliaria: z.string().trim().min(2).max(160),
  vendedores: z.string().trim().max(6).optional().or(z.literal('')),
  email: z.string().trim().email().max(160),
  telefono: z.string().trim().min(6).max(40),
});

/*
 * Lo que ve el visitante cuando el envío falla. NO nombra ninguna casilla:
 * `contacto@` todavía no existe, y mandar a alguien a escribir a una dirección
 * que rebota es peor que no darle ninguna — cree que preguntó, nunca le
 * contestan, y se va pensando que no le dimos bola. Pedirle que reintente es
 * honesto: el error es nuestro y suele ser pasajero.
 *
 * Cuando la casilla exista, va acá.
 */
const MENSAJE_DE_ERROR = 'No pudimos enviar la consulta. Probá de nuevo en un momento.';

const DESTINO = ['javier.culasso@icloud.com', 'bernardo_falconi@hotmail.com'];
const REMITENTE = 'Sitio Inmobiliaria Inteligente <sitio@avisos.inmobiliariainteligente.net>';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function POST(req: Request) {
  const cuerpo: unknown = await req.json().catch(() => null);

  // La trampa se revisa ANTES de validar, y a propósito: el campo `sitio` está
  // oculto y una persona nunca lo completa, así que si viene con algo lo llenó
  // un robot. Si esto fuera después de la validación, el robot se llevaría un
  // 400 —o sea, la confirmación de que lo detectamos— y probaría de otra forma.
  // Con el 200 se va convencido de que la consulta entró.
  const trampa = (cuerpo as { sitio?: unknown } | null)?.sitio;
  if (typeof trampa === 'string' ? trampa.length > 0 : trampa != null) {
    return NextResponse.json({ ok: true });
  }

  const parsed = ConsultaSchema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ mensaje: 'Revisá los datos del formulario.' }, { status: 400 });
  }
  const c = parsed.data;

  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.error('Falta RESEND_API_KEY: la consulta NO se envió.', { de: c.email });
    return NextResponse.json(
      { mensaje: MENSAJE_DE_ERROR },
      { status: 500 },
    );
  }

  const filas: [string, string][] = [
    ['Nombre', c.nombre],
    ['Inmobiliaria', c.inmobiliaria],
    ['Vendedores', c.vendedores || 'No informado'],
    ['Correo', c.email],
    ['Teléfono', c.telefono],
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMITENTE,
      to: DESTINO,
      // Responder al correo contesta directamente al prospecto, sin copiar y
      // pegar la dirección.
      reply_to: c.email,
      subject: `Consulta del sitio — ${c.inmobiliaria}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1D1D1F">
        <p style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#6B6B6B;text-transform:uppercase">Consulta del sitio</p>
        <table cellpadding="6" style="border-collapse:collapse">
          ${filas
            .map(
              ([k, v]) =>
                `<tr><td style="color:#6B6B6B">${esc(k)}</td><td style="font-weight:700">${esc(v)}</td></tr>`,
            )
            .join('')}
        </table>
      </div>`,
      text: filas.map(([k, v]) => `${k}: ${v}`).join('\n'),
    }),
  });

  if (!res.ok) {
    // El detalle va al log, no al visitante: puede traer información del
    // proveedor que no le corresponde ver.
    console.error('Resend rechazó la consulta:', res.status, await res.text().catch(() => ''));
    return NextResponse.json(
      { mensaje: MENSAJE_DE_ERROR },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
