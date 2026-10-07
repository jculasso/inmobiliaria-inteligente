import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  INDICADORES_DETALLE_TABLERO,
  type FiltroTipoContrato,
  type Indicador,
  type TableroAlquileresDto,
} from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { IndexacionesService } from './indexaciones.service';
import type { LiquidacionesService } from './liquidaciones.service';
import { TableroAlquileresService } from './tablero-alquileres.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const HOY = '2026-10-20';

function contrato(over: Record<string, unknown> = {}) {
  return {
    id: 'c5',
    codigo: '5',
    estado: 'vigente',
    tipo: 'vivienda',
    moneda: 'ARS',
    ajuste: 'indexado',
    inicio: d('2025-08-15'),
    fin: d('2027-08-14'),
    rescindidoEl: null,
    depositoImporte: null,
    depositoDevolucion: null,
    propiedad: { direccion: 'Calle 1', unidad: null },
    partes: [
      { personaId: 'inq5', papel: 'inquilino', persona: { nombre: 'Inquilina' } },
      { personaId: 'dueno', papel: 'propietario', persona: { nombre: 'Dueño' } },
    ],
    tramos: [
      { numero: 1, desde: d('2026-04-15'), importe: dec(1_043_387) },
      { numero: 2, desde: d('2026-08-15'), importe: dec(1_137_518) },
      { numero: 3, desde: d('2026-12-15'), importe: null },
    ],
    documentos: [] as { estadoFirma: string }[],
    ...over,
  };
}

/** Un alquiler del lado del inquilino, como lo lee `sqlAlquileres`. */
function alquiler(
  id: string,
  importe: number,
  cobrado: number,
  over: Record<string, unknown> & { periodo?: string; alCierre?: number } = {},
) {
  const { periodo = '2026-10', alCierre = cobrado, ...resto } = over;
  return {
    id,
    periodo,
    moneda: 'ARS',
    importe: dec(importe),
    vencimiento: d(`${periodo}-05`),
    descripcion: `Alquiler ${periodo}`,
    contrato_id: `c${id}`,
    tipo_contrato: 'vivienda',
    persona_id: `inq-${id}`,
    nombre: `Inquilino ${id}`,
    cobrado: dec(cobrado),
    cobrado_al_cierre: dec(alCierre),
    ...resto,
  };
}

const mora = (
  id: string,
  vencimiento: string,
  saldo: number,
  over: Record<string, unknown> = {},
) => ({
  cierre: HOY,
  id,
  moneda: 'ARS',
  vencimiento: d(vencimiento),
  descripcion: 'Alquiler',
  tipo: 'alquiler',
  saldo: dec(saldo),
  contrato_id: 'c5',
  codigo: '5',
  persona_id: 'inq5',
  nombre: 'Inquilina',
  tipo_contrato: 'vivienda',
  ...over,
});

/** Un movimiento de ingresos, como lo lee `sqlMovimientosIngresos`. */
const movimiento = (
  id: string,
  fecha: string,
  tipo: string,
  importe: number,
  over: Record<string, unknown> = {},
) => ({
  id,
  fecha: d(fecha),
  moneda: 'ARS',
  contrato_id: 'c5',
  tipo_contrato: 'vivienda',
  tipo,
  importe: dec(importe),
  descripcion: null,
  persona_id: 'dueno',
  nombre: 'Dueño',
  ...over,
});

/** Los valores interpolados de cada `$queryRaw`, por servicio creado. */
const rawCalls: unknown[][][] = [];
/** Cuántas consultas hizo el último servicio creado (regla 82). */
const consultas = { n: 0 };

type Fixture = {
  contratos?: ReturnType<typeof contrato>[];
  alquileres?: ReturnType<typeof alquiler>[];
  mora?: ReturnType<typeof mora>[];
  movimientos?: ReturnType<typeof movimiento>[];
};

/**
 * Una base de mentira que contesta cada consulta como lo haría la de verdad
 * con las filas del fixture: filtra por los meses o las fechas que se le
 * piden, y la de ingresos por mes agrupa como el `GROUP BY`. Así el tablero y
 * el detalle leen las mismas filas, como en producción.
 */
