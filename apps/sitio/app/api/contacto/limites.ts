/**
 * Topes del formulario de contacto (auditoría del 6/10/2026). Sin ellos, un
 * script podía mandar miles de consultas por minuto: cada una es un mail que
 * paga la cuenta de Resend y que llena la casilla de la dirección hasta tapar
 * las consultas de verdad.
 *
 * Tres topes, del más fino al más grueso:
 *
 * - **Por IP, en una ventana corta**: una persona manda una consulta, quizás
 *   dos si se equivocó en el teléfono. Cinco en diez minutos ya no es alguien
 *   llenando un formulario.
 * - **Por IP, por día**: frena al que se acomoda justo debajo del tope corto.
 * - **Global, por minuto**: el techo si el ataque viene de muchas IPs a la vez.
 *   Corta también a la gente de verdad durante ese minuto, y es a propósito:
 *   preferimos perder un minuto de consultas que la cuenta de correo.
 *
 * **Viven en memoria de cada instancia.** En Vercel cada función puede correr
 * en varias instancias a la vez y se reciclan seguido, así que esto NO es un
 * límite exacto: es un freno barato contra el abuso más burdo, sin sumar una
 * base o un Redis para un formulario. Si el abuso real lo supera, el paso
 * siguiente es el firewall de Vercel o un almacenamiento compartido.
 */

const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * MINUTO_MS;

export const TOPES = {
  porIpVentana: { cantidad: 5, ventanaMs: 10 * MINUTO_MS },
  porIpDia: { cantidad: 20, ventanaMs: DIA_MS },
  globalMinuto: { cantidad: 30, ventanaMs: MINUTO_MS },
} as const;

/** Marcas de tiempo de los pedidos de cada clave, dentro de su ventana. */
const registros = new Map<string, number[]>();

function dentroDelTope(
  clave: string,
  tope: { cantidad: number; ventanaMs: number },
  ahora: number,
) {
  const vigentes = (registros.get(clave) ?? []).filter((t) => ahora - t < tope.ventanaMs);
  registros.set(clave, vigentes);
  return vigentes.length < tope.cantidad;
}

function anotar(clave: string, ahora: number) {
  registros.get(clave)!.push(ahora);
}

/**
 * ¿Se puede aceptar un pedido más de esta IP? Si sí, lo anota. Si alguno de
 * los tres topes está lleno, no anota nada (un pedido rechazado no consume).
 */
export function aceptarPedido(ip: string, ahora = Date.now()): boolean {
  const claves: [string, { cantidad: number; ventanaMs: number }][] = [
    [`ip:${ip}`, TOPES.porIpVentana],
    [`dia:${ip}`, TOPES.porIpDia],
    ['global', TOPES.globalMinuto],
  ];
  if (!claves.every(([c, t]) => dentroDelTope(c, t, ahora))) return false;
  for (const [c] of claves) anotar(c, ahora);
  // Barrido ocasional para que las IPs que no vuelven no queden para siempre.
  if (registros.size > 5_000) {
    for (const [c, ts] of registros) if (ts.every((t) => ahora - t >= DIA_MS)) registros.delete(c);
  }
  return true;
}

/** Solo para tests: arranca con los contadores vacíos. */
export function reiniciarTopes(): void {
  registros.clear();
}

/**
 * La IP del visitante. En Vercel, `x-real-ip` la pone la plataforma, y el
 * primer valor de `x-forwarded-for` también: Vercel reescribe esa cabecera, así
 * que el visitante no puede inventarse otra.
 */
export function ipDe(req: Request): string {
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const reenviada = req.headers.get('x-forwarded-for');
  return reenviada?.split(',')[0]?.trim() || 'desconocida';
}
