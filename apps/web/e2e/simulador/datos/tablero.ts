import type { z } from 'zod';
import type {
  FiltroTipoContrato,
  FilaTableroSchema,
  IndicadorSchema,
  TableroAlquileresDtoSchema,
} from '@vacker/types';
import { HOY, IDS } from './comunes';

type Fila = z.input<typeof FilaTableroSchema>;
type Indicador = z.input<typeof IndicadorSchema>;
type Tablero = z.input<typeof TableroAlquileresDtoSchema>;

const ANIO = Number(HOY.slice(0, 4));
const MES_ACTUAL = Number(HOY.slice(5, 7));
const mes = (m: number) => `${ANIO}-${String(m).padStart(2, '0')}`;
/** El último día de un mes del año del tablero. */
const finDeMes = (m: number) => new Date(Date.UTC(ANIO, m, 0)).toISOString().slice(0, 10);

const CONTRATOS = [
  {
    id: IDS.contrato,
    contrato: 'ALT-0001',
    propiedad: 'Belgrano 1234, 3° B',
    inquilino: 'Lucía Fernández',
    propietario: 'Carlos Gómez',
    alquiler: 850_000,
    moneda: 'ARS' as const,
  },
  {
    id: IDS.contrato2,
    contrato: 'ALT-0002',
    propiedad: 'Av. Colón 455, local 2',
    inquilino: 'Panadería El Trigal SRL',
    propietario: 'Carlos Gómez',
    alquiler: 1_200_000,
    moneda: 'ARS' as const,
  },
];

function fila(i: number, extra: Partial<Fila> = {}): Fila {
  const c = CONTRATOS[i % CONTRATOS.length]!;
  return {
    id: `${c.id}-${i}`,
    href: `/alquileres/contratos/${c.id}`,
    contrato: c.contrato,
    persona: c.inquilino,
    detalle: `Alquiler ${c.contrato}`,
    fecha: HOY,
    importe: c.alquiler,
    propiedad: c.propiedad,
    inquilino: c.inquilino,
    propietario: c.propietario,
    moneda: c.moneda,
    alquiler: c.alquiler,
    indexa: '2026-12-01',
    vence: '2028-03-31',
    dias: null,
    estado: null,
    ...extra,
  };
}

/** Un número y su lista: si es un importe, las filas lo suman (regla 26). */
function porImporte(filas: Fila[]): Indicador {
  return { valor: filas.reduce((s, f) => s + (f.importe ?? 0), 0), filas };
}
function porCantidad(filas: Fila[]): Indicador {
  return { valor: filas.length, filas };
}
const vacio: Indicador = { valor: 0, filas: [] };

/** La lista que devuelve `/alquileres/tablero/detalle` al abrir una tarjeta del período. */
export function detalleDelTablero(indicador: string): Indicador {
  const filas = [
    fila(0, { estado: 'Cobrado', detalle: `Alquiler — ${indicador}` }),
    fila(1, {
      estado: 'Pagó $ 600.000,00, falta $ 600.000,00',
      detalle: `Alquiler — ${indicador}`,
    }),
  ];
  return porImporte(filas);
}

