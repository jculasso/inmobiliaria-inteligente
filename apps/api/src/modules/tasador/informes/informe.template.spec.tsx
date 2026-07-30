import React from 'react';
import { inflateSync } from 'node:zlib';
import { renderToBuffer } from '@react-pdf/renderer';
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
    const medidas = medirFotos(buffer);

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
function medirFotos(buffer: Buffer): { cajaAlto: number; fotoAlto: number }[] {
  const bin = buffer.toString('binary');
  const salida: { cajaAlto: number; fotoAlto: number }[] = [];

  for (const m of bin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let txt: string;
    try {
      txt = inflateSync(Buffer.from(m[1]!, 'binary')).toString('binary');
    } catch {
      continue;
    }

    for (const dibujo of txt.matchAll(
      /([-\d.]+) [-\d.]+ [-\d.]+ ([-\d.]+) [-\d.]+ [-\d.]+ cm\s*\/\w+ Do/g,
    )) {
      const fotoAncho = Math.abs(Number(dibujo[1]));
      const fotoAlto = Math.abs(Number(dibujo[2]));
      // Las fotos de la fila son las grandes; el logo y el avatar son chicos.
      if (fotoAlto < 100) continue;

      // El recorte más cercano hacia atrás define la caja visible.
      const antes = txt.slice(0, dibujo.index);
      const corte = antes.lastIndexOf('W n');
      if (corte < 0) continue;
      const path = antes.slice(Math.max(0, corte - 600), corte);
      const ys = [...path.matchAll(/([-\d.]+)\s+(?:l|c|m)\b/g)].map((y) => Number(y[1]));
      const cajaAlto = ys.length ? Math.max(...ys) : fotoAlto;

      salida.push({ cajaAlto, fotoAlto });
      void fotoAncho;
    }
  }
  return salida;
}
