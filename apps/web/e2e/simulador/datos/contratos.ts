import type { z } from 'zod';
import type {
  CompletoContratoDtoSchema,
  ConfiguracionAlquileresSchema,
  ContratoDtoSchema,
  ContratoResumenDtoSchema,
  CorreccionTramoDtoSchema,
  PersonaDtoSchema,
  PropiedadAlquilerDtoSchema,
} from '@vacker/types';
import { IDS } from './comunes';

type Persona = z.input<typeof PersonaDtoSchema>;
type Contrato = z.input<typeof ContratoDtoSchema>;

function persona(id: string, nombre: string, extra: Partial<Persona> = {}): Persona {
  return {
    id,
    tipo: 'fisica',
    nombre,
    documento: null,
    email: null,
    telefono: null,
    domicilio: null,
    obs: null,
    ...extra,
  };
}

export const PERSONAS: Persona[] = [
  persona(IDS.propietario, 'Carlos Gómez', { email: 'carlos@ejemplo.test' }),
  persona(IDS.inquilino, 'Lucía Fernández', { email: 'lucia@ejemplo.test' }),
  persona(IDS.inquilino2, 'Panadería El Trigal SRL', { tipo: 'juridica' }),
];

export const PROPIEDADES: z.input<typeof PropiedadAlquilerDtoSchema>[] = [
  {
    id: IDS.propiedad,
    direccion: 'Belgrano 1234',
    unidad: '3° B',
    ciudad: 'Córdoba',
    tipo: 'vivienda',
    obs: null,
  },
  {
    id: IDS.propiedad2,
    direccion: 'Av. Colón 455',
    unidad: 'local 2',
    ciudad: 'Córdoba',
    tipo: 'local',
    obs: null,
  },
];

export const CONFIGURACION: z.input<typeof ConfiguracionAlquileresSchema> = {
  ivaHonorariosPct: 21,
  comisionInicialPct: 5,
  comisionInicialCuotas: 2,
  comisionInicialConIva: true,
  selladoViviendaPct: 0,
  selladoComercialPct: 1,
  selladoComercialMipymePct: 0.25,
  selladoInquilinoPct: 50,
  depositoGestion: 'entrega_propietario',
  contratoHonorariosPct: 8,
  contratoGastosAdmPct: 2,
  contratoPunitorioDiarioPct: 0.3,
  contratoDiaVencimiento: 5,
  contratoDiaPagoPropietario: 10,
  diasDiferenciaFinal: 5,
  honorariosSenaRetenidaPct: 0,
};

const base = {
  fechaFirma: '2026-02-20',
  diaVencimiento: 5,
  diaPagoPropietario: 10,
  honorariosPct: 8,
  gastosAdmPct: 2,
  ivaPct: 21,
  punitorioDiarioPct: 0.3,
  pagoGarantizado: false,
  depositoImporte: null,
  depositoMoneda: null,
  depositoDevolucion: null,
  rescindidoEl: null,
  obs: null,
} satisfies Partial<Contrato>;

/**
 * ALT-0001: vigente, ICL cada 4 meses. El tramo 2 (julio a octubre) ya está
 * confirmado: es el que se corrige. El 3 todavía no se indexó.
 */
export const CONTRATO_1: Contrato = {
  ...base,
  id: IDS.contrato,
  codigo: 'ALT-0001',
  estado: 'vigente',
  tipo: 'vivienda',
  moneda: 'ARS',
  inicio: '2026-03-01',
  fin: '2028-02-29',
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 4,
  propiedad: { id: IDS.propiedad, direccion: 'Belgrano 1234', unidad: '3° B', ciudad: 'Córdoba' },
  partes: [
    { personaId: IDS.propietario, nombre: 'Carlos Gómez', papel: 'propietario', porcentaje: null },
    { personaId: IDS.inquilino, nombre: 'Lucía Fernández', papel: 'inquilino', porcentaje: null },
  ],
  tramos: [
    {
      numero: 1,
      desde: '2026-03-01',
      hasta: '2026-06-30',
      importe: 850_000,
      confirmadoEl: '2026-02-20T12:00:00.000Z',
    },
    {
      numero: 2,
      desde: '2026-07-01',
      hasta: '2026-10-31',
      importe: 980_000,
      confirmadoEl: '2026-07-02T12:00:00.000Z',
    },
    { numero: 3, desde: '2026-11-01', hasta: '2027-02-28', importe: null, confirmadoEl: null },
    { numero: 4, desde: '2027-03-01', hasta: '2027-06-30', importe: null, confirmadoEl: null },
    { numero: 5, desde: '2027-07-01', hasta: '2027-10-31', importe: null, confirmadoEl: null },
    { numero: 6, desde: '2027-11-01', hasta: '2028-02-29', importe: null, confirmadoEl: null },
  ],
};

