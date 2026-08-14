import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { medirFotosPdf } from '../../../common/medir-fotos-pdf';
import { fuentesUsadasEnPdf, textoDePdf } from '../../../common/texto-pdf';
import { describe, expect, it } from 'vitest';
import type { TasacionDto } from '@vacker/types';
import { InformeDocument } from './informe.template';

/**
 * Foto de prueba 4:3, la proporción con la que sale una cámara de celular y en
 * la que están todas las fotos de propiedad que sube Vacker. Va como data URI
 * para que el test no dependa de la red.
 */
const FOTO_4_3 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAEsCAIAAABi1XKVAAAEz0lEQVR4nO3OQQkAMQADsPpXMRETcbLOQn9lEIiA5LsH4AmZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASpkPAEqZDwBKmQ8ASj8kc/7l+5mn7AAAAABJRU5ErkJggg==';

const TASACION: TasacionDto = {
  id: '11111111-1111-1111-1111-111111111111',
  codigo: null,
  agenteId: '22222222-2222-2222-2222-222222222222',
  agente: { id: '22222222-2222-2222-2222-222222222222', nombre: 'Ana', email: 'ana@vacker.com', fotoUrl: null, telefono: null },
  cliente: 'Cliente de Prueba',
  fecha: '2026-03-10',
  direccion: 'Calle Falsa 123',
  barrio: 'Palermo',
  ciudad: 'CABA',
  tipoOperacion: 'venta',
  tipoPropiedad: 'PH',
  supCubierta: 80,
  supSemicubierta: 10,
  supDescubierta: 20,
  supTerreno: null,
  superficieTotal: 96,
  dormitorios: 2,
  banos: 1,
  toilette: null,
  ambientes: 3,
  antiguedad: 10,
  estadoInmueble: 'Muy bueno',
  disposicion: null,
  orientacion: null,
  cochera: true,
  balcon: true,
  terraza: false,
  patio: false,
  lavadero: true,
  piscina: false,
  altillo: false,
  baulera: true,
  biblioteca: false,
  escritorio: false,
  jardin: false,
  vestidor: false,
  servicios: ['Gas natural', 'Cloaca'],
  tieneAmenities: true,
  amenities: ['Parrilla'],
  detalleAmenities: null,
  expensas: 100,
  aptoCredito: 'Sí',
  documentacion: null,
  comparables: [
    {
      id: 'c1',
      direccion: 'Comparable 1',
      tipoComp: 'Departamento',
      superficie: 90,
      precio: 180_000,
      dormitorios: 2,
      banos: 1,
      cochera: false,
      estado: null,
      fuente: 'Publicación',
      tipoPrecio: 'Publicado',
      link: null,
      observaciones: null,
      usdM2: 2000,
    },
  ],
  fotos: [
    { id: 'f1', url: FOTO_4_3, orden: 0 },
    { id: 'f2', url: FOTO_4_3, orden: 1 },
  ],
  analisisComercial: {
    fortalezas: ['Excelente ubicación'],
    aspectos: ['Necesita mejoras'],
    demanda: 'Alto',
    competencia: 'Medio',
    perfilComprador: 'Familia',
    observacionesComerciales: 'Zona muy demandada.',
  },
  valorMinimo: 172_800,
  valorRecomendado: 180_480,
  valorAspiracional: 192_000,
  margenNegociacion: 5,
  escenarioRecomendado: 'Venta equilibrada',
  plazoEstimado: '60 a 90 días',
  estrategiaComercial: {
    estrategia: ['Fotografías profesionales', 'Publicación en portales inmobiliarios'],
    observacionesEstrategia: 'Priorizar portales.',
  },
  estado: 'Presentada',
  exclusividad: null,
  motivoNoCaptada: null,
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
};

