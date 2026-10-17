import { describe, expect, it } from 'vitest';
import {
  TableroAlquileresDtoSchema,
  type CicloDelMes,
  type FilaTablero,
  type Indicador,
} from '@vacker/types';
import { filasDeCobranza, resumenDeCobranza } from './cobranza-del-mes';
import { fmtSinCentavos, fmtTarjeta, totalesPorMoneda } from './formatos';
import { carriles, hitosDelCiclo } from './linea-del-mes';
import { gruposDeTareas, partirPorHoy } from './tareas';

const HOY = '2026-10-20';
const AYER = '2026-10-19';
const MANANA = '2026-10-21';

const fila = (id: string, over: Partial<FilaTablero> = {}): FilaTablero => ({
  id,
  href: null,
  contrato: id,
  persona: null,
  detalle: '',
  fecha: null,
  importe: null,
  propiedad: null,
  inquilino: null,
  propietario: null,
  moneda: null,
  alquiler: null,
  indexa: null,
  vence: null,
  dias: null,
  estado: null,
  ...over,
});
const ind = (filas: FilaTablero[]): Indicador => ({ valor: filas.length, filas });

/** Una fila por cada borde: ayer, hoy y mañana, más una lejos de cada lado. */
const bordes = (campo: 'fecha' | 'vence', prefijo: string) =>
  ind(
    ['2026-09-01', AYER, HOY, MANANA, '2026-12-01'].map((d, i) =>
      fila(`${prefijo}${i}`, { [campo]: d }),
    ),
  );

const tablero = () =>
  TableroAlquileresDtoSchema.parse({
    hoy: HOY,
    mes: '2026-10',
    cartera: { vigentes: ind([]), vivienda: 0, comercial: 0, alquilerMensual: [] },
    cobranza: [],
    morosidad: [],
    evolucion: [],
    ingresos: [],
    tareas: {
      indexacionesVencidas: ind([]),
      indexacionesProximas: ind([]),
      vencen: [
        { dias: 30, indicador: bordes('vence', 'c') },
        { dias: 60, indicador: ind([fila('r60', { vence: '2026-12-01' })]) },
        { dias: 90, indicador: ind([fila('r90', { vence: '2027-01-10' })]) },
      ],
      depositos: ind([]),
      liquidaciones: ind([]),
      deudores: ind([]),
      boletas: bordes('fecha', 'b'),
      polizas: bordes('fecha', 'p'),
      reservasPorVencer: bordes('fecha', 'r'),
    },
  });

describe('regla 179: las tareas que juntaban vencidas y por vencer, partidas por hoy', () => {
  it('regla 179: lo anterior a hoy está atrasado; hoy y mañana, por vencer', () => {
    const [atrasadas, porVencer] = partirPorHoy(bordes('fecha', 'x'), HOY);
    expect(atrasadas.filas.map((f) => f.fecha)).toEqual(['2026-09-01', AYER]);
    expect(porVencer.filas.map((f) => f.fecha)).toEqual([HOY, MANANA, '2026-12-01']);
    expect([atrasadas.valor, porVencer.valor]).toEqual([2, 3]);
  });

  it('regla 179: las partes suman exactamente la tarea original: ninguna fila se pierde ni se repite', () => {
    const t = tablero();
    const tareas = gruposDeTareas(t).flatMap((g) =>
      g.tareas.map((x) => ({ ...x, grupo: g.clave })),
    );
    const filasDe = (...titulos: string[]) =>
      tareas.filter((x) => titulos.includes(x.titulo)).flatMap((x) => x.ind.filas.map((f) => f.id));
    const partes: [string[], Indicador][] = [
      [
        ['Boletas vencidas que paga la inmobiliaria', 'Boletas que vencen en 7 días'],
        t.tareas.boletas,
      ],
      [['Pólizas vencidas', 'Pólizas que vencen en 60 días'], t.tareas.polizas],
      [['Reservas vencidas', 'Reservas que vencen en 7 días'], t.tareas.reservasPorVencer],
      [
        [
          'Contratos con el plazo cumplido, sin renovar ni terminar',
          'Contratos que vencen en 30 días',
        ],
        t.tareas.vencen[0]!.indicador,
      ],
    ];
    for (const [titulos, original] of partes) {
      const ids = filasDe(...titulos);
      expect(ids.sort(), titulos[0]).toEqual(original.filas.map((f) => f.id).sort());
      expect(new Set(ids).size, titulos[0]).toBe(ids.length);
    }
    // Y cada parte va en su grupo.
    const grupoDe = (titulo: string) => tareas.find((x) => x.titulo === titulo)!.grupo;
    expect(grupoDe('Boletas vencidas que paga la inmobiliaria')).toBe('atrasado');
    expect(grupoDe('Boletas que vencen en 7 días')).toBe('porVencer');
    expect(grupoDe('Contratos con el plazo cumplido, sin renovar ni terminar')).toBe('atrasado');
  });

  it('regla 179: renovaciones juntan las franjas de 31 a 60 y de 61 a 90 días', () => {
    const renovaciones = gruposDeTareas(tablero())
      .flatMap((g) => g.tareas)
      .find((x) => x.titulo === 'Renovaciones: contratos que vencen en 31 a 90 días')!;
    expect(renovaciones.ind.filas.map((f) => f.id)).toEqual(['r60', 'r90']);
    expect(renovaciones.ind.valor).toBe(2);
  });

  it('regla 181: sin el aviso del mes siguiente, su tarea no existe; con él, va última en «Por vencer»', () => {
    const sin = gruposDeTareas(tablero()).flatMap((g) => g.tareas.map((x) => x.titulo));
    expect(sin.filter((x) => x.startsWith('Generar'))).toEqual([
      'Generar los alquileres de octubre',
    ]);
    const ciclo: CicloDelMes = {
      mes: '2026-10',
      vencimiento: { dia: 5, fecha: '2026-10-05', motivo: null },
      pagoPropietarios: { dia: 10, fecha: '2026-10-13', motivo: null },
      generarSiguiente: { dia: 20, fecha: HOY, motivo: null, mes: '2026-11' },
    };
    const t = tablero();
    const con = gruposDeTareas({
      ...t,
      ciclo,
      tareas: { ...t.tareas, generarSiguiente: ind([fila('c1')]) },
    });
    expect(con.find((g) => g.clave === 'porVencer')!.tareas.at(-1)!.titulo).toBe(
      'Generar los alquileres de noviembre',
    );
  });
});

