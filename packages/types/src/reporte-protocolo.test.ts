import { describe, expect, it } from 'vitest';
import { asuntoDelReporte, esDireccionInexistente, textoDeCierre } from './reporte-protocolo';

// La frase que va en el asunto del mail y como titular de la pantalla. Tiene
// que entenderse desde la notificación del celular, sin abrir nada.
describe('asuntoDelReporte', () => {
  const con = (activas: number, conRojas: number, direcciones: string[] = []) =>
    asuntoDelReporte({
      resumen: { activas, conRojas },
      urgencias: direcciones.map((direccion) => ({ direccion })),
    });

  it('sin propiedades lo dice y no inventa números', () => {
    expect(con(0, 0)).toBe('Sin propiedades en comercialización');
  });

  it('todo al día: la buena noticia también es una frase', () => {
    expect(con(4, 0)).toBe('4 propiedades en comercialización, todas al día');
    expect(con(1, 0)).toBe('1 propiedad en comercialización, al día');
  });

  it('nombra lo que necesita atención', () => {
    expect(con(4, 2, ['Belgrano 2087', 'Alsina 3841'])).toBe(
      '2 de 4 necesitan atención: Belgrano 2087 y Alsina 3841',
    );
  });

  it('con una sola, el verbo va en singular', () => {
    expect(con(3, 1, ['Belgrano 2087'])).toBe('1 de 3 necesita atención: Belgrano 2087');
  });

  // Un asunto de mail se corta: ocho direcciones no se leen en una
  // notificación.
  it('nombra hasta dos y cuenta el resto', () => {
    expect(con(9, 5, ['A 1', 'B 2', 'C 3', 'D 4', 'E 5'])).toBe(
      '5 de 9 necesitan atención: A 1, B 2 y 3 más',
    );
  });
});

describe('textoDeCierre', () => {
  it('no dice nada si el protocolo no llegó al final', () => {
    expect(textoDeCierre({ listoParaCierre: false, pendientesArrastrados: 0 })).toBeNull();
  });

  it('avisa cuántas tareas arrastra', () => {
    expect(textoDeCierre({ listoParaCierre: true, pendientesArrastrados: 0 })).toBe(
      'Listo para cierre',
    );
    expect(textoDeCierre({ listoParaCierre: true, pendientesArrastrados: 1 })).toBe(
      'Listo para cierre · 1 tarea pendiente de semanas anteriores',
    );
  });
});

describe('esDireccionInexistente', () => {
  it('detecta los TLD reservados', () => {
    expect(esDireccionInexistente('ceo@prueba.test')).toBe(true);
    expect(esDireccionInexistente('x@algo.invalid')).toBe(true);
    expect(esDireccionInexistente('x@foo.example')).toBe(true);
    expect(esDireccionInexistente('x@localhost')).toBe(true);
  });

  it('no toca las direcciones reales', () => {
    expect(esDireccionInexistente('javierblasculasso@gmail.com')).toBe(false);
    expect(esDireccionInexistente('ezequiel@vacker.com.ar')).toBe(false);
    // "test" adentro del dominio no es lo mismo que el TLD .test
    expect(esDireccionInexistente('x@testing.com')).toBe(false);
  });
});
