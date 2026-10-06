import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import type { CobroDto } from '@vacker/types';
import { textoDePdf } from '../../common/texto-pdf';
import { LEYENDA_NO_FACTURA, ReciboDocument } from './recibo.template';

const cobro = (over: Partial<CobroDto> = {}): CobroDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  numero: 8,
  persona: { id: '22222222-2222-4222-8222-222222222222', nombre: 'Romina Inquilina' },
  fecha: '2026-11-05',
  moneda: 'ARS',
  importe: 1_110_000,
  medio: 'transferencia',
  obs: null,
  imputaciones: [
    { conceptoId: '33333333-3333-4333-8333-333333333333', contrato: { id: '44444444-4444-4444-8444-444444444444', codigo: '5' }, descripcion: 'Arreglo del aire', sentido: 'a_pagar', importe: 140_699, deSaldoAFavor: null },
    { conceptoId: '55555555-5555-4555-8555-555555555555', contrato: { id: '44444444-4444-4444-8444-444444444444', codigo: '5' }, descripcion: 'Alquiler noviembre 2026', sentido: 'a_cobrar', importe: 1_137_518, deSaldoAFavor: 7 },
  ],
  aFavor: 103_181,
  anulado: null,
  ...over,
});

const texto = async (c: CobroDto) => textoDePdf(await renderToBuffer(<ReciboDocument cobro={c} tenantNombre="Alteva Propiedades" logoUrl={null} colorPrimario={null} />));

describe('Recibo (regla 23)', () => {
  it('lista lo que canceló, el total y la leyenda de no factura', async () => {
    const t = await texto(cobro());
    expect(t).toContain('RECIBO N° 000008');
    expect(t).toContain('Romina Inquilina');
    expect(t).toContain('Alquiler noviembre 2026');
    expect(t).toContain('$ 1.110.000,00');
    expect(t).toContain(LEYENDA_NO_FACTURA);
  });

  it('dice qué se pagó con saldo a favor, qué se compensó y qué queda a favor', async () => {
    const t = await texto(cobro());
    expect(t).toContain('Pagado con el saldo a favor del recibo 000007');
    expect(t).toContain('Reintegro a su favor');
    expect(t).toContain('$ 103.181,00');
  });

  it('un recibo anulado lo dice con su motivo', async () => {
    expect(await texto(cobro({ anulado: { en: '2026-11-06T10:00:00Z', motivo: 'Transferencia rechazada' } }))).toContain('Transferencia rechazada');
  });
});

describe('Liquidación en PDF (regla 23)', () => {
  it('lista lo cobrado, cada descuento y el neto, con la leyenda', async () => {
    const { LiquidacionDocument } = await import('./liquidacion.template');
    const linea = (descripcion: string, importe: number, tipo: 'alquiler' | 'honorarios') => ({
      conceptoId: crypto.randomUUID(),
      contrato: { id: crypto.randomUUID(), codigo: '5' },
      tipo,
      descripcion,
      importe,
    });
    const buffer = await renderToBuffer(
      <LiquidacionDocument
        liquidacion={{
          id: crypto.randomUUID(),
          numero: 3,
          persona: { id: crypto.randomUUID(), nombre: 'Juan Propietario' },
          fecha: '2026-11-12',
          moneda: 'ARS',
          medio: 'transferencia',
          aPagar: [linea('Alquiler noviembre 2026', 1_137_518, 'alquiler')],
          aDescontar: [linea('Honorarios noviembre 2026', 110_111.74, 'honorarios')],
          neto: 1_027_406.26,
          anulado: null,
        }}
        tenantNombre="Alteva Propiedades"
        logoUrl={null}
        colorPrimario={null}
      />,
    );
    const t = textoDePdf(buffer);
    expect(t).toContain('LIQUIDACIÓN N° 000003');
    expect(t).toContain('Honorarios noviembre 2026');
    expect(t).toContain('$ 1.027.406,26');
    expect(t).toContain(LEYENDA_NO_FACTURA);
  });
});