function tablero(tipo: FiltroTipoContrato): Tablero {
  const meses = Array.from({ length: MES_ACTUAL }, (_, i) => i + 1);
  const vigentes = porCantidad([fila(0), fila(1)]);
  return {
    hoy: HOY,
    mes: mes(MES_ACTUAL),
    anio: ANIO,
    tipo,
    cartera: {
      vigentes,
      vivienda: 1,
      comercial: 1,
      alquilerMensual: [{ moneda: 'ARS', indicador: porImporte([fila(0), fila(1)]) }],
      porTipo: [
        { tipo: 'vivienda', cantidad: 1, importe: 850_000, pct: 41.5 },
        { tipo: 'comercial', cantidad: 1, importe: 1_200_000, pct: 58.5 },
      ],
    },
    nuevos: {
      porMes: Array.from({ length: 12 }, (_, i) =>
        i + 1 === 3 ? porCantidad([fila(0, { fecha: '2026-03-01', estado: 'Vigente' })]) : vacio,
      ),
      importePorMes: Array.from({ length: 12 }, (_, i) => (i + 1 === 3 ? 850_000 : 0)),
      anterior: Array.from({ length: 12 }, (_, i) => (i + 1 === 5 ? 700_000 : 0)),
    },
    cobranza: [
      {
        moneda: 'ARS',
        emitidos: porCantidad([fila(0), fila(1)]),
        cobrados: porCantidad([fila(0)]),
        importeEmitido: porImporte([fila(0), fila(1)]),
        importeCobrado: porImporte([fila(0)]),
      },
    ],
    morosidad: [
      {
        moneda: 'ARS',
        total: porImporte([fila(1, { importe: 600_000, dias: 40, detalle: 'Alquiler 2026-09' })]),
        tramos: [
          { tramo: '1-30', indicador: vacio },
          {
            tramo: '31-60',
            indicador: porImporte([
              fila(1, { importe: 600_000, dias: 40, detalle: 'Alquiler 2026-09' }),
            ]),
          },
          { tramo: '61-90', indicador: vacio },
          { tramo: '90+', indicador: vacio },
        ],
      },
    ],
    evolucion: meses.map((m) => ({
      mes: mes(m),
      moneda: 'ARS' as const,
      emitido: 2_050_000,
      cobrado: m === MES_ACTUAL ? 850_000 : m === 9 ? 1_450_000 : 2_050_000,
      emitidos: 2,
      cobrados: m === MES_ACTUAL || m === 9 ? 1 : 2,
      cobradoHoy: m === MES_ACTUAL ? 850_000 : m === 9 ? 1_450_000 : 2_050_000,
    })),
    // Regla 77: la foto al cierre de cada mes; el mes en curso, a hoy.
    cierres: meses.map((m) => ({
      mes: mes(m),
      cierre: m === MES_ACTUAL ? HOY : finDeMes(m),
      vigentes: 2,
      vivienda: 1,
      comercial: 1,
      alquilerMensual: [{ moneda: 'ARS' as const, valor: 2_050_000, contratos: 2 }],
      mora: [
        {
          moneda: 'ARS' as const,
          valor: m >= 9 ? 600_000 : 0,
          conceptos: m >= 9 ? 1 : 0,
          inquilinos: m >= 9 ? 1 : 0,
          tramos: [
            { tramo: '1-30' as const, valor: m === 9 ? 600_000 : 0, conceptos: m === 9 ? 1 : 0 },
            { tramo: '31-60' as const, valor: m > 9 ? 600_000 : 0, conceptos: m > 9 ? 1 : 0 },
            { tramo: '61-90' as const, valor: 0, conceptos: 0 },
            { tramo: '90+' as const, valor: 0, conceptos: 0 },
          ],
        },
      ],
    })),
    ingresos: meses.map((m) => ({
      mes: mes(m),
      moneda: 'ARS' as const,
      honorarios: 164_000,
      gastos: 41_000,
      punitorios: m === 9 ? 12_000 : 0,
      comisiones: 0,
    })),
    tareas: {
      indexacionesVencidas: vacio,
      indexacionesProximas: porCantidad([fila(0, { detalle: 'Tramo 3', fecha: '2026-12-01' })]),
      vencen: [
        { dias: 30, indicador: vacio },
        { dias: 60, indicador: vacio },
        { dias: 90, indicador: vacio },
      ],
      depositos: vacio,
      liquidaciones: porCantidad([fila(0, { persona: 'Carlos Gómez' })]),
      deudores: porCantidad([fila(1, { importe: 600_000, dias: 40 })]),
      indexacionesEsperan: porCantidad([
        fila(1, { detalle: 'Tramo 2 · espera el índice', fecha: '2026-10-01' }),
      ]),
    },
  };
}

export function tableros() {
  return {
    todos: tablero('todos'),
    vivienda: tablero('vivienda'),
    comercial: tablero('comercial'),
  };
}
