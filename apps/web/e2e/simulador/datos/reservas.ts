import type { z } from 'zod';
import type { ReservaDtoSchema, ReservaResumenDtoSchema } from '@vacker/types';
import { IDS } from './comunes';

export type Reserva = z.output<typeof ReservaDtoSchema>;
type Resumen = z.input<typeof ReservaResumenDtoSchema>;

/**
 * Las fechas de las reservas van contra el reloj, no contra `HOY`: la
 * pantalla calcula «vence en N días» y «Dar por vencida» con la fecha real.
 */
export function enDias(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export const ID_RESERVA_NUEVA = '0e2e0000-0000-4000-8000-00000000e009';
export const ID_RECIBO_SENA = '0e2e0000-0000-4000-8000-00000000f123';

const base = (): Omit<Reserva, 'id' | 'numero' | 'estado' | 'sena'> => ({
  tipo: 'vivienda',
  fecha: enDias(-2),
  vence: enDias(5),
  propiedad: { id: IDS.propiedad, direccion: 'Belgrano 1234', unidad: '3° B', ciudad: 'Córdoba' },
  interesados: [{ id: IDS.inquilino, nombre: 'Lucía Fernández' }],
  contrato: null,
  partes: [
    { personaId: IDS.inquilino, nombre: 'Lucía Fernández', papel: 'inquilino' },
    { personaId: IDS.propietario, nombre: 'Carlos Gómez', papel: 'propietario' },
  ],
  moneda: 'ARS',
  alquilerInicial: 900_000,
  inicio: '2026-11-01',
  duracionMeses: 24,
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 4,
  depositoImporte: null,
  depositoMoneda: null,
  obs: null,
  motivo: null,
  senaRetenida: null,
  registrado: { en: '2026-10-13T13:00:00.000Z', por: 'Persona de Prueba' },
  garantias: [],
  historial: [],
});

/**
 * Tres reservas, una por momento del circuito:
 *  - 7: recién reservada, con la seña acordada SIN cobrar.
 *  - 6: aprobada, con la seña cobrada (recibo 000123): se convierte en contrato
 *    o se cierra porque el interesado no se presentó.
 *  - 5: cerrada, no se presentó a firmar: la seña quedó retenida.
 */
export function reservasIniciales(): Reserva[] {
  return [
    {
      ...base(),
      id: IDS.reserva2,
      numero: 7,
      estado: 'reservada',
      sena: {
        importe: 300_000,
        moneda: 'ARS',
        recibida: false,
        recibidaEl: null,
        medio: null,
        recibo: null,
      },
    },
    {
      ...base(),
      id: IDS.reserva,
      numero: 6,
      estado: 'aprobada',
      sena: {
        importe: 900_000,
        moneda: 'ARS',
        recibida: true,
        recibidaEl: enDias(-1),
        medio: 'transferencia',
        recibo: { id: ID_RECIBO_SENA, numero: 123 },
      },
    },
    {
      ...base(),
      id: IDS.reserva3,
      numero: 5,
      estado: 'no_se_presento',
      fecha: enDias(-20),
      vence: enDias(-13),
      propiedad: {
        id: IDS.propiedad2,
        direccion: 'Av. Colón 455',
        unidad: 'local 2',
        ciudad: 'Córdoba',
      },
      tipo: 'comercial',
      sena: {
        importe: 500_000,
        moneda: 'ARS',
        recibida: true,
        recibidaEl: enDias(-19),
        medio: 'efectivo',
        recibo: { id: '0e2e0000-0000-4000-8000-00000000f122', numero: 122 },
      },
      senaRetenida: 500_000,
    },
  ];
}

export function resumenDe(r: Reserva): Resumen {
  return {
    id: r.id,
    numero: r.numero,
    estado: r.estado,
    tipo: r.tipo,
    fecha: r.fecha,
    vence: r.vence,
    propiedad: { id: r.propiedad.id, direccion: r.propiedad.direccion, unidad: r.propiedad.unidad },
    interesados: r.interesados,
    sena: r.sena,
    contrato: r.contrato,
  };
}
