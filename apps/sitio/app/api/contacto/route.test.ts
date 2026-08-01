import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

/**
 * El formulario del sitio es la única puerta de entrada de un prospecto. Si se
 * rompe, no hay error visible en ningún lado: las consultas simplemente dejan
 * de llegar y nadie se entera hasta que alguien pregunta por qué no llamamos.
 * De ahí que esté cubierto.
 *
 * El primer caso es el que ya falló una vez: la trampa de robots estaba DESPUÉS
 * de la validación, y como un `sitio` con contenido no pasaba el esquema, el
 * robot se llevaba un 400 y el chequeo de la trampa nunca se ejecutaba.
 */

const CONSULTA = {
  nombre: 'Marcela Ithurbide',
  inmobiliaria: 'Ithurbide Propiedades',
  vendedores: '9',
  email: 'marcela@ejemplo.com.ar',
  telefono: '11 5555 4444',
  sitio: '',
};

function pedido(cuerpo: unknown): Request {
  return new Request('http://localhost/api/contacto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

describe('POST /api/contacto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.RESEND_API_KEY = 'clave-de-prueba';
  });

  it('a un robot le contesta que salió bien, y no manda ningún mail', async () => {
    const enviar = vi.spyOn(globalThis, 'fetch');
    const res = await POST(pedido({ ...CONSULTA, sitio: 'http://spam.example' }));

    expect(res.status).toBe(200);
    // Lo importante no es el 200: es que no se haya enviado nada. Un 400 le
    // avisaría al que escribió el robot que lo detectamos.
    expect(enviar).not.toHaveBeenCalled();
  });

  it('manda la consulta cuando los datos están completos', async () => {
    const enviar = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await POST(pedido(CONSULTA));
    expect(res.status).toBe(200);

    const [url, opciones] = enviar.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    const mail = JSON.parse((opciones as RequestInit).body as string);
    expect(mail.subject).toContain('Ithurbide Propiedades');
    // Responder el mail tiene que contestarle al prospecto, no a nosotros.
    expect(mail.reply_to).toBe(CONSULTA.email);
    expect(mail.to).toEqual(['javier.culasso@icloud.com', 'bernardo_falconi@hotmail.com']);
    expect(mail.text).toContain('11 5555 4444');
  });

  it('rechaza datos incompletos sin llamar al proveedor', async () => {
    const enviar = vi.spyOn(globalThis, 'fetch');
    const res = await POST(pedido({ ...CONSULTA, email: 'esto-no-es-un-mail' }));

    expect(res.status).toBe(400);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('aguanta un cuerpo que no es JSON', async () => {
    const res = await POST(pedido('{ roto'));
    expect(res.status).toBe(400);
  });

  it('avisa que no pudo enviar si falta la clave, en vez de perder la consulta en silencio', async () => {
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(pedido(CONSULTA));
    expect(res.status).toBe(500);
    const { mensaje } = await res.json();
    expect(mensaje).toMatch(/de nuevo/i);
    // Y que no mande a escribir a ninguna casilla: mientras `contacto@` no
    // exista, nombrarla haría creer al visitante que tiene por dónde insistir.
    expect(mensaje).not.toContain('@');
  });

  it('escapa el HTML de los datos del visitante', async () => {
    const enviar = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await POST(pedido({ ...CONSULTA, nombre: '<script>alert(1)</script>' }));
    const mail = JSON.parse((enviar.mock.calls[0]![1] as RequestInit).body as string);
    expect(mail.html).not.toContain('<script>');
  });
});
