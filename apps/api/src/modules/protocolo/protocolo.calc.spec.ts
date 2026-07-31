import { describe, expect, it } from 'vitest';
import {
  avance,
  avanceSemana,
  calcularAlertas,
  calcularEmbudo,
  diasEntre,
  diasPublicada,
  estaAtrasada,
  fechaEnPalabras,
  fechaPrevistaDeSemana,
  prioridad,
  semanaActual,
  sumarDias,
  type AccionCalc,
} from './protocolo.calc';

const INICIO = '2026-07-01';

function accion(over: Partial<AccionCalc> = {}): AccionCalc {
  return { semana: 1, estado: 'pendiente', fechaPrevista: null, ...over };
}

describe('fechas', () => {
  it('cuenta días entre fechas, con signo', () => {
    expect(diasEntre('2026-07-01', '2026-07-08')).toBe(7);
    expect(diasEntre('2026-07-08', '2026-07-01')).toBe(-7);
    expect(diasEntre('2026-07-01', '2026-07-01')).toBe(0);
  });

  it('suma días cruzando fin de mes', () => {
    expect(sumarDias('2026-07-30', 3)).toBe('2026-08-02');
  });

  it('cruza el cambio de año', () => {
    expect(sumarDias('2026-12-30', 5)).toBe('2027-01-04');
    expect(diasEntre('2026-12-30', '2027-01-04')).toBe(5);
  });
});

describe('semanaActual', () => {
  it('el día de inicio es la semana 1', () => {
    expect(semanaActual(INICIO, INICIO)).toBe(1);
  });

  it('el día 7 sigue en la semana 1 y el 8 pasa a la 2', () => {
    expect(semanaActual(INICIO, '2026-07-07')).toBe(1);
    expect(semanaActual(INICIO, '2026-07-08')).toBe(2);
  });

  it('se planta en la semana 5 aunque pasen meses', () => {
    expect(semanaActual(INICIO, '2026-08-04')).toBe(5);
    expect(semanaActual(INICIO, '2026-12-31')).toBe(5);
  });

  it('una fecha de inicio futura no da semana 0', () => {
    expect(semanaActual('2026-08-01', INICIO)).toBe(1);
  });
});

describe('diasPublicada', () => {
  it('cuenta el día de inicio como día 1', () => {
    expect(diasPublicada(INICIO, INICIO)).toBe(1);
    expect(diasPublicada(INICIO, '2026-07-10')).toBe(10);
  });
});

describe('fechaPrevistaDeSemana', () => {
  it('vence el último día de cada semana', () => {
    expect(fechaPrevistaDeSemana(INICIO, 1)).toBe('2026-07-07');
    expect(fechaPrevistaDeSemana(INICIO, 5)).toBe('2026-08-04');
  });
});

describe('avance', () => {
  it('ignora las acciones que no corresponden', () => {
    const acciones = [
      accion({ estado: 'realizada' }),
      accion({ estado: 'pendiente' }),
      accion({ estado: 'no_corresponde' }),
    ];
    expect(avance(acciones)).toBe(0.5);
  });

  it('es 0 si todas no corresponden (y no divide por cero)', () => {
    expect(avance([accion({ estado: 'no_corresponde' })])).toBe(0);
  });

  it('una semana sin acciones aplicables cuenta como completa', () => {
    expect(avanceSemana([accion({ semana: 1, estado: 'no_corresponde' })], 1)).toBe(1);
  });
});

describe('estaAtrasada', () => {
  it('marca atrasada la pendiente que ya venció', () => {
    expect(estaAtrasada(accion({ fechaPrevista: '2026-07-01' }), '2026-07-02')).toBe(true);
  });

  it('no marca atrasada la que vence hoy', () => {
    expect(estaAtrasada(accion({ fechaPrevista: '2026-07-02' }), '2026-07-02')).toBe(false);
  });

  it('nunca marca atrasada una realizada ni una que no corresponde', () => {
    const vencida = { fechaPrevista: '2026-07-01' };
    expect(estaAtrasada(accion({ ...vencida, estado: 'realizada' }), '2026-07-30')).toBe(false);
    expect(estaAtrasada(accion({ ...vencida, estado: 'no_corresponde' }), '2026-07-30')).toBe(false);
  });
});

describe('calcularEmbudo', () => {
  it('calcula las conversiones', () => {
    const e = calcularEmbudo({
      consultas: 20,
      consultasCalificadas: 8,
      visitas: 5,
      interesadosActivos: 2,
      ofertas: 1,
    });
    expect(e.conversionVisita).toBe(0.25);
    expect(e.conversionOferta).toBe(0.2);
  });

  it('no divide por cero cuando no hay consultas ni visitas', () => {
    const e = calcularEmbudo({
      consultas: 0,
      consultasCalificadas: 0,
      visitas: 0,
      interesadosActivos: 0,
      ofertas: 0,
    });
    expect(e.conversionVisita).toBe(0);
    expect(e.conversionOferta).toBe(0);
  });
});

