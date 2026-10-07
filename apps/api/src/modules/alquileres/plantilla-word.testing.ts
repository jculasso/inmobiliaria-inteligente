import { Prisma } from '@prisma/client';
import PizZip from 'pizzip';
import type { ContratoParaPlantilla } from './plantilla-modelo';

/**
 * Un .docx mínimo con estos párrafos, armado acá con pizzip. Cada párrafo es
 * una lista de tramos de texto («runs»): Word parte un marcador en varios
 * cuando se corrige la ortografía o se cambia el formato a la mitad, y la
 * plantilla tiene que entenderlo igual.
 */
export function docx(parrafos: (string | string[])[]): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const p = (runs: string | string[]) =>
    `<w:p>${[runs]
      .flat()
      .map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`)
      .join('')}</w:p>`;
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parrafos.map(p).join('')}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type Persona = ContratoParaPlantilla['partes'][number]['persona'];
const persona = (nombre: string, extra: Partial<Persona> = {}): Persona => ({
  nombre,
  documento: null,
  cuit: null,
  domicilio: null,
  localidad: null,
  ...extra,
});

/**
 * Un contrato con todo: dos propietarios, una inquilina, un garante,
 * depósito y un tramo que todavía espera el índice.
 */
export function contratoDePrueba(): ContratoParaPlantilla {
  return {
    codigo: 'ALT-0090',
    tipo: 'vivienda',
    moneda: 'ARS',
    inicio: d('2026-03-01'),
    fin: d('2028-02-29'),
    fechaFirma: null,
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 4,
    diaVencimiento: 10,
    punitorioDiarioPct: new Prisma.Decimal(0.5),
    depositoImporte: new Prisma.Decimal(350_000),
    depositoMoneda: 'ARS',
    propiedad: { direccion: 'Bv. Oroño 1452', unidad: '4° B', ciudad: 'Rosario' },
    partes: [
      {
        papel: 'propietario',
        porcentaje: new Prisma.Decimal(50),
        persona: persona('Juan Propietario', {
          documento: '20123456',
          domicilio: 'Córdoba 1452',
          localidad: 'Rosario',
        }),
      },
      {
        papel: 'propietario',
        porcentaje: new Prisma.Decimal(50),
        persona: persona('Marta Propietaria', { documento: '21987654' }),
      },
      {
        papel: 'inquilino',
        porcentaje: null,
        persona: persona('Ana Inquilina', { cuit: '27333444559' }),
      },
      {
        papel: 'garante',
        porcentaje: null,
        persona: persona('Carlos Garante', { documento: '22333444' }),
      },
    ],
    tramos: [
      {
        numero: 1,
        desde: d('2026-03-01'),
        hasta: d('2026-06-30'),
        importe: new Prisma.Decimal(350_000),
      },
      { numero: 2, desde: d('2026-07-01'), hasta: d('2026-10-31'), importe: null },
    ],
  };
}
