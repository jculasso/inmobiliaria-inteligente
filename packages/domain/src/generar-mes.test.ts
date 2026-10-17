import { describe, expect, it } from 'vitest';
import { generarPeriodo, type ContratoParaGenerar } from './alquileres';
import { alquileresDelMes } from './generar-mes';
import { generarPeriodoConParciales, type EsperaDeIndice } from './liquidacion-final';

/*
 * Regla 181: el Dashboard avisa qué contratos tienen el alquiler del mes sin
 * generar. La fuente de verdad es la generación: lo que dice
 * `alquileresDelMes` tiene que ser exactamente lo que crea
 * `generarPeriodoConParciales`, que es lo que usa «Generar el período».
 */

const contrato = (over: Partial<ContratoParaGenerar> = {}): ContratoParaGenerar => ({
  id: 'c1',
  moneda: 'ARS',
  inicio: '2026-04-15',
  fin: '2028-04-14',
  rescindidoEl: null,
  diaVencimiento: 5,
  diaPagoPropietario: 10,
  honorariosPct: 8,
  gastosAdmPct: 2,
  ivaPct: 0,
  tramos: [
    { numero: 1, desde: '2026-04-15', hasta: '2026-10-14', importe: 800_000 },
    { numero: 2, desde: '2026-10-15', hasta: '2027-04-14', importe: 900_000 },
    { numero: 3, desde: '2027-04-15', hasta: '2028-04-14', importe: null },
  ],
  propietarios: [{ personaId: 'dueno', porcentaje: 100 }],
  inquilinos: [{ personaId: 'inq' }],
  ...over,
});

/** Las claves de los alquileres del inquilino que crea la generación, con todas las esperas. */
function lasDeGenerar(c: ContratoParaGenerar, periodo: string) {
  const esperas = new Map<number, EsperaDeIndice>(
    c.tramos
      .filter((t) => t.importe == null)
      .map((t) => [t.numero, { importeProvisorio: 1, espera: 'el índice' }]),
  );
  return generarPeriodoConParciales(c, periodo, 21, esperas)
    .conceptos.filter((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')
    .map((k) => k.clave);
}

describe('alquileresDelMes (regla 181)', () => {
  it('regla 181: un mes que cambia de tramo son dos alquileres, con las claves de la generación', () => {
    const c = contrato();
    const r = alquileresDelMes(c, '2026-10');
    expect(r.map((x) => x.clave)).toEqual(
      generarPeriodo(c, '2026-10', 21)
        .conceptos.filter((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')
        .map((k) => k.clave),
    );
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.listo)).toBe(true);
  });

  it('regla 181: un tramo sin importe falta generarlo igual, pero no está listo', () => {
    const c = contrato();
    const r = alquileresDelMes(c, '2027-04');
    expect(r.map((x) => x.listo)).toEqual([true, false]);
    // La clave de la parte sin importe es la que guarda la generación como parcial.
    expect(r.map((x) => x.clave)).toEqual(lasDeGenerar(c, '2027-04'));
  });

  it('regla 181: respeta «administrado desde» (regla 104): antes no hay alquiler', () => {
    const c = contrato({ administradoDesde: '2026-11-10' });
    expect(alquileresDelMes(c, '2026-10')).toEqual([]);
    expect(alquileresDelMes(c, '2026-11').map((x) => x.clave)).toEqual(lasDeGenerar(c, '2026-11'));
    expect(alquileresDelMes(c, '2026-11')).toHaveLength(1);
  });

  it('regla 181: respeta la rescisión (regla 3): el mes de la rescisión sí, el siguiente no', () => {
    const c = contrato({ rescindidoEl: '2026-10-20' });
    expect(alquileresDelMes(c, '2026-10')).toHaveLength(2);
    expect(alquileresDelMes(c, '2026-11')).toEqual([]);
  });

  it('regla 181: sin inquilino o sin propietario, la generación no crea nada y la tarea tampoco', () => {
    expect(alquileresDelMes(contrato({ inquilinos: [] }), '2026-10')).toEqual([]);
    expect(alquileresDelMes(contrato({ propietarios: [] }), '2026-10')).toEqual([]);
  });

  it('regla 181: un contrato que todavía no empezó o que ya terminó no tiene alquiler ese mes', () => {
    expect(alquileresDelMes(contrato(), '2026-03')).toEqual([]);
    expect(alquileresDelMes(contrato(), '2028-05')).toEqual([]);
  });

  it('regla 181: en cada mes de la vida del contrato dice lo mismo que la generación', () => {
    const c = contrato({ administradoDesde: '2026-06-20', rescindidoEl: '2027-09-03' });
    for (let i = 0; i < 30; i++) {
      const total = 2026 * 12 + 2 + i;
      const periodo = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
      expect(
        alquileresDelMes(c, periodo).map((x) => x.clave),
        periodo,
      ).toEqual(lasDeGenerar(c, periodo));
    }
  });
});