function servicio(over: Fixture = {}) {
  const valores: unknown[][] = [];
  rawCalls.push(valores);
  consultas.n = 0;
  const alquileres = over.alquileres ?? [
    alquiler('5', 1_137_518, 1_137_518),
    alquiler('6', 400_000, 150_000),
  ];
  const filasMora = over.mora ?? [
    mora('m1', '2026-10-05', 250_000),
    mora('m2', '2026-08-05', 100_000),
  ];
  const movimientos = over.movimientos ?? [
    movimiento('h1', '2026-10-10', 'honorarios', 110_111.74),
    movimiento('g1', '2026-10-06', 'gastos_adm', 27_527.94, {
      persona_id: 'inq5',
      nombre: 'Inquilina',
    }),
  ];
  const contratos = over.contratos ?? [contrato()];
  const iso = (x: unknown) => (x as Date).toISOString().slice(0, 10);
  const enRango = (v: unknown[]) => {
    const [desde, hasta] = v.filter((x) => x instanceof Date).map(iso);
    return movimientos.filter((m) => iso(m.fecha) >= desde! && iso(m.fecha) < hasta!);
  };
  const tx = {
    alqContrato: {
      findMany: vi.fn(async (a: { where?: { id?: { in?: string[] } } }) => {
        consultas.n++;
        const ids = a.where?.id?.in;
        return ids ? contratos.filter((c) => ids.includes(c.id)) : contratos;
      }),
    },
    alqReclamo: {
      findMany: vi.fn(async () => {
        consultas.n++;
        return [
          {
            id: 'r1',
            asunto: 'Pérdida de agua',
            prioridad: 'alta',
            contratoId: 'c5',
            createdAt: new Date('2026-10-10T12:00:00Z'),
          },
        ];
      }),
    },
    alqPoliza: {
      findMany: vi.fn(async () => {
        consultas.n++;
        return [
          {
            id: 'p1',
            contratoId: 'c5',
            aseguradora: 'Sancor',
            numero: '123',
            hasta: d('2026-11-30'),
            contrato: { codigo: '5', estado: 'vigente' },
          },
          {
            id: 'p2',
            contratoId: 'c9',
            aseguradora: 'Otra',
            numero: null,
            hasta: d('2026-10-01'),
            contrato: { codigo: '9', estado: 'finalizado' },
          },
        ];
      }),
    },
    alqBoleta: {
      findMany: vi.fn(async () => {
        consultas.n++;
        return [
          {
            id: 'b1',
            contratoId: 'c5',
            cuota: '3/6',
            vencimiento: d('2026-10-10'),
            importe: dec(45_000),
            cuenta: { servicio: { nombre: 'API' } },
            poliza: null,
          },
        ];
      }),
    },
    $queryRaw: vi.fn(async (q: Prisma.Sql) => {
      consultas.n++;
      valores.push(q.values);
      const texto = q.sql;
      if (texto.includes('unnest(')) {
        const cierres = q.values[0] as string[];
        return filasMora.filter((m) => cierres.includes(m.cierre));
      }
      if (texto.includes("k.tipo = 'alquiler'")) {
        const [desde, hasta, ademas] = q.values as string[];
        return alquileres.filter(
          (k) => (k.periodo >= desde! && k.periodo <= hasta!) || k.periodo === ademas,
        );
      }
      if (texto.includes('GROUP BY 1, 2, 3, 4')) {
        const juntos = new Map<string, Record<string, unknown> & { importe: Prisma.Decimal }>();
        for (const m of enRango(q.values)) {
          const fila = {
            mes: iso(m.fecha).slice(0, 7),
            moneda: m.moneda,
            tipo_contrato: m.tipo_contrato,
            tipo: m.tipo,
          };
          const clave = JSON.stringify(fila);
          const previo = juntos.get(clave);
          juntos.set(clave, {
            ...fila,
            importe: previo ? previo.importe.add(m.importe) : m.importe,
          });
        }
        return [...juntos.values()];
      }
      if (texto.includes('alq_liquidacion')) return enRango(q.values);
      throw new Error(`Consulta inesperada: ${texto.slice(0, 80)}`);
    }),
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  const indexaciones = {
    bandeja: vi.fn().mockResolvedValue({
      indices: [],
      tramos: [
        {
          tramoId: 't1',
          contrato: { id: 'c5', codigo: '5' },
          inquilinos: ['Inquilina'],
          numero: 5,
          indice: 'IPC',
          desde: '2026-10-15',
          estado: 'lista',
          importeAnterior: 1_137_518,
          importePropuesto: 1_200_000,
          falta: [],
          vencida: true,
        },
        {
          tramoId: 't2',
          contrato: { id: 'c7', codigo: '7' },
          inquilinos: [],
          numero: 3,
          indice: 'ICL',
          desde: '2026-11-01',
          estado: 'pendiente_indice',
          importeAnterior: 900_000,
          importePropuesto: null,
          falta: ['el ICL del 31/10/2026'],
          vencida: false,
        },
      ],
    }),
  } as unknown as IndexacionesService;
  const liquidaciones = {
    pendientes: vi.fn().mockResolvedValue([
      {
        persona: { id: 'dueno', nombre: 'Dueño' },
        moneda: 'ARS',
        neto: 1_027_406.26,
        enEspera: 0,
        contratos: [{ id: 'c5', codigo: '5', propiedad: 'Calle 1', inquilinos: [] }],
      },
      {
        persona: { id: 'otro', nombre: 'Otro' },
        moneda: 'ARS',
        neto: 0,
        enEspera: 430_375,
        contratos: [],
      },
    ]),
  } as unknown as LiquidacionesService;
  return new TableroAlquileresService(db, indexaciones, liquidaciones);
}

/** Todos los indicadores del tablero, con su nombre, para revisarlos de una. */
function indicadores(t: TableroAlquileresDto): [string, Indicador, 'importe' | 'cantidad'][] {
  return [
    ['vigentes', t.cartera.vigentes, 'cantidad'],
    ...t.cartera.alquilerMensual.map(
      (a) => [`alquiler ${a.moneda}`, a.indicador, 'importe'] as [string, Indicador, 'importe'],
    ),
    ...t.cobranza.flatMap(
      (c) =>
        [
          [`emitidos ${c.moneda}`, c.emitidos, 'cantidad'],
          [`cobrados ${c.moneda}`, c.cobrados, 'cantidad'],
          [`importe emitido ${c.moneda}`, c.importeEmitido, 'importe'],
          [`importe cobrado ${c.moneda}`, c.importeCobrado, 'importe'],
        ] as [string, Indicador, 'importe' | 'cantidad'][],
    ),
    ...t.morosidad.flatMap((m) => [
      [`mora ${m.moneda}`, m.total, 'importe'] as [string, Indicador, 'importe'],
      ...m.tramos.map(
        (x) => [`mora ${x.tramo}`, x.indicador, 'importe'] as [string, Indicador, 'importe'],
      ),
    ]),
    ['indexaciones vencidas', t.tareas.indexacionesVencidas, 'cantidad'],
    ['indexaciones próximas', t.tareas.indexacionesProximas, 'cantidad'],
    ...t.tareas.vencen.map(
      (v) => [`vencen ${v.dias}`, v.indicador, 'cantidad'] as [string, Indicador, 'cantidad'],
    ),
    ['depósitos', t.tareas.depositos, 'cantidad'],
    ['liquidaciones', t.tareas.liquidaciones, 'cantidad'],
    ['deudores', t.tareas.deudores, 'cantidad'],
    ['sin firmar', t.tareas.sinFirmar, 'cantidad'],
    ['reclamos', t.tareas.reclamos, 'cantidad'],
    ['polizas', t.tareas.polizas, 'cantidad'],
    ['boletas', t.tareas.boletas, 'cantidad'],
  ];
}

describe('TableroAlquileresService', () => {
  // Regla 26: cada número es exactamente lo que suma o cuenta su lista.
  it('cada número suma su lista', async () => {
    const t = await servicio().tablero(HOY);
    for (const [nombre, ind, tipo] of indicadores(t)) {
      const esperado =
        tipo === 'importe'
          ? Math.round(ind.filas.reduce((s, f) => s + (f.importe ?? 0), 0) * 100) / 100
          : ind.filas.length;
      expect(ind.valor, nombre).toBe(esperado);
    }
  });

  // Reglas 67 y 69: «Reclamos abiertos» son los abiertos y en curso, y cada uno dice «Prioridad alta».
  it('reglas 67 y 69: los reclamos abiertos, con la prioridad con su nombre', async () => {
    const t = await servicio().tablero(HOY);
    expect(t.tareas.reclamos.filas).toEqual([
      expect.objectContaining({ detalle: 'Pérdida de agua', estado: 'Prioridad alta' }),
    ]);
  });

  // Regla 27.
  it('cartera: el alquiler de hoy es el del último tramo indexado ya empezado', async () => {
    const t = await servicio().tablero(HOY);
    expect(t.cartera.alquilerMensual).toEqual([
      { moneda: 'ARS', indicador: expect.objectContaining({ valor: 1_137_518 }) },
    ]);
    expect(t.cartera).toMatchObject({ vivienda: 1, comercial: 0 });
  });

  // Regla 28: uno pagado en parte no cuenta como cobrado, pero suma lo pagado.
  it('cobranza: el pago parcial no cuenta en la cantidad y sí en el importe', async () => {
    const [c] = (await servicio().tablero(HOY)).cobranza;
    expect(c).toMatchObject({
      emitidos: { valor: 2 },
      cobrados: { valor: 1 },
      importeEmitido: { valor: 1_537_518 },
      importeCobrado: { valor: 1_287_518 },
    });
  });

  // Regla 29.
  it('morosidad por antigüedad desde el vencimiento', async () => {
    const [m] = (await servicio().tablero(HOY)).morosidad;
    expect(m!.total.valor).toBe(350_000);
    expect(m!.tramos.map((x) => [x.tramo, x.indicador.valor])).toEqual([
      ['1-30', 250_000],
      ['31-60', 0],
      ['61-90', 100_000],
      ['90+', 0],
    ]);
  });

  // Regla 31.
  it('lo que hay que hacer: indexaciones, vencimientos, depósitos, liquidaciones y deudores', async () => {
    const contratos = [
      contrato(),
      contrato({ id: 'c8', codigo: '8', fin: d('2026-11-10') }),
      contrato({ id: 'c9', codigo: '9', fin: d('2026-12-25') }),
      contrato({
        id: 'c3',
        codigo: '3',
        estado: 'finalizado',
        fin: d('2026-09-30'),
        depositoImporte: dec(500_000),
      }),
      contrato({
        id: 'c4',
        codigo: '4',
        estado: 'finalizado',
        fin: d('2026-08-31'),
        depositoImporte: dec(300_000),
        depositoDevolucion: d('2026-09-05'),
      }),
    ];
    const t = (await servicio({ contratos }).tablero(HOY)).tareas;
    expect([t.indexacionesVencidas.valor, t.indexacionesProximas.valor]).toEqual([1, 1]);
    expect(t.vencen.map((v) => [v.dias, v.indicador.filas.map((f) => f.contrato)])).toEqual([
      [30, ['8']],
      [60, []],
      [90, ['9']],
    ]);
    expect(t.depositos.filas.map((f) => [f.contrato, f.importe])).toEqual([['3', 500_000]]);
    expect(t.liquidaciones.filas.map((f) => f.persona)).toEqual(['Dueño']);
    // Solo la deuda de más de 30 días: la de agosto, no la de octubre.
    expect(t.deudores.filas.map((f) => [f.persona, f.importe])).toEqual([['Inquilina', 100_000]]);
  });

  // Regla 36.
  it('vigentes sin el contrato firmado cargado: a completar', async () => {
    const contratos = [
      contrato(),
      contrato({ id: 'c6', codigo: '6', documentos: [{ estadoFirma: 'firmado' }] }),
      contrato({ id: 'c7', codigo: '7', documentos: [{ estadoFirma: 'enviado' }] }),
      contrato({ id: 'c8', codigo: '8', estado: 'finalizado', fin: d('2026-09-30') }),
    ];
    const t = (await servicio({ contratos }).tablero(HOY)).tareas.sinFirmar;
    expect(t.filas.map((f) => [f.contrato, f.estado])).toEqual([
      ['5', 'Falta cargar el contrato firmado'],
      ['7', 'Falta completar la firma'],
    ]);
  });

  // Entrega 19.
  it('pólizas de los vigentes que vencen en 60 días y boletas que paga la inmobiliaria', async () => {
    const t = (await servicio().tablero(HOY)).tareas;
    expect(t.polizas.filas.map((f) => [f.contrato, f.detalle, f.fecha, f.estado, f.href])).toEqual([
      ['5', 'Sancor N° 123', '2026-11-30', 'Vence en 41 días', '/alquileres/contratos/c5'],
    ]);
    expect(t.boletas.filas.map((f) => [f.contrato, f.detalle, f.importe, f.estado])).toEqual([
      ['5', 'API · cuota 3 de 6', 45_000, 'Vencida hace 10 días'],
    ]);
    // Regla 45: lleva a la pestaña «Para pagar»; `?ver=control` ya no existe.
    expect(t.boletas.filas[0]!.href).toBe('/alquileres/impuestos?ver=pagar');
  });

  // Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente, cuando indexa, cuando vence».
  it('cada contrato del detalle trae partes, alquiler de hoy, próxima indexación y vencimiento', async () => {
    const [f] = (await servicio().tablero(HOY)).cartera.vigentes.filas;
    expect(f).toMatchObject({
      contrato: '5',
      propiedad: 'Calle 1',
      inquilino: 'Inquilina',
      propietario: 'Dueño',
      moneda: 'ARS',
      alquiler: 1_137_518,
      indexa: '2026-12-15',
      vence: '2027-08-14',
    });
  });

  it('lo que no es un contrato (un alquiler del mes, una deuda) trae igual los datos de su contrato', async () => {
    const t = await servicio().tablero(HOY);
    expect(t.morosidad[0]!.total.filas[0]).toMatchObject({
      contrato: '5',
      propietario: 'Dueño',
      propiedad: 'Calle 1',
      dias: 15,
    });
    const parcial = t.cobranza[0]!.emitidos.filas.find((f) => f.id === '6')!;
    expect(parcial.estado).toBe('Pagó $ 150.000,00, falta $ 250.000,00');
    expect(t.cobranza[0]!.emitidos.filas.find((f) => f.id === '5')!.estado).toBe('Cobrado');
  });

  it('indexaciones: el alquiler de hoy, el nuevo y qué falta', async () => {
    const t = (await servicio().tablero(HOY)).tareas;
    expect(t.indexacionesVencidas.filas[0]).toMatchObject({
      alquiler: 1_137_518,
      importe: 1_200_000,
      estado: 'Lista para confirmar (vencida)',
    });
    expect(t.indexacionesProximas.filas[0]).toMatchObject({
      estado: 'Espera el ICL del 31/10/2026',
      dias: 12,
    });
  });

  it('cada fila lleva a la ficha o a la cuenta', async () => {
    const t = await servicio().tablero(HOY);
    expect(t.cartera.vigentes.filas[0]!.href).toBe('/alquileres/contratos/c5');
    expect(t.morosidad[0]!.total.filas[0]!.href).toBe('/alquileres/personas/inq5');
  });

  // Como el Tablero Comercial: los gráficos van por año calendario.
  it('los meses son del año elegido, y los ingresos también del anterior', async () => {
    await servicio().tablero(HOY, 2025);
    const [alquileres, cierres, ingresos] = rawCalls.at(-1)!;
    // Los doce meses del año elegido, y el mes en curso por la pantalla anterior.
    expect(alquileres).toEqual(['2025-01', '2025-12', '2026-10']);
    // La deuda al cierre de cada mes de 2025 y la de hoy.
    expect(cierres![0]).toEqual([
      '2025-01-31',
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
      '2025-05-31',
      '2025-06-30',
      '2025-07-31',
      '2025-08-31',
      '2025-09-30',
      '2025-10-31',
      '2025-11-30',
      '2025-12-31',
      HOY,
    ]);
    const fechas = ingresos!
      .filter((v: unknown) => v instanceof Date)
      .map((v) => (v as Date).toISOString().slice(0, 10));
    expect(fechas).toEqual(['2024-01-01', '2027-01-01', '2024-01-01', '2027-01-01']);
  });

  it('los ingresos llegan por mes, con los punitorios en cero si no hubo', async () => {
    expect((await servicio().tablero(HOY)).ingresos).toEqual([
      {
        mes: '2026-10',
        moneda: 'ARS',
        honorarios: 110_111.74,
        gastos: 27_527.94,
        punitorios: 0,
        comisiones: 0,
      },
    ]);
  });

  // Punto 8 de Javier: Particulares y Comerciales por separado, en todo el tablero.
  describe('filtro por tipo y contratos nuevos (punto 8)', () => {
    const cartera = () => [
      contrato(),
      contrato({
        id: 'c3',
        codigo: '3',
        tipo: 'comercial',
        inicio: d('2026-03-01'),
        tramos: [{ numero: 1, desde: d('2026-03-01'), importe: dec(1_200_000) }],
      }),
      contrato({
        id: 'c4',
        codigo: '4',
        inicio: d('2025-03-10'),
        tramos: [{ numero: 1, desde: d('2025-03-10'), importe: dec(380_000) }],
      }),
    ];

    it('el reparto de la cartera es de todos, con cantidad, importe y porcentaje', async () => {
      const t = await servicio({ contratos: cartera() }).tablero(HOY, 2026, 'comercial');
      expect(t.cartera.porTipo).toEqual([
        { tipo: 'vivienda', cantidad: 2, importe: 1_517_518, pct: 55.8 },
        { tipo: 'comercial', cantidad: 1, importe: 1_200_000, pct: 44.2 },
      ]);
    });

    // Javier, 6/10/2026: el filtro tardaba porque cada toque volvía a leer todo.
    it('una sola lectura arma los tres cortes', async () => {
      const antes = rawCalls.length;
      const t = await servicio({ contratos: cartera() }).tableros(HOY, 2026);
      expect(rawCalls.length - antes).toBe(1);
      expect(rawCalls.at(-1)!.length).toBe(3);
      expect(t.comercial.tipo).toBe('comercial');
      expect(t.comercial.cartera.vigentes.filas.map((f) => f.contrato)).toEqual(['3']);
      expect(t.todos.cartera.vigentes.filas.length).toBeGreaterThan(
        t.comercial.cartera.vigentes.filas.length,
      );
    });

    it('lo agregado en la base viene por tipo: con «todos» se suma, filtrado queda el suyo', async () => {
      const alquileres = [
        alquiler('5', 1_000_000, 800_000),
        alquiler('3', 500_000, 500_000, { tipo_contrato: 'comercial' }),
      ];
      const t = await servicio({ contratos: cartera(), alquileres }).tableros(HOY, 2026);
      expect(t.todos.evolucion).toEqual([
        {
          mes: '2026-10',
          moneda: 'ARS',
          emitido: 1_500_000,
          cobrado: 1_300_000,
          emitidos: 2,
          cobrados: 1,
          cobradoHoy: 1_300_000,
        },
      ]);
      expect(t.comercial.evolucion).toEqual([
        {
          mes: '2026-10',
          moneda: 'ARS',
          emitido: 500_000,
          cobrado: 500_000,
          emitidos: 1,
          cobrados: 1,
          cobradoHoy: 500_000,
        },
      ]);
      expect(t.vivienda.morosidad[0]!.total.valor).toBe(350_000);
      expect(t.comercial.morosidad).toEqual([]);
    });

    it('contratos nuevos por el mes en que empiezan, con el alquiler inicial, y los del año anterior', async () => {
      const t = await servicio({ contratos: cartera() }).tablero(HOY, 2026);
      expect(t.nuevos.porMes.map((i) => i.valor)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(t.nuevos.porMes[2]!.filas.map((f) => [f.contrato, f.importe])).toEqual([
        ['3', 1_200_000],
      ]);
      expect(t.nuevos.importePorMes[2]).toBe(1_200_000);
      expect(t.nuevos.anterior).toEqual([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
    });

    it('escalones que empiezan en los próximos 60 días', async () => {
      const escalonado = contrato({
        id: 'c7',
        codigo: '7',
        ajuste: 'escalonado',
        tramos: [
          { numero: 1, desde: d('2026-02-01'), importe: dec(300_000) },
          { numero: 2, desde: d('2026-11-01'), importe: dec(330_000) },
          { numero: 3, desde: d('2027-08-01'), importe: dec(360_000) },
        ],
      });
      const t = (await servicio({ contratos: [contrato(), escalonado] }).tablero(HOY)).tareas
        .escalones;
      expect(t.filas.map((f) => [f.contrato, f.importe, f.fecha])).toEqual([
        ['7', 330_000, '2026-11-01'],
      ]);
    });
  });

  // Reglas 74 a 82: el selector de período (Javier, 7/10/2026).
  describe('el período: mes, trimestre y año (reglas 75 a 82)', () => {
    const historia = () => [
      contrato({
        id: 'cA',
        codigo: 'A',
        inicio: d('2025-01-01'),
        fin: d('2027-12-31'),
        tramos: [
          { numero: 1, desde: d('2025-01-01'), importe: dec(500_000) },
          { numero: 2, desde: d('2026-05-01'), importe: dec(650_000) },
        ],
      }),
      contrato({
        id: 'cB',
        codigo: 'B',
        tipo: 'comercial',
        estado: 'finalizado',
        inicio: d('2024-06-01'),
        fin: d('2026-05-31'),
        tramos: [{ numero: 1, desde: d('2024-06-01'), importe: dec(300_000) }],
      }),
      contrato({
        id: 'cC',
        codigo: 'C',
        inicio: d('2026-06-01'),
        fin: d('2028-05-31'),
        tramos: [{ numero: 1, desde: d('2026-06-01'), importe: dec(700_000) }],
      }),
      contrato({
        id: 'cD',
        codigo: 'D',
        estado: 'rescindido',
        inicio: d('2025-03-01'),
        fin: d('2027-02-28'),
        rescindidoEl: d('2026-02-15'),
        tramos: [{ numero: 1, desde: d('2025-03-01'), importe: dec(200_000) }],
      }),
      // Terminó en enero y nadie lo finalizó: sigue «vigente» hoy, y lo estaba en marzo.
      contrato({
        id: 'cE',
        codigo: 'E',
        inicio: d('2024-01-01'),
        fin: d('2026-01-31'),
        tramos: [{ numero: 1, desde: d('2024-01-01'), importe: dec(100_000) }],
      }),
    ];
    const de = (contratoId: string, tipo = 'vivienda') => ({
      contrato_id: contratoId,
      tipo_contrato: tipo,
    });
    const alquileres = [
      alquiler('a1', 500_000, 500_000, { periodo: '2026-01', ...de('cA') }),
      // Pagado en abril: al cierre de febrero no estaba cobrado.
      alquiler('a2', 500_000, 500_000, { periodo: '2026-02', alCierre: 300_000, ...de('cA') }),
      alquiler('a3', 300_000, 100_000, { periodo: '2026-02', ...de('cB', 'comercial') }),
      alquiler('a4', 700_000, 0, { periodo: '2026-07', ...de('cC') }),
      alquiler('a5', 650_000, 650_000, { periodo: '2026-10', ...de('cA') }),
    ];
    const movimientos = [
      movimiento('h0', '2025-11-10', 'honorarios', 20_000, de('cA')),
      movimiento('h1', '2026-01-12', 'honorarios', 25_000, de('cA')),
      movimiento('g1', '2026-02-07', 'gastos_adm', 10_000, de('cA')),
      movimiento('p1', '2026-02-20', 'punitorio', 3_000, de('cB', 'comercial')),
      movimiento('c1', '2026-07-03', 'comision', 40_000, de('cC')),
      movimiento('i1', '2026-07-03', 'informe', 5_000, de('cC')),
    ];
    const deudaMarzo = [
      mora('m3', '2026-02-05', 80_000, { cierre: '2026-03-31', persona_id: 'inqA', ...de('cA') }),
      mora('m4', '2026-03-05', 20_000, {
        cierre: '2026-03-31',
        persona_id: 'inqB',
        ...de('cB', 'comercial'),
      }),
    ];
    const fixture = () => ({
      contratos: historia(),
      alquileres,
      movimientos,
      mora: [...deudaMarzo, mora('m1', '2026-10-05', 250_000, de('cA'))],
    });

    // Regla 75.
    it('regla 75: los alquileres llegan mes por mes: cuántos, cuánto y lo cobrado', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      expect(t.evolucion.map((e) => [e.mes, e.emitidos, e.cobrados, e.emitido])).toEqual([
        ['2026-01', 1, 1, 500_000],
        ['2026-02', 2, 1, 800_000],
        ['2026-07', 1, 0, 700_000],
        ['2026-10', 1, 1, 650_000],
      ]);
    });

    it('regla 76: lo cobrado hasta hoy y lo cobrado al cierre del mes son dos números', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      const febrero = t.evolucion.find((e) => e.mes === '2026-02')!;
      expect(febrero).toMatchObject({ cobradoHoy: 600_000, cobrado: 400_000 });
    });

    it('regla 77: cada mes cierra su último día; el mes en curso y los que vienen, hoy', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      expect(t.cierres.map((c) => c.cierre)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
        '2026-05-31',
        '2026-06-30',
        '2026-07-31',
        '2026-08-31',
        '2026-09-30',
        HOY,
        HOY,
        HOY,
      ]);
    });

    it('regla 77: vigente al cierre es por fechas, no por el estado de hoy', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      const al = (mes: string) => t.cierres.find((c) => c.mes === mes)!;
      // Enero: los cuatro que habían empezado y no habían terminado (D se rescindió en febrero).
      expect(al('2026-01').vigentes).toBe(4);
      // Marzo: A, B (finalizado en mayo) y E (terminó en enero, sigue vigente); C empieza en junio.
      expect(al('2026-03')).toMatchObject({ vigentes: 3, vivienda: 2, comercial: 1 });
      // El alquiler de cada uno ese día: A todavía no había indexado.
      expect(al('2026-03').alquilerMensual).toEqual([
        { moneda: 'ARS', valor: 900_000, contratos: 3 },
      ]);
      // El mes en curso es a hoy: la misma cartera que viaja con su lista.
      expect(al('2026-10').vigentes).toBe(t.cartera.vigentes.valor);
      expect(al('2026-10').alquilerMensual[0]!.valor).toBe(
        t.cartera.alquilerMensual[0]!.indicador.valor,
      );
      expect(t.cartera.vigentes.filas.map((f) => f.contrato)).toEqual(['A', 'C', 'E']);
    });

    it('regla 77: la deuda al cierre, con la antigüedad contada a esa fecha', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      const marzo = t.cierres.find((c) => c.mes === '2026-03')!;
      expect(marzo.mora).toEqual([
        {
          moneda: 'ARS',
          valor: 100_000,
          conceptos: 2,
          inquilinos: 2,
          tramos: [
            { tramo: '1-30', valor: 20_000, conceptos: 1 },
            { tramo: '31-60', valor: 80_000, conceptos: 1 },
            { tramo: '61-90', valor: 0, conceptos: 0 },
            { tramo: '90+', valor: 0, conceptos: 0 },
          ],
        },
      ]);
      // Un mes sin deuda al cierre no tiene filas; el mes en curso, la de hoy.
      expect(t.cierres.find((c) => c.mes === '2026-05')!.mora).toEqual([]);
      expect(t.cierres.find((c) => c.mes === '2026-10')!.mora[0]!.valor).toBe(
        t.morosidad[0]!.total.valor,
      );
    });

    // Regla 79: la lista que se pide al abrir la tarjeta suma exactamente la tarjeta.
    const PERIODOS = [
      ['un mes', '2026-02', '2026-02'],
      ['un trimestre', '2026-01', '2026-03'],
      ['el año', '2026-01', '2026-12'],
    ] as const;
    const FOTOS: string[] = ['vigentes', 'alquilerMensual', 'mora'];
    const FLUJOS = INDICADORES_DETALLE_TABLERO.filter((i) => !FOTOS.includes(i));
    const TIPOS: FiltroTipoContrato[] = ['todos', 'vivienda', 'comercial'];

    /** Lo que la pantalla muestra para un flujo en un período: la suma de sus meses. */
    function sumaDeLosMeses(
      t: TableroAlquileresDto,
      indicador: string,
      desde: string,
      hasta: string,
    ) {
      const enRango = (mes: string) => mes >= desde && mes <= hasta;
      const evolucion = t.evolucion.filter((e) => enRango(e.mes) && e.moneda === 'ARS');
      const ingresos = t.ingresos.filter((i) => enRango(i.mes) && i.moneda === 'ARS');
      const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
      switch (indicador) {
        case 'emitidos':
          return sum(evolucion.map((e) => e.emitidos));
        case 'cobrados':
          return sum(evolucion.map((e) => e.cobrados));
        case 'importeEmitido':
          return sum(evolucion.map((e) => e.emitido));
        case 'importeCobrado':
          return sum(evolucion.map((e) => e.cobradoHoy));
        case 'ingresos':
          return sum(ingresos.map((i) => i.honorarios + i.gastos + i.punitorios + i.comisiones));
        default:
          return sum(ingresos.map((i) => i[indicador as 'honorarios']));
      }
    }
    const sumaDeFilas = (ind: Indicador, cuenta: boolean) =>
      cuenta
        ? ind.filas.length
        : Math.round(ind.filas.reduce((s, f) => s + (f.importe ?? 0), 0) * 100) / 100;

    it.each(PERIODOS)(
      'regla 79: cada flujo de %s, en los tres cortes: la lista suma la tarjeta',
      async (_n, desde, hasta) => {
        const svc = servicio(fixture());
        const tableros = await svc.tableros(HOY, 2026);
        for (const tipo of TIPOS)
          for (const indicador of FLUJOS) {
            const ind = await svc.detalle({ indicador, desde, hasta, tipo, moneda: 'ARS' }, HOY);
            const nombre = `${indicador} ${tipo} ${desde}…${hasta}`;
            expect(ind.valor, nombre).toBe(sumaDeLosMeses(tableros[tipo], indicador, desde, hasta));
            const cuenta = indicador === 'emitidos' || indicador === 'cobrados';
            expect(sumaDeFilas(ind, cuenta), nombre).toBe(ind.valor);
          }
      },
    );

    it('regla 79: los números del fixture no dan cero por casualidad', async () => {
      const t = await servicio(fixture()).tablero(HOY);
      expect(sumaDeLosMeses(t, 'importeEmitido', '2026-01', '2026-03')).toBe(1_300_000);
      expect(sumaDeLosMeses(t, 'cobrados', '2026-01', '2026-03')).toBe(2);
      expect(sumaDeLosMeses(t, 'comisiones', '2026-01', '2026-12')).toBe(45_000);
      expect(sumaDeLosMeses(t, 'ingresos', '2026-01', '2026-03')).toBe(38_000);
    });

    it.each(TIPOS)(
      'regla 79: las fotos al cierre de marzo y a hoy, %s: la lista suma la tarjeta',
      async (tipo) => {
        const svc = servicio(fixture());
        const t = (await svc.tableros(HOY, 2026))[tipo];
        for (const hasta of ['2026-03', '2026-10']) {
          const c = t.cierres.find((x) => x.mes === hasta)!;
          const q = { desde: hasta, hasta, tipo, moneda: 'ARS' as const };
          const vigentes = await svc.detalle({ ...q, indicador: 'vigentes' }, HOY);
          expect(vigentes.valor).toBe(c.vigentes);
          expect(vigentes.filas.length).toBe(c.vigentes);
          const alquiler = await svc.detalle({ ...q, indicador: 'alquilerMensual' }, HOY);
          expect(alquiler.valor).toBe(c.alquilerMensual[0]?.valor ?? 0);
          expect(sumaDeFilas(alquiler, false)).toBe(alquiler.valor);
          const deuda = await svc.detalle({ ...q, indicador: 'mora' }, HOY);
          expect(deuda.valor).toBe(c.mora[0]?.valor ?? 0);
          for (const x of c.mora[0]?.tramos ?? []) {
            const tramo = await svc.detalle({ ...q, indicador: 'mora', tramo: x.tramo }, HOY);
            expect(tramo.valor).toBe(x.valor);
            expect(tramo.filas.length).toBe(x.conceptos);
          }
        }
      },
    );

    it('regla 79: las filas del detalle traen lo que sirve para revisarlas', async () => {
      const svc = servicio(fixture());
      const q = { tipo: 'todos', moneda: 'ARS' } as const;
      const cobrado = await svc.detalle(
        { ...q, indicador: 'importeCobrado', desde: '2026-02', hasta: '2026-02' },
        HOY,
      );
      expect(cobrado.filas.map((f) => [f.contrato, f.importe, f.estado])).toEqual([
        ['A', 500_000, 'Cobrado'],
        ['B', 100_000, 'Pagó $ 100.000,00, falta $ 200.000,00'],
      ]);
      const comisiones = await svc.detalle(
        { ...q, indicador: 'comisiones', desde: '2026-07', hasta: '2026-07' },
        HOY,
      );
      expect(comisiones.filas.map((f) => [f.contrato, f.detalle, f.importe])).toEqual([
        ['C', 'Comisión', 40_000],
        ['C', 'Informe de garantía', 5_000],
      ]);
    });

    it('regla 82: el tablero y el detalle hacen las mismas consultas con 5 o con 25 contratos', async () => {
      const cuantas = async (n: number) => {
        const ids = Array.from({ length: n }, (_, i) => `x${i}`);
        const svc = servicio({
          contratos: ids.map((id) => contrato({ id, codigo: id })),
          alquileres: ids.flatMap((id) =>
            ['2026-01', '2026-02', '2026-10'].map((periodo) =>
              alquiler(`${id}-${periodo}`, 100_000, 50_000, { periodo, contrato_id: id }),
            ),
          ),
          mora: ids.map((id) => mora(`m-${id}`, '2026-09-05', 10_000, { contrato_id: id })),
          movimientos: ids.map((id) =>
            movimiento(`h-${id}`, '2026-02-10', 'honorarios', 1_000, { contrato_id: id }),
          ),
        });
        await svc.tableros(HOY, 2026);
        const delTablero = consultas.n;
        const delDetalle: number[] = [];
        for (const indicador of INDICADORES_DETALLE_TABLERO) {
          consultas.n = 0;
          await svc.detalle(
            { indicador, desde: '2026-01', hasta: '2026-12', tipo: 'todos', moneda: 'ARS' },
            HOY,
          );
          delDetalle.push(consultas.n);
        }
        return { delTablero, delDetalle };
      };
      const cinco = await cuantas(5);
      expect(await cuantas(25)).toEqual(cinco);
      expect(cinco.delTablero).toBe(7);
      expect(Math.max(...cinco.delDetalle)).toBeLessThanOrEqual(2);
    });
  });
});