describe('InformeDocument (PDF)', () => {
  it('genera un PDF no vacío sin tirar excepción', async () => {
    const buffer = await renderToBuffer(
      <InformeDocument tasacion={TASACION} tenantNombre="Vacker" logoUrl={null} />,
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

/**
 * Las fotos del informe no se recortan.
 *
 * Reportado por el CEO: "el informe estira las fotos". Midiendo el PDF real
 * resultó que no había deformación —se dibujaban a su proporción exacta— sino
 * AMPUTACIÓN: la caja era de 169x84 (proporción 2:1) y la foto de 169x126,8
 * (4:3), así que se veía el 66% del alto. Una foto de ambiente sin techo ni
 * piso se percibe como estirada, y por eso el reporte sonaba a otra cosa.
 *
 * El test lee el PDF generado: compara el alto de la caja de recorte contra el
 * alto al que se dibuja la foto. Si se separan, volvió el recorte.
 */
describe('InformeDocument — las fotos no se recortan', () => {
  it('la caja de la foto tiene la misma proporción que la foto', async () => {
    const buffer = await renderToBuffer(
      <InformeDocument tasacion={TASACION} tenantNombre="Vacker" logoUrl={null} />,
    );
    const medidas = medirFotosPdf(buffer);

    expect(medidas.length).toBeGreaterThan(0);
    for (const { cajaAlto, fotoAlto } of medidas) {
      // Se tolera 1pt por el redondeo del layout.
      expect(Math.abs(cajaAlto - fotoAlto)).toBeLessThanOrEqual(1);
    }
  }, 20_000);
});

/**
 * Saca del PDF, para cada foto, el alto de su caja de recorte y el alto al que
 * se dibujó. Si la caja es más baja que el dibujo, hay recorte.
 */

/**
 * Un informe de marca no puede llevar dos tipografías.
 *
 * react-pdf incrusta Helvetica por CADA carácter que no encuentre en la familia
 * registrada. Pasó en el reporte semanal con el ✓ de la tira de semanas:
 * Montserrat no lo tiene, y el PDF terminaba con Helvetica adentro por una sola
 * tilde. Este test lo detecta sin abrir el archivo.
 */
describe('tipografía del informe de tasación', () => {
  it('solo dibuja con Montserrat', async () => {
    const familias = fuentesUsadasEnPdf(
      await renderToBuffer(
        <InformeDocument tasacion={TASACION} tenantNombre="Vacker" logoUrl={null} />,
      ),
    );

    expect(familias.every((f) => f.startsWith('Montserrat'))).toBe(true);
  });
});

/**
 * Este informe se lleva a la reunión de captación y se le deja al propietario:
 * es el argumento entero del módulo. Durante meses el encabezado dijo
 * "DOCUMENTO INTERNO", heredado del prototipo, y nadie lo miró — hasta que la
 * captura salió en el sitio comercial al lado de una frase que prometía
 * justamente lo contrario.
 *
 * El listado de tasaciones (reporte.template.tsx) sí es interno y sigue
 * diciéndolo. Este no.
 */
describe('a quién dice estar dirigido el informe de tasación', () => {
  it('se presenta como un informe para el propietario, no como uno interno', async () => {
    const texto = await textoDePdf(
      await renderToBuffer(
        <InformeDocument tasacion={TASACION} tenantNombre="Vacker" logoUrl={null} />,
      ),
    );

    expect(texto).toContain('INFORME PARA EL PROPIETARIO');
    expect(texto).not.toContain('DOCUMENTO INTERNO');
  });
});

describe('servicios y amenities en el informe', () => {
  /*
   * Van en una fila a lo ancho, con la etiqueta arriba y la lista debajo, y no
   * en la grilla de dos columnas.
   *
   * La primera versión los metió en esa grilla, donde cada fila es
   * `label`/`value` en una sola línea con `space-between`. Con nueve servicios
   * el valor no envolvía: se salía de la columna y quedaba montado encima de la
   * etiqueta. Se vio recién al mirar un PDF de verdad, no en ningún test.
   *
   * Se afirma sobre los VALORES y no sobre las etiquetas. Las etiquetas se
   * dibujan con el peso regular de Montserrat y ese subconjunto no sobrevive a
   * la extracción de glifos — "Servicios" sale como "6kSdHuHIN". Los valores van
   * en negrita, que sí decodifica. Ver `textoDePdf` y la convención 14.
   */
  const SERVICIOS_LARGOS = [
    'Agua corriente',
    'Cable',
    'Cloaca',
    'Encargado',
    'Gas natural',
    'Internet',
    'Teléfono',
    'Pavimento',
  ];
  const AMENITIES = ['Piscina', 'Cancha de fútbol', 'SUM', 'Sauna seco', 'Gimnasio'];

  it('lista entera los servicios y los amenities elegidos', async () => {
    const texto = await textoDePdf(
      await renderToBuffer(
        <InformeDocument
          tasacion={{ ...TASACION, servicios: SERVICIOS_LARGOS, amenities: AMENITIES }}
          tenantNombre="Vacker"
          logoUrl={null}
        />,
      ),
    );

    // El último de cada lista importa tanto como el primero: es el que se pierde
    // si el texto se corta en vez de envolver.
    for (const s of SERVICIOS_LARGOS) expect(texto, `falta el servicio ${s}`).toContain(s);
    for (const a of AMENITIES) expect(texto, `falta el amenity ${a}`).toContain(a);
  });

  it('no arrastra nada cuando no hay servicios ni amenities cargados', async () => {
    const texto = await textoDePdf(
      await renderToBuffer(
        <InformeDocument
          tasacion={{
            ...TASACION,
            servicios: [],
            amenities: [],
            tieneAmenities: false,
            detalleAmenities: null,
          }}
          tenantNombre="Vacker"
          logoUrl={null}
        />,
      ),
    );

    /*
     * Acá solo cadenas LARGAS, y no la lista entera.
     *
     * `textoDePdf` decodifica cada texto con todos los CMaps y devuelve las
     * lecturas juntas: la correcta más ruido. Para `toContain` eso da igual,
     * pero al revés no — "SUM", de tres letras, aparecía por casualidad dentro
     * del ruido y el test fallaba con la fila correctamente ausente.
     */
    for (const s of ['Agua corriente', 'Gas natural', 'Pavimento']) {
      expect(texto, `no debería estar el servicio ${s}`).not.toContain(s);
    }
    for (const a of ['Cancha de fútbol', 'Sauna seco']) {
      expect(texto, `no debería estar el amenity ${a}`).not.toContain(a);
    }
  });
});

describe('la superficie del terreno en el informe', () => {
  /*
   * Faltaba, y salió a un cliente real.
   *
   * El dato se cargaba en el formulario, se guardaba, viajaba en el DTO y hasta
   * lo usaba el cálculo de comparables — pero la lista de características del
   * PDF nunca lo imprimía. Vacker tasó una casa de 56 m² cubiertos sobre un
   * terreno de 146 y mandó el informe sin el terreno; en una casa ese número
   * suele pesar más que los metros construidos.
   *
   * Se afirma sobre el VALOR y no sobre la etiqueta: las etiquetas van en el
   * peso regular de Montserrat y ese subconjunto no sobrevive a la extracción
   * de glifos. Ver `textoDePdf` y la convención 14.
   */
  it('imprime los metros del terreno cuando están cargados', async () => {
    const texto = await textoDePdf(
      await renderToBuffer(
        <InformeDocument
          tasacion={{ ...TASACION, supCubierta: 56, supTerreno: 146 }}
          tenantNombre="Vacker"
          logoUrl={null}
        />,
      ),
    );

    expect(texto, 'no aparecen los metros del terreno').toContain('146 m²');
  });

  it('no inventa una fila de terreno cuando no se cargó', async () => {
    // Un departamento no tiene terreno propio: si saliera una fila en cero, el
    // propietario leería un dato que nadie cargó.
    //
    // Se busca el 146 y no un "0 m²" genérico: la primera versión de este test
    // afirmaba `not.toContain('0 m²')` y fallaba sola, porque "80 m²" —la
    // superficie cubierta de la tasación de prueba— también lo contiene.
    const texto = await textoDePdf(
      await renderToBuffer(
        <InformeDocument
          tasacion={{ ...TASACION, supCubierta: 56, supTerreno: null }}
          tenantNombre="Vacker"
          logoUrl={null}
        />,
      ),
    );

    expect(texto, 'apareció una fila de terreno que nadie cargó').not.toContain('146 m²');
  });

});
