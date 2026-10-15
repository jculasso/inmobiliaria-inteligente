import type { z } from 'zod';
import type {
  CadenaInformeSchema,
  CuentaCorrienteDtoSchema,
  InformePropietarioDtoSchema,
  InformePropietariosDtoSchema,
  PersonaFichaDtoSchema,
} from '@vacker/types';
import { HOY, IDS } from './comunes';
import { PERSONAS } from './contratos';

type Cadena = z.input<typeof CadenaInformeSchema>;

const LIQ = { id: '0e2e0000-0000-4000-8000-0000000c0012', numero: 12, fecha: '2026-09-10' };
const ID_SIN_MOVIMIENTOS = '0e2e0000-0000-4000-8000-00000000a009';

/**
 * Lo de Carlos Gómez en el período: se cobró todo, y un impuesto que pagó la
 * inmobiliaria todavía no se le descontó. Por eso no hay nada pendiente de
 * liquidar pero sí algo «a descontar en la próxima liquidación» (regla 93).
 */
const cadena = (over: Partial<Cadena> = {}): Cadena => ({
  moneda: 'ARS',
  alquiler: 2_180_000,
  enEspera: 0,
  cobrado: 2_180_000,
  honorarios: 211_024,
  impuestos: 42_345.67,
  expensas: 30_000,
  arreglos: 0,
  otros: 0,
  reintegros: 0,
  neto: 1_896_630.33,
  liquidado: 1_938_976,
  pendiente: 0,
  aDescontar: 42_345.67,
  ...over,
});

export function informePropietarios(desde: string, hasta: string) {
  const datos: z.input<typeof InformePropietariosDtoSchema> = {
    desde,
    hasta,
    hoy: HOY,
    filas: [
      {
        persona: { id: IDS.propietario, nombre: 'Carlos Gómez' },
        contratos: 2,
        reclamos: 1,
        monedas: [cadena()],
      },
      {
        persona: { id: ID_SIN_MOVIMIENTOS, nombre: 'Pedro Sin Movimientos' },
        contratos: 1,
        reclamos: 0,
        monedas: [],
      },
    ],
    totales: [cadena()],
  };
  return datos;
}

export function informePropietario(desde: string, hasta: string) {
  const datos: z.input<typeof InformePropietarioDtoSchema> = {
    persona: { id: IDS.propietario, nombre: 'Carlos Gómez' },
    desde,
    hasta,
    hoy: HOY,
    resumen: [cadena()],
    deuda: [],
    contratos: [
      {
        id: IDS.contrato,
        codigo: 'ALT-0001',
        moneda: 'ARS',
        estado: 'vigente',
        propiedad: 'Belgrano 1234 3° B',
        inquilinos: ['Lucía Fernández'],
        porcentaje: null,
        alquilerVigente: 980_000,
        proximaIndexacion: '2026-11-01',
        vence: '2028-02-29',
        meses: [
          {
            periodo: hasta,
            alquiler: 980_000,
            cobrado: 980_000,
            enEspera: 0,
            cobradoEl: ['2026-09-05'],
            liquidaciones: [LIQ],
          },
        ],
      },
    ],
    partidas: [
      {
        conceptoId: '0e2e0000-0000-4000-8000-0000000b0001',
        categoria: 'impuestos',
        nombre: 'TGI (Tasa municipal)',
        detalle: 'TGI (Tasa municipal) cuota 9/12',
        periodo: hasta,
        contrato: { id: IDS.contrato, codigo: 'ALT-0001', propiedad: 'Belgrano 1234 3° B' },
        moneda: 'ARS',
        importe: 42_345.67,
        liquidacion: null,
      },
      {
        conceptoId: '0e2e0000-0000-4000-8000-0000000b0002',
        categoria: 'expensas',
        nombre: 'Expensas extraordinarias',
        detalle: 'Expensas extraordinarias',
        periodo: hasta,
        contrato: { id: IDS.contrato, codigo: 'ALT-0001', propiedad: 'Belgrano 1234 3° B' },
        moneda: 'ARS',
        importe: 30_000,
        liquidacion: LIQ,
      },
    ],
    reclamos: [],
    liquidaciones: [
      { ...LIQ, medio: 'transferencia', moneda: 'ARS', neto: 1_938_976, delPeriodo: 1_938_976 },
    ],
  };
  return datos;
}

/** La ficha de Carlos Gómez: propietario de un contrato vigente, así que tiene la solapa «Informe». */
export function fichaPersona(id: string): z.input<typeof PersonaFichaDtoSchema> {
  const persona = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
  return {
    persona,
    cuentas: [],
    contactos: [],
    contratos:
      id === IDS.propietario
        ? [
            {
              id: IDS.contrato,
              codigo: 'ALT-0001',
              papel: 'propietario',
              estado: 'vigente',
              tipo: 'vivienda',
              propiedad: 'Belgrano 1234 3° B',
              inicio: '2026-03-01',
              fin: '2028-02-29',
              moneda: 'ARS',
              importeVigente: 980_000,
            },
          ]
        : [],
  };
}

export function cuentaCorriente(id: string): z.input<typeof CuentaCorrienteDtoSchema> {
  const persona = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
  return { persona: { id: persona.id, nombre: persona.nombre }, monedas: [] };
}
