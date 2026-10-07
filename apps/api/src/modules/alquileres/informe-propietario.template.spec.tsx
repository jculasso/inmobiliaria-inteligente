import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { renglonesDeLaCadena, type InformePropietarioDto } from '@vacker/types';
import { fuentesUsadasEnPdf, textoDePdf } from '../../common/texto-pdf';
import { InformePropietarioDocument } from './informe-propietario.template';
import { LEYENDA_NO_FACTURA } from './recibo.template';

const C1 = '55555555-5555-4555-8555-555555555555';
const L1 = '44444444-4444-4444-8444-444444444444';
const liq = { id: L1, numero: 12, fecha: '2026-09-10' };

function informe(over: Partial<InformePropietarioDto> = {}): InformePropietarioDto {
  return {
    persona: { id: '11111111-1111-4111-8111-111111111111', nombre: 'Marta Propietaria' },
    desde: '2026-09',
    hasta: '2026-09',
    hoy: '2026-10-07',
    resumen: [
      {
        moneda: 'ARS',
        alquiler: 1_000_000,
        enEspera: 0,
        cobrado: 1_000_000,
        honorarios: 96_800,
        impuestos: 12_345.67,
        expensas: 30_000,
        arreglos: 50_000,
        otros: 0,
        reintegros: 0,
        neto: 810_854.33,
        liquidado: 853_200,
        pendiente: 0,
        aDescontar: 42_345.67,
      },
    ],
    deuda: [
      {
        moneda: 'ARS',
        total: 200_000,
        contratos: [{ id: C1, codigo: 'ALT-0001', inquilino: 'Ana Inquilina', importe: 200_000 }],
      },
    ],
    contratos: [
      {
        id: C1,
        codigo: 'ALT-0001',
        moneda: 'ARS',
        estado: 'vigente',
        propiedad: 'Córdoba 1452 3° B',
        inquilinos: ['Ana Inquilina'],
        porcentaje: null,
        alquilerVigente: 1_000_000,
        proximaIndexacion: '2027-03-01',
        vence: '2028-02-29',
        meses: [
          {
            periodo: '2026-09',
            alquiler: 1_000_000,
            cobrado: 1_000_000,
            enEspera: 0,
            cobradoEl: ['2026-09-05'],
            liquidaciones: [liq],
          },
        ],
      },
    ],
    partidas: [
      {
        conceptoId: '00000000-0000-4000-8000-000000000001',
        categoria: 'impuestos',
        nombre: 'TGI (Tasa municipal)',
        detalle: 'TGI (Tasa municipal) cuota 9/12',
        periodo: '2026-09',
        contrato: { id: C1, codigo: 'ALT-0001', propiedad: 'Córdoba 1452 3° B' },
        moneda: 'ARS',
        importe: 12_345.67,
        liquidacion: null,
      },
      {
        conceptoId: '00000000-0000-4000-8000-000000000002',
        categoria: 'expensas',
        nombre: 'Expensas extraordinarias',
        detalle: 'Expensas extraordinarias',
        periodo: '2026-09',
        contrato: { id: C1, codigo: 'ALT-0001', propiedad: 'Córdoba 1452 3° B' },
        moneda: 'ARS',
        importe: 30_000,
        liquidacion: liq,
      },
    ],
    reclamos: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        numero: 7,
        fecha: '2026-09-12',
        asunto: 'Pérdida de agua en el baño',
        estado: 'resuelto',
        contrato: { id: C1, codigo: 'ALT-0001' },
        propiedad: 'Córdoba 1452 3° B',
        proveedor: 'Plomero Juan',
        aCargoDelPropietario: [{ moneda: 'ARS', importe: 50_000 }],
      },
    ],
    liquidaciones: [
      {
        ...liq,
        medio: 'transferencia',
        moneda: 'ARS',
        neto: 853_200,
        delPeriodo: 853_200,
      },
    ],
    ...over,
  };
}

