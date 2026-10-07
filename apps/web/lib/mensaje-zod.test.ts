import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MENSAJE_REVISAR, esMensajeDeZod, mensajeLegible, primerMensaje } from './mensaje-zod';

describe('mensajes de validación', () => {
  it('reconoce los mensajes por defecto de Zod, en inglés', () => {
    const errores = [
      z.array(z.string()).min(1).safeParse([]),
      z.string().min(3).safeParse('a'),
      z.number().positive().safeParse(-1),
      z.string().uuid().safeParse('x'),
      z.enum(['a', 'b']).safeParse('c'),
      z.object({ a: z.string() }).safeParse({}),
      z.string().safeParse(3),
    ];
    for (const r of errores) {
      expect(r.success).toBe(false);
      if (!r.success) expect(esMensajeDeZod(r.error.issues[0]!.message)).toBe(true);
    }
  });

  it('deja pasar los nuestros, en castellano', () => {
    expect(esMensajeDeZod('El contrato no tiene tramos.')).toBe(false);
    expect(esMensajeDeZod('El CUIT/CUIL no es válido.')).toBe(false);
    expect(mensajeLegible('Escribí el motivo.')).toBe('Escribí el motivo.');
  });

  it('el de Zod se cambia por uno en castellano', () => {
    expect(mensajeLegible('Array must contain at least 1 element(s)')).toBe(MENSAJE_REVISAR);
    const r = z.array(z.string()).min(1).safeParse([]);
    if (!r.success) expect(primerMensaje(r.error, 'Faltan los tramos.')).toBe('Faltan los tramos.');
  });
});