/** Los meses del tramo 2 de ALT-0001 y cómo está cada uno (reglas 108 a 110). */
export const CORRECCION_TRAMO_2: z.input<typeof CorreccionTramoDtoSchema> = {
  numero: 2,
  desde: '2026-07-01',
  hasta: '2026-10-31',
  importe: 980_000,
  meses: [
    { periodo: '2026-07', estado: 'cobrado' },
    { periodo: '2026-08', estado: 'cobrado' },
    { periodo: '2026-09', estado: 'liquidado' },
    { periodo: '2026-10', estado: 'generado' },
  ],
  desdeSugerido: '2026-10',
};

export const COMPLETO: z.input<typeof CompletoContratoDtoSchema> = {
  deposito: {
    importe: null,
    moneda: null,
    gestion: 'entrega_propietario',
    estado: 'sin_deposito',
    cobrado: 0,
    devueltoEl: null,
  },
  garantias: [],
  cargos: { cargados: true, valorTotal: 0, meses: 24, propuesta: [] },
};

type Resumen = z.input<typeof ContratoResumenDtoSchema>;

/**
 * La lista de contratos. ALT-0002 tiene un tramo que ya empezó y espera el
 * índice (regla 7); ALT-0003, uno que se pasó sin indexar: ese sí está vencido.
 */
export const CONTRATOS_RESUMEN: Resumen[] = [
  {
    id: IDS.contrato,
    codigo: 'ALT-0001',
    estado: 'vigente',
    tipo: 'vivienda',
    moneda: 'ARS',
    inicio: '2026-03-01',
    fin: '2028-02-29',
    propiedad: { id: IDS.propiedad, direccion: 'Belgrano 1234', unidad: '3° B' },
    propietarios: [{ id: IDS.propietario, nombre: 'Carlos Gómez' }],
    inquilinos: [{ id: IDS.inquilino, nombre: 'Lucía Fernández' }],
    importeVigente: 980_000,
    proximaIndexacion: '2099-11-01',
    proximaIndexacionEspera: false,
  },
  {
    id: IDS.contrato2,
    codigo: 'ALT-0002',
    estado: 'vigente',
    tipo: 'comercial',
    moneda: 'ARS',
    inicio: '2026-04-01',
    fin: '2029-03-31',
    propiedad: { id: IDS.propiedad2, direccion: 'Av. Colón 455', unidad: 'local 2' },
    propietarios: [{ id: IDS.propietario, nombre: 'Carlos Gómez' }],
    inquilinos: [{ id: IDS.inquilino2, nombre: 'Panadería El Trigal SRL' }],
    importeVigente: null,
    proximaIndexacion: '2026-10-01',
    proximaIndexacionEspera: true,
  },
  {
    id: '0e2e0000-0000-4000-8000-00000000c003',
    codigo: 'ALT-0003',
    estado: 'vigente',
    tipo: 'vivienda',
    moneda: 'ARS',
    inicio: '2025-06-01',
    fin: '2027-05-31',
    propiedad: { id: IDS.propiedad, direccion: 'Belgrano 1234', unidad: '1° A' },
    propietarios: [{ id: IDS.propietario, nombre: 'Carlos Gómez' }],
    inquilinos: [{ id: IDS.inquilino, nombre: 'Lucía Fernández' }],
    importeVigente: 700_000,
    proximaIndexacion: '2026-09-01',
    proximaIndexacionEspera: false,
  },
];