const pdf = (i: InformePropietarioDto) =>
  renderToBuffer(
    <InformePropietarioDocument
      informe={i}
      tenantNombre="Alteva Propiedades"
      logoUrl={null}
      colorPrimario="#0E7C4A"
    />,
  );

describe('Informe al propietario en PDF (regla 95)', () => {
  it('lleva la cadena, las propiedades, los descuentos, los reclamos y las liquidaciones', async () => {
    const t = textoDePdf(await pdf(informe()));
    expect(t).toContain('INFORME AL PROPIETARIO');
    expect(t).toContain('Marta Propietaria');
    expect(t).toContain('septiembre 2026');
    expect(t).toContain('Neto del período');
    expect(t).toContain('$ 810.854,33');
    // Regla 98: nada de pendiente negativo; lo que falta descontar, en su renglón y con qué es.
    expect(t).toContain('Pendiente de liquidar');
    expect(t).not.toContain('-$');
    expect(t).toContain('A descontar en la próxima liquidación');
    expect(t).toContain('$ 42.345,67');
    // Qué es: la TGI, que todavía no se descontó (las expensas ya entraron en la 12).
    expect(t).toContain('Impuesto: TGI (Tasa municipal) cuota 9/12');
    expect(t).not.toContain('Expensa: Expensas extraordinarias');
    expect(t).toContain('Se descontará en la próxima liquidación');
    expect(t).toContain('El inquilino debe hoy $ 200.000,00');
    expect(t).toContain('PROPIEDAD: Córdoba 1452 3° B');
    expect(t).toContain('Liq. 000012 del 10/09/2026');
    expect(t).toContain('Descontado en la liquidación 000012 del 10/09/2026');
    // Regla 91: cada impuesto con su nombre; las extraordinarias, en su línea.
    expect(t).toContain('TGI (Tasa municipal)');
    expect(t).toContain('Expensas extraordinarias');
    expect(t).toContain('Pérdida de agua en el baño');
    expect(t).toContain('$ 50.000,00');
    expect(t).toContain(LEYENDA_NO_FACTURA);
  });

  it('regla 94: sin movimientos lo dice, en vez de una cadena en cero', async () => {
    const t = textoDePdf(
      await pdf(
        informe({
          desde: '2026-05',
          hasta: '2026-05',
          resumen: [],
          deuda: [],
          partidas: [],
          reclamos: [],
          liquidaciones: [],
        }),
      ),
    );
    expect(t).toContain('Sin movimientos en mayo 2026.');
    expect(t).not.toContain('Neto del período');
  });

  it('solo dibuja con Montserrat (CONVENCIONES_TECNICAS §14)', async () => {
    const familias = fuentesUsadasEnPdf(await pdf(informe()));
    expect(familias.length).toBeGreaterThan(0);
    expect(familias.every((f) => f.startsWith('Montserrat'))).toBe(true);
  });

  it('reglas 87 y 98: los renglones siempre dicen alquiler, cobrado, neto, liquidado y pendiente', () => {
    const r = renglonesDeLaCadena(
      { ...informe().resumen[0]!, impuestos: 0, expensas: 0 },
      'Arreglo: Plomero Juan (reclamo 2)',
    );
    expect(r.map((x) => [x.nombre, x.importe])).toEqual([
      ['Alquiler del período', 1_000_000],
      ['Cobrado', 1_000_000],
      ['− Honorarios', 96_800],
      ['− Arreglos', 50_000],
      ['Neto del período', 810_854.33],
      ['Liquidado (transferido)', 853_200],
      ['Pendiente de liquidar', 0],
      ['A descontar en la próxima liquidación', 42_345.67],
    ]);
    expect(r.at(-1)!.detalle).toBe('Arreglo: Plomero Juan (reclamo 2)');
    // Sin nada a descontar, ese renglón no está.
    expect(
      renglonesDeLaCadena({ ...informe().resumen[0]!, aDescontar: 0 }).map((x) => x.nombre),
    ).not.toContain('A descontar en la próxima liquidación');
  });
});
