import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import type { TasacionDto } from '@vacker/types';
import { InformeDocument } from './informe.template';

const TASACION: TasacionDto = {
  id: '11111111-1111-1111-1111-111111111111',
  codigo: null,
  agenteId: '22222222-2222-2222-2222-222222222222',
  agente: { id: '22222222-2222-2222-2222-222222222222', nombre: 'Ana', email: 'ana@vacker.com', fotoUrl: null },
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
    { id: 'f1', url: 'https://example.com/foto1.jpg', orden: 0 },
    { id: 'f2', url: 'https://example.com/foto2.jpg', orden: 1 },
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
