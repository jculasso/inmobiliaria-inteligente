import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import {
  completarPlantillaWord,
  problemasDePlantilla,
  resolver,
  textoDeDocx,
} from './plantilla-word';
import { docx } from './plantilla-word.testing';

const subir = (buffer: Buffer, originalname = 'Contrato.docx') => ({
  buffer,
  originalname,
  size: buffer.length,
});

const DATOS = {
  inmobiliaria: 'Alteva Propiedades',
  'contrato.codigo': 'ALT-0011',
  'inquilinos.texto': 'Ana Gómez',
  deposito: { importe: '$ 350.000,00', letras: 'pesos trescientos cincuenta mil' },
  'deposito.importe': '$ 350.000,00',
  tramos: [
    { numero: '1', desde: '01/03/2026', hasta: '30/06/2026', importe: '$ 350.000,00' },
    { numero: '2', desde: '01/07/2026', hasta: '31/10/2026', importe: 'según el índice' },
  ],
};

describe('completarPlantillaWord', () => {
  it('completa un dato, aunque Word lo haya partido en dos tramos de texto', () => {
    const out = completarPlantillaWord(
      docx([['Contrato ', '{contrato.', 'codigo}', ' de {inmobiliaria}']]),
      DATOS,
    );
    expect(textoDeDocx(out)).toContain('Contrato ALT-0011 de Alteva Propiedades');
  });

  it('la cláusula del depósito aparece solo si hay depósito', () => {
    const plantilla = docx([
      '{#deposito}Se entregan {importe} ({letras}).{/deposito}{^deposito}Sin depósito.{/deposito}',
    ]);
    expect(textoDeDocx(completarPlantillaWord(plantilla, DATOS))).toContain(
      'Se entregan $ 350.000,00 (pesos trescientos cincuenta mil).',
    );
    // Antes, un contrato sin depósito decía «[sin depósito] ([sin depósito])».
    const sin = textoDeDocx(completarPlantillaWord(plantilla, { ...DATOS, deposito: null }));
    expect(sin).toContain('Sin depósito.');
    expect(sin).not.toContain('Se entregan');
  });

  it('adentro de una condición se puede nombrar el dato con el camino completo', () => {
    const out = completarPlantillaWord(
      docx(['{#deposito}Depósito: {deposito.importe}{/deposito}']),
      DATOS,
    );
    expect(textoDeDocx(out)).toContain('Depósito: $ 350.000,00');
  });

  it('una lista sola en su párrafo repite el párrafo, una vez por tramo', () => {
    const out = textoDeDocx(
      completarPlantillaWord(
        docx(['{#tramos}', 'Tramo {numero}: del {desde} al {hasta}, {importe}.', '{/tramos}']),
        DATOS,
      ),
    );
    expect(out).toContain('Tramo 1: del 01/03/2026 al 30/06/2026, $ 350.000,00.');
    expect(out).toContain('Tramo 2: del 01/07/2026 al 31/10/2026, según el índice.');
    // Los párrafos de la apertura y el cierre no dejan líneas vacías.
    expect(
      out
        .trim()
        .split('\n')
        .filter((l) => l.trim() === ''),
    ).toHaveLength(0);
  });

  it('adentro de una lista se ven también los datos del contrato', () => {
    const out = completarPlantillaWord(
      docx(['{#tramos}{numero}-{contrato.codigo} {/tramos}']),
      DATOS,
    );
    expect(textoDeDocx(out)).toContain('1-ALT-0011 2-ALT-0011');
  });

  it('un dato opcional que falta queda vacío, no «undefined»', () => {
    const out = completarPlantillaWord(docx(['Firmado el [{contrato.firma}]']), DATOS);
    expect(textoDeDocx(out)).toContain('Firmado el []');
  });
});

describe('resolver', () => {
  it('lee la clave con punto, el camino, y no inventa lo que no está', () => {
    expect(resolver({ 'a.b': 1 }, 'a.b')).toBe(1);
    expect(resolver({ a: { b: 2 } }, 'a.b')).toBe(2);
    expect(resolver({ a: null }, 'a.b')).toBeUndefined();
    expect(resolver({}, 'constructor')).toBeUndefined();
    expect(resolver([1], 'length')).toBeUndefined();
  });
});

