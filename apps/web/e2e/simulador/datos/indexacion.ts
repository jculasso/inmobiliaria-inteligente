import type { z } from 'zod';
import type {
  BandejaIndexacionDtoSchema,
  ConceptoDtoSchema,
  DiferenciasFinalesDtoSchema,
  IndexacionDtoSchema,
} from '@vacker/types';
import { IDS } from './comunes';
import { CONTRATOS_RESUMEN } from './contratos';

type Tramo = z.input<typeof IndexacionDtoSchema>;

const ALT3 = CONTRATOS_RESUMEN[2]!.id;

/**
 * La bandeja «A indexar» (reglas 7 y 130 a 139):
 *  - ALT-0001, tramo 3: el índice ya salió, se confirma directo.
 *  - ALT-0002, tramo 3: empezó el 1/10 y el IPC de septiembre no salió. ESPERA
 *    el índice: no está vencido, se cobra como liquidación parcial.
 *  - ALT-0003, tramo 4: el IPC salió tarde; agosto y septiembre se cobraron
 *    como parcial, así que confirmarlo genera las diferencias.
 */
export const TRAMOS: Tramo[] = [
  {
    tramoId: IDS.tramo,
    contrato: { id: IDS.contrato, codigo: 'ALT-0001', direccion: 'Belgrano 1234', unidad: '3° B' },
    inquilinos: ['Lucía Fernández'],
    indice: 'ICL',
    numero: 3,
    desde: '2026-11-01',
    hasta: '2027-02-28',
    importeAnterior: 980_000,
    estado: 'lista',
    fechaBase: '2026-07-01',
    valorBase: 24.1234,
    fechaRequerida: '2026-11-01',
    valorRequerido: 27.4567,
    importePropuesto: 1_115_386.5,
    falta: [],
    vencida: false,
  },
  {
    tramoId: IDS.tramo2,
    contrato: {
      id: IDS.contrato2,
      codigo: 'ALT-0002',
      direccion: 'Av. Colón 455',
      unidad: 'local 2',
    },
    inquilinos: ['Panadería El Trigal SRL'],
    indice: 'IPC',
    numero: 3,
    desde: '2026-10-01',
    hasta: '2026-12-31',
    importeAnterior: 1_200_000,
    estado: 'pendiente_indice',
    fechaBase: '2026-06-01',
    valorBase: 11_077.0608,
    fechaRequerida: '2026-09-01',
    valorRequerido: null,
    importePropuesto: null,
    falta: ['el IPC de septiembre de 2026'],
    vencida: false,
  },
  {
    tramoId: IDS.tramo3,
    contrato: { id: ALT3, codigo: 'ALT-0003', direccion: 'Belgrano 1234', unidad: '1° A' },
    inquilinos: ['Lucía Fernández'],
    indice: 'IPC',
    numero: 4,
    desde: '2026-08-01',
    hasta: '2026-11-30',
    importeAnterior: 700_000,
    estado: 'lista',
    fechaBase: '2026-03-01',
    valorBase: 11_077.0608,
    fechaRequerida: '2026-07-01',
    valorRequerido: 12_076.3937,
    importePropuesto: 763_150,
    falta: [],
    vencida: true,
  },
];

export const BANDEJA: z.input<typeof BandejaIndexacionDtoSchema> = {
  indices: [
    { indice: 'ICL', ultimaFecha: '2026-11-01', alerta: null },
    { indice: 'IPC', ultimaFecha: '2026-08-01', alerta: null },
  ],
  tramos: TRAMOS,
};

/** Lo que va a generar confirmar ALT-0003: la liquidación final de agosto y septiembre. */
export const DIFERENCIAS_ALT3: z.input<typeof DiferenciasFinalesDtoSchema> = {
  moneda: 'ARS',
  periodos: ['2026-08', '2026-09'],
  inquilino: 126_300,
  propietarios: 113_670,
  vencimiento: '2026-10-20',
  conceptos: 6,
};

type Concepto = z.input<typeof ConceptoDtoSchema>;

function concepto(id: string, extra: Partial<Concepto>): Concepto {
  return {
    id,
    contrato: { id: IDS.contrato2, codigo: 'ALT-0002', direccion: 'Av. Colón 455' },
    persona: { id: IDS.inquilino2, nombre: 'Panadería El Trigal SRL' },
    tipo: 'alquiler',
    sentido: 'a_cobrar',
    moneda: 'ARS',
    periodo: '2026-10',
    vencimiento: '2026-10-05',
    importe: 1_200_000,
    adelantadoPorInmobiliaria: false,
    descripcion: null,
    generado: true,
    aplicado: false,
    anulado: null,
    saldo: 1_200_000,
    papel: 'inquilino',
    estado: 'pendiente',
    etapa: null,
    ...extra,
  };
}

/** Los conceptos de octubre: uno común, una parcial y la final de otro contrato (regla 130). */
export function conceptosDe(periodo: string): Concepto[] {
  if (periodo !== '2026-10') return [];
  return [
    concepto('0e2e0000-0000-4000-8000-0000000f0001', {
      etapa: 'parcial',
      descripcion:
        'Alquiler octubre 2026 — liquidación parcial (espera el IPC de septiembre de 2026)',
    }),
    concepto('0e2e0000-0000-4000-8000-0000000f0002', {
      contrato: { id: ALT3, codigo: 'ALT-0003', direccion: 'Belgrano 1234' },
      persona: { id: IDS.inquilino, nombre: 'Lucía Fernández' },
      importe: 63_150,
      saldo: 63_150,
      vencimiento: '2026-10-20',
      etapa: 'final',
      descripcion: 'Alquiler septiembre 2026 — liquidación final (diferencia por IPC)',
    }),
    concepto('0e2e0000-0000-4000-8000-0000000f0003', {
      contrato: { id: IDS.contrato, codigo: 'ALT-0001', direccion: 'Belgrano 1234' },
      persona: { id: IDS.inquilino, nombre: 'Lucía Fernández' },
      importe: 980_000,
      saldo: 0,
      estado: 'cobrado',
      descripcion: 'Alquiler octubre 2026',
    }),
  ];
}