describe('regla 178: las etiquetas de la línea del mes no se pisan', () => {
  const ciclo = (vence: string, pago: string, aviso: string): CicloDelMes => ({
    mes: '2026-10',
    vencimiento: { dia: 5, fecha: vence, motivo: null },
    pagoPropietarios: { dia: 10, fecha: pago, motivo: 'el 10 fue sábado y el 12 feriado' },
    generarSiguiente: { dia: 25, fecha: aviso, motivo: null, mes: '2026-11' },
  });

  it('regla 178: octubre de 2026 como en la maqueta: el vencimiento y hoy arriba, el pago abajo', () => {
    const h = carriles(
      hitosDelCiclo(ciclo('2026-10-05', '2026-10-13', '2026-10-26'), '2026-10-15'),
    );
    expect(Object.fromEntries(h.map((x) => [x.clave, x.carril]))).toEqual({
      vence: 'arriba',
      pago: 'abajo',
      generar: 'arriba',
      hoy: 'arriba',
    });
    // Pasada la mitad, la etiqueta termina en el punto: no se sale de la línea.
    expect(h.find((x) => x.clave === 'generar')!.alFinal).toBe(true);
  });

  it('regla 178: hoy pegado al vencimiento no se le encima: va a otro renglón', () => {
    for (const hoy of ['2026-10-05', '2026-10-06', '2026-10-08']) {
      const h = carriles(hitosDelCiclo(ciclo('2026-10-05', '2026-10-13', '2026-10-26'), hoy));
      const de = (clave: string) => h.find((x) => x.clave === clave)!.carril;
      expect(de('hoy'), hoy).not.toBe(de('vence'));
    }
  });

  it('regla 178: el vencimiento y el aviso cerca uno del otro van en renglones distintos', () => {
    const h = carriles(
      hitosDelCiclo(ciclo('2026-10-05', '2026-10-13', '2026-10-06'), '2026-10-20'),
    );
    const de = (clave: string) => h.find((x) => x.clave === clave)!.carril;
    expect(de('generar')).not.toBe(de('vence'));
  });
});

describe('regla 184: los importes de las tarjetas', () => {
  it('regla 184: desde un millón, en millones con un decimal; debajo, sin centavos', () => {
    expect(fmtTarjeta(62_400_000)).toBe('$ 62,4 M');
    expect(fmtTarjeta(1_000_000)).toBe('$ 1,0 M');
    expect(fmtTarjeta(1_928_307.62)).toBe('$ 1,9 M');
    expect(fmtTarjeta(999_999)).toBe('$ 999.999');
    expect(fmtTarjeta(412_300.4)).toBe('$ 412.300');
    expect(fmtTarjeta(0)).toBe('$ 0');
  });

  it('regla 184: en dólares, «U$S»', () => {
    expect(fmtTarjeta(1_409.25, 'USD')).toBe('U$S 1.409');
    expect(fmtSinCentavos(1_204_500.4)).toBe('$ 1.204.500');
  });
});