describe('problemasDePlantilla (al subir)', () => {
  it('una plantilla con marcadores conocidos no tiene problemas', () => {
    expect(
      problemasDePlantilla(
        subir(
          docx([
            'Entre {propietarios.texto} y {inquilinos.texto}, {contrato.codigo}.',
            '{#deposito}{importe} ({deposito.letras}){/deposito}',
            '{#tramos}',
            '{numero}: {desde} al {hasta}, {importe} {contrato.codigo}',
            '{/tramos}',
            '{#garantes}{nombre}{separador}{/garantes}',
            '{#propiedad.ciudad}en {propiedad.ciudad}{/propiedad.ciudad}',
          ]),
        ),
      ),
    ).toEqual([]);
  });

  it('nombra el marcador desconocido y sugiere el que se quiso escribir', () => {
    const problemas = problemasDePlantilla(
      subir(docx(['{contrato.codgo} y {inquilino.nombre} y {cualquiera}'])),
    );
    expect(problemas).toEqual([
      '«{contrato.codgo}» no es un marcador conocido. ¿Quisiste decir {contrato.codigo}?',
      expect.stringMatching(/^«\{inquilino\.nombre\}» no es un marcador conocido\./),
      '«{cualquiera}» no es un marcador conocido.',
    ]);
  });

  it('un campo de una lista usado afuera de la lista', () => {
    expect(problemasDePlantilla(subir(docx(['Del {desde} al {hasta}'])))).toEqual([
      '«{desde}» solo se puede usar adentro de {#tramos}…{/tramos}.',
      '«{hasta}» solo se puede usar adentro de {#tramos}…{/tramos}.',
    ]);
  });

  it('una lista o una condición usada como dato suelto explica cómo se usa', () => {
    expect(problemasDePlantilla(subir(docx(['{propietarios} {deposito}'])))).toEqual([
      '«{propietarios}» es una lista: se usa como {#propietarios}…{/propietarios}, o {propietarios.texto} para todos juntos.',
      '«{deposito}» es una condición: se usa como {#deposito}…{/deposito}; el dato es {deposito.importe} / {deposito.letras}.',
    ]);
  });

  it('un campo de otra lista adentro de una lista', () => {
    expect(problemasDePlantilla(subir(docx(['{#tramos}{nombre}{/tramos}'])))).toEqual([
      '«{nombre}» solo se puede usar adentro de {#propietarios}…{/propietarios}, {#inquilinos}…{/inquilinos}, {#garantes}…{/garantes}.',
    ]);
  });

  it('marcadores mal formados, en castellano y nombrando cuál', () => {
    // La sintaxis del editor anterior.
    expect(problemasDePlantilla(subir(docx(['Entre {{ inquilinos.texto }} y'])))).toEqual([
      '«{{ inquilinos.texto }}» tiene llaves dobles: en Word los marcadores van con una sola, así: {inquilinos.texto}.',
    ]);
    expect(problemasDePlantilla(subir(docx(['Entre {inquilinos.texto y nada más'])))).toEqual([
      expect.stringMatching(/^Falta cerrar la llave en «/),
    ]);
    expect(problemasDePlantilla(subir(docx(['{#deposito}sin cerrar'])))).toEqual([
      '«{#deposito}» se abre y nunca se cierra: falta «{/deposito}».',
    ]);
    expect(problemasDePlantilla(subir(docx(['{#deposito}x{/tramos}'])))).toEqual([
      '«{#deposito}» se cierra con «{/tramos}»: tiene que cerrarse con «{/deposito}».',
    ]);
  });

  it('rechaza lo que no es un .docx', () => {
    expect(problemasDePlantilla(subir(Buffer.from('%PDF-1.7 hola'), 'Contrato.docx'))).toEqual([
      'El archivo no es un Word (.docx). Abrilo en Word y guardalo como .docx.',
    ]);
    expect(problemasDePlantilla(subir(docx(['hola']), 'Contrato.pdf'))).toEqual([
      'La plantilla tiene que ser un archivo de Word (.docx).',
    ]);
    expect(problemasDePlantilla(subir(docx(['hola']), 'Contrato.doc'))).toEqual([
      'Los .doc viejos no sirven: abrilo en Word y guardalo como .docx.',
    ]);
    // Un ZIP que no es un Word.
    const zip = new PizZip();
    zip.file('hola.txt', 'hola');
    expect(
      problemasDePlantilla(subir(zip.generate({ type: 'nodebuffer' }), 'Contrato.docx')),
    ).toEqual(['El archivo no es un documento de Word (.docx).']);
  });

  it('rechaza un archivo de más de 5 MB', () => {
    expect(
      problemasDePlantilla({ buffer: docx(['x']), originalname: 'a.docx', size: 6 * 1024 * 1024 }),
    ).toEqual(['La plantilla pesa más de 5 MB.']);
  });
});
