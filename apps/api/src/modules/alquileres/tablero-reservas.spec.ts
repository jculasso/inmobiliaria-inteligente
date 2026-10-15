import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { tareasDeReservas, type ReservaDelTablero } from './tablero-reservas';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const HOY = '2026-10-15';

const reserva = (
  id: string,
  estado: string,
  vence: string,
  tipo = 'vivienda',
): ReservaDelTablero => ({
  id,
  numero: Number(id.slice(1)),
  estado,
  tipo,
  vence: d(vence),
  senaImporte: new Prisma.Decimal(500),
  senaMoneda: 'USD',
  propiedad: { direccion: 'Mitre 100', unidad: '2° A' },
  partes: [{ persona: { nombre: 'Ana Interesada' } }],
});

const RESERVAS = [
  reserva('r1', 'reservada', '2026-10-10'), // vencida hace 5 días, sigue abierta
  reserva('r2', 'en_estudio', '2026-10-15'), // vence hoy
  reserva('r3', 'aprobada', '2026-10-22'), // vence en 7: entra
  reserva('r4', 'aprobada', '2026-10-23', 'comercial'), // vence en 8: no entra; aprobada sí
  reserva('r5', 'reservada', '2026-11-30'),
];

describe('Dashboard: las reservas en «Lo que hay que hacer» (regla 166)', () => {
  it('las que vencen en 7 días o ya vencieron, con cuántos días y abriendo la reserva', () => {
    const { reservasPorVencer } = tareasDeReservas(RESERVAS, HOY, 'todos');
    expect(reservasPorVencer.valor).toBe(3);
    expect(reservasPorVencer.filas.map((f) => [f.detalle, f.dias, f.estado, f.href])).toEqual([
      ['Reserva 1', -5, 'Vencida hace 5 días', '/alquileres/reservas/r1'],
      ['Reserva 2', 0, 'Vence hoy', '/alquileres/reservas/r2'],
      ['Reserva 3', 7, 'Aprobada', '/alquileres/reservas/r3'],
    ]);
    expect(reservasPorVencer.filas[0]).toMatchObject({
      propiedad: 'Mitre 100 2° A',
      inquilino: 'Ana Interesada',
      importe: 500,
      moneda: 'USD',
      vence: '2026-10-10',
    });
  });

  it('las aprobadas sin contrato, vengan o no', () => {
    const { reservasAprobadas } = tareasDeReservas(RESERVAS, HOY, 'todos');
    expect(reservasAprobadas.filas.map((f) => f.id)).toEqual(['r3', 'r4']);
    expect(reservasAprobadas.valor).toBe(2);
  });

  it('siguen al filtro Particulares / Comerciales por el tipo de la reserva', () => {
    const comerciales = tareasDeReservas(RESERVAS, HOY, 'comercial');
    expect(comerciales.reservasAprobadas.filas.map((f) => f.id)).toEqual(['r4']);
    expect(comerciales.reservasPorVencer.valor).toBe(0);
    const particulares = tareasDeReservas(RESERVAS, HOY, 'vivienda');
    expect(particulares.reservasAprobadas.filas.map((f) => f.id)).toEqual(['r3']);
  });

  it('sin reservas, las dos en cero', () => {
    expect(tareasDeReservas([], HOY, 'todos')).toEqual({
      reservasPorVencer: { valor: 0, filas: [] },
      reservasAprobadas: { valor: 0, filas: [] },
    });
  });
});
