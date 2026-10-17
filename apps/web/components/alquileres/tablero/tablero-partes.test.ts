import { describe, expect, it } from 'vitest';
import {
  TableroAlquileresDtoSchema,
  type CicloDelMes,
  type FilaTablero,
  type Indicador,
} from '@vacker/types';
import { fmtSinCentavos, fmtTarjeta } from './formatos';
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