describe('regla 187: la lista de la cobranza del mes, armada con lo que viaja con el tablero', () => {
  const alquiler = (id: string, importe: number, fecha: string, over: Partial<FilaTablero> = {}) =>
    fila(id, { importe, fecha, inquilino: `Inquilino ${id}`, moneda: 'ARS', ...over });
  // Como las manda la API: por vencimiento. Lo cobrado, solo de los que pagaron algo.
  const emitidos = [
    alquiler('parcial', 400_000, '2026-10-01', { estado: 'Pagó $ 150.000,00, falta $ 250.000,00' }),
    alquiler('pagado', 1_000_000, '2026-10-01', { estado: 'Cobrado' }),
    alquiler('debe5', 300_000, '2026-10-05', { estado: 'Vencido hace 15 días' }),
    alquiler('debe10', 500_000, '2026-10-10', { estado: 'Vencido hace 10 días' }),
    // Pagó de más: lo que falta no puede quedar negativo.
    alquiler('demas', 200_000, '2026-10-03', { estado: 'Cobrado' }),
  ];
  const cobrados = [
    alquiler('parcial', 150_000, '2026-10-01'),
    alquiler('pagado', 1_000_000, '2026-10-01'),
    alquiler('demas', 250_000, '2026-10-03'),
  ];
  const cobranza = [
    {
      moneda: 'ARS' as const,
      emitidos: ind(emitidos),
      cobrados: ind([emitidos[1]!, emitidos[4]!]),
      importeEmitido: { valor: 2_400_000, filas: emitidos },
      importeCobrado: { valor: 1_400_000, filas: cobrados },
    },
    {
      moneda: 'USD' as const,
      emitidos: ind([alquiler('usd', 1_500, '2026-10-05', { moneda: 'USD' })]),
      cobrados: ind([]),
      importeEmitido: {
        valor: 1_500,
        filas: [alquiler('usd', 1_500, '2026-10-05', { moneda: 'USD' })],
      },
      importeCobrado: {
        valor: 500,
        filas: [alquiler('usd', 500, '2026-10-05', { moneda: 'USD' })],
      },
    },
  ];

  it('regla 187: une por id el alquiler con lo cobrado; lo que falta nunca es negativo', () => {
    const filas = filasDeCobranza(cobranza);
    const de = (id: string) => filas.find((f) => f.id === id)!;
    expect([de('parcial').importe, de('parcial').cobrado, de('parcial').falta]).toEqual([
      400_000, 150_000, 250_000,
    ]);
    expect([de('debe10').cobrado, de('debe10').falta]).toEqual([0, 500_000]);
    expect(de('demas').falta).toBe(0);
    expect(de('usd').moneda).toBe('USD');
    // El pago parcial lo dicen sus columnas; el resto conserva el estado de la API.
    expect(de('parcial').estado).toBe('Pago parcial');
    expect(de('debe5').estado).toBe('Vencido hace 15 días');
  });

  it('regla 187: primero los que no pagaron nada, por vencimiento; después los parciales; al final los pagados', () => {
    expect(filasDeCobranza(cobranza).map((f) => f.id)).toEqual([
      'debe5',
      'debe10',
      'parcial',
      'usd',
      'pagado',
      'demas',
    ]);
  });

  it('regla 187: los totales por moneda son los de la tarjeta, y el resumen los dice exactos', () => {
    const filas = filasDeCobranza(cobranza);
    expect(totalesPorMoneda(filas, 'ARS')).toEqual({ ARS: 2_400_000, USD: 1_500 });
    expect(totalesPorMoneda(filas, 'ARS', 'cobrado')).toEqual({ ARS: 1_400_000, USD: 500 });
    // Lo que falta suma por fila: el que pagó de más no le resta a otro.
    expect(totalesPorMoneda(filas, 'ARS', 'falta')).toEqual({ ARS: 1_050_000, USD: 1_000 });
    expect(resumenDeCobranza(filas)).toBe(
      'Cobrado $ 1.400.000,00 de $ 2.400.000,00 (58%) · 3 sin pagar — En dólares: U$S 500,00 de U$S 1.500,00 (33%) · 1 sin pagar',
    );
  });
});
