import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import type { RankingCaptacionItem, ResumenTasadorKpi } from '@vacker/types';
import { ReporteDocument, type ReporteFila } from './reporte.template';

const RESUMEN: ResumenTasadorKpi = {
  total: 4,
  tasaCaptacion: 0.5,
  distribucionEstado: [
    { estado: 'En proceso', cantidad: 1 },
    { estado: 'Presentada', cantidad: 1 },
    { estado: 'Captada', cantidad: 2 },
    { estado: 'No captada', cantidad: 0 },
  ],
};

const RANKING: RankingCaptacionItem[] = [
  { usuarioId: 'u1', nombre: 'Ana', captadas: 2, total: 3, tasaCaptacion: 0.66, peso: 1 },
];

const FILAS: ReporteFila[] = [
  {
    id: 'f1',
    fecha: '2026-03-10',
    direccion: 'Calle Falsa 123',
    barrio: 'Palermo',
    cliente: 'Cliente Uno',
    agenteNombre: 'Ana',
    estado: 'Captada',
    exclusividad: { tipo: 'exclusiva', dias: 90 },
    motivoNoCaptada: null,
    valorRecomendado: 180_000,
  },
  {
    id: 'f2',
    fecha: '2026-03-05',
    direccion: 'Otra Calle 456',
    barrio: null,
    cliente: 'Cliente Dos',
    agenteNombre: 'Ana',
    estado: 'No captada',
    exclusividad: null,
    motivoNoCaptada: 'Precio no competitivo',
    valorRecomendado: null,
  },
];

describe('ReporteDocument (PDF)', () => {
  it('genera un PDF no vacío sin tirar excepción', async () => {
    const buffer = await renderToBuffer(
      <ReporteDocument
        resumen={RESUMEN}
        ranking={RANKING}
        filas={FILAS}
        periodoLabel="Año 2026"
        tenantNombre="Vacker"
        logoUrl={null}
      />,
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('no falla con filas vacías', async () => {
    const buffer = await renderToBuffer(
      <ReporteDocument
        resumen={{ total: 0, tasaCaptacion: 0, distribucionEstado: [] }}
        ranking={[]}
        filas={[]}
        periodoLabel="Marzo 2026"
        tenantNombre="Vacker"
        logoUrl={null}
      />,
    );
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