describe('calcularAlertas', () => {
  const base = {
    estado: 'activa' as const,
    fechaInicio: INICIO,
    vencimientoAutorizacion: null,
    actualizadoEn: null,
    acciones: [] as AccionCalc[],
    consultas: 5,
    visitas: 2,
  };

  it('una propiedad archivada no alerta', () => {
    const alertas = calcularAlertas(
      { ...base, estado: 'archivada', acciones: [accion({ fechaPrevista: '2026-01-01' })] },
      '2026-07-10',
    );
    expect(alertas).toEqual([]);
  });

  it('alerta en rojo por acciones atrasadas', () => {
    const alertas = calcularAlertas(
      { ...base, acciones: [accion({ fechaPrevista: '2026-07-07' })] },
      '2026-07-10',
    );
    expect(alertas.some((a) => a.nivel === 'roja' && a.titulo === '1 acción atrasada')).toBe(true);
  });

  it('avisa de las que vencen hoy', () => {
    const alertas = calcularAlertas(
      { ...base, acciones: [accion({ fechaPrevista: '2026-07-10' })] },
      '2026-07-10',
    );
    expect(alertas.some((a) => a.titulo === '1 acción vence hoy')).toBe(true);
  });

  it('distingue autorización por vencer de vencida', () => {
    const porVencer = calcularAlertas(
      { ...base, vencimientoAutorizacion: '2026-07-15' },
      '2026-07-10',
    );
    expect(porVencer.some((a) => a.nivel === 'ambar' && a.titulo === 'Autorización por vencer')).toBe(true);

    const vencida = calcularAlertas({ ...base, vencimientoAutorizacion: '2026-07-05' }, '2026-07-10');
    expect(vencida.some((a) => a.nivel === 'roja' && a.titulo === 'Autorización vencida')).toBe(true);
  });

  it('no alerta si la autorización vence a más de 10 días', () => {
    const alertas = calcularAlertas({ ...base, vencimientoAutorizacion: '2026-08-30' }, '2026-07-10');
    expect(alertas.some((a) => a.titulo.startsWith('Autorización'))).toBe(false);
  });

  /**
   * Antes esto lo cubría una alerta aparte, 'Semana anterior incompleta', que
   * SIEMPRE decía lo mismo que 'N acciones atrasadas' y con otro color. Se
   * eliminó: repetir el mismo hecho dos veces le resta autoridad a los dos
   * avisos. Lo que sí se corrigió es el hueco que dejaba — una acción sin
   * fecha prevista de una semana ya pasada no contaba como atrasada.
   */
  it('cuenta como atrasada la acción de una semana pasada aunque no tenga fecha', () => {
    // 2026-07-10 → semana 2; la acción es de la semana 1 y sigue pendiente.
    const alertas = calcularAlertas(
      { ...base, acciones: [accion({ semana: 1, fechaPrevista: null })] },
      '2026-07-10',
    );
    expect(alertas.some((a) => a.nivel === 'roja' && a.titulo === '1 acción atrasada')).toBe(true);
    expect(alertas.some((a) => a.titulo === 'Semana anterior incompleta')).toBe(false);
  });

  it('avisa por inactividad de 7 días o más', () => {
    const alertas = calcularAlertas({ ...base, actualizadoEn: '2026-07-01' }, '2026-07-10');
    expect(alertas.some((a) => a.titulo === 'Sin movimiento hace más de una semana')).toBe(true);
  });

  it('en la semana 5 reclama los resultados comerciales si están en cero', () => {
    const alertas = calcularAlertas(
      { ...base, consultas: 0, visitas: 0 },
      '2026-08-01', // semana 5
    );
    expect(alertas.some((a) => a.titulo === 'Faltan los resultados comerciales')).toBe(true);
  });

  it('confirma en verde cuando la semana 5 está completa', () => {
    const alertas = calcularAlertas(
      { ...base, acciones: [accion({ semana: 5, estado: 'realizada' })] },
      '2026-08-01',
    );
    expect(alertas.some((a) => a.nivel === 'verde' && a.titulo === 'Protocolo listo para cierre')).toBe(true);
  });
});

describe('a qué semana lleva cada alerta', () => {
  const base = {
    estado: 'activa' as const,
    fechaInicio: INICIO,
    vencimientoAutorizacion: null,
    actualizadoEn: null,
    acciones: [] as AccionCalc[],
    consultas: 5,
    visitas: 2,
  };

  it('el atraso apunta a la semana más vieja sin cerrar', () => {
    const alertas = calcularAlertas(
      {
        ...base,
        acciones: [
          accion({ semana: 3, fechaPrevista: '2026-07-21' }),
          accion({ semana: 1, fechaPrevista: '2026-07-07' }),
        ],
      },
      '2026-07-25',
    );
    const atraso = alertas.find((a) => a.titulo.includes('atrasadas'));
    expect(atraso?.semana).toBe(1);
  });

  it('lo que no se resuelve en una semana puntual no apunta a ninguna', () => {
    const alertas = calcularAlertas({ ...base, vencimientoAutorizacion: '2026-07-28' }, '2026-07-25');
    expect(alertas.find((a) => a.titulo === 'Autorización por vencer')?.semana).toBeNull();
  });
});

describe('prioridad', () => {
  it('el rojo manda sobre el ámbar y el verde', () => {
    expect(
      prioridad([
        { nivel: 'verde', titulo: '', detalle: '', semana: null },
        { nivel: 'ambar', titulo: '', detalle: '', semana: null },
        { nivel: 'roja', titulo: '', detalle: '', semana: null },
      ]),
    ).toBe('roja');
  });

  it('sin alertas, está al día', () => {
    expect(prioridad([])).toBe('verde');
  });
});

describe('fechaEnPalabras', () => {
  // Los mensajes mostraban la fecha ISO cruda ("Venció el 2026-07-20"), que en
  // un informe para la dirección se lee como un dato de sistema.
  it('escribe la fecha como la diría una persona', () => {
    expect(fechaEnPalabras('2026-07-20', '2026-07-30')).toBe('20 de julio');
    expect(fechaEnPalabras('2026-01-05', '2026-07-30')).toBe('5 de enero');
  });

  // El año solo cuando aporta: en un reporte semanal "de 2026" sobra, pero una
  // autorización vencida el año pasado necesita decirlo.
  it('agrega el año solo si no es el corriente', () => {
    expect(fechaEnPalabras('2025-11-02', '2026-07-30')).toBe('2 de noviembre de 2025');
  });
});
