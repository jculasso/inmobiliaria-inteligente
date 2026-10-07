import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { Indicador, TableroAlquileresDto } from '@vacker/types';
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

function alquilerDelMes(id: string, importe: number, pagado: number) {
  return {
    id,
    moneda: 'ARS',
    importe: dec(importe),
    vencimiento: d('2026-10-05'),
    descripcion: 'Alquiler octubre 2026',
    contratoId: `c${id}`,
    persona: { id: `inq-${id}`, nombre: `Inquilino ${id}` },
    contrato: { codigo: id },
    imputaciones: pagado ? [{ importe: dec(pagado) }] : [],
  };
}

const mora = (id: string, vencimiento: string, saldo: number, persona = 'inq5') => ({
  id,
  moneda: 'ARS',
  vencimiento: d(vencimiento),
  descripcion: 'Alquiler',
  tipo: 'alquiler',
  saldo: dec(saldo),
  contrato_id: 'c5',
  codigo: '5',
  persona_id: persona,
  nombre: 'Inquilina',
  tipo_contrato: 'vivienda',
});

/** Los valores interpolados de cada `$queryRaw`, por servicio creado. */
const rawCalls: unknown[][][] = [];

function servicio(
  over: { contratos?: unknown[]; delMes?: unknown[]; mora?: unknown[]; evolucion?: unknown[] } = {},
) {
  const valores: unknown[][] = [];
  rawCalls.push(valores);
  // En el orden en que el servicio consulta: morosidad, evolución, ingresos.
  const respuestas: unknown[] = [
    over.mora ?? [mora('m1', '2026-10-05', 250_000), mora('m2', '2026-08-05', 100_000)],
    over.evolucion ?? [
      {
        periodo: '2026-10',
        moneda: 'ARS',
        tipo_contrato: 'vivienda',
        emitido: dec(1_537_518),
        cobrado: dec(1_287_518),
      },
    ],
    [
      {
        mes: '2026-10',
        moneda: 'ARS',
        tipo_contrato: 'vivienda',
        honorarios: dec(110_111.74),
        gastos: dec(27_527.94),
        punitorios: null,
      },
    ],
  ];
  const tx = {
    alqContrato: { findMany: vi.fn().mockResolvedValue(over.contratos ?? [contrato()]) },
    alqReclamo: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          asunto: 'Pérdida de agua',
          prioridad: 'alta',
          contratoId: 'c5',
          createdAt: new Date('2026-10-10T12:00:00Z'),
        },
      ]),
    },
    alqPoliza: {
      findMany: vi.fn().mockResolvedValue([
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
      ]),
    },
    alqBoleta: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'b1',
          contratoId: 'c5',
          cuota: '3/6',
          vencimiento: d('2026-10-10'),
          importe: dec(45_000),
          cuenta: { servicio: { nombre: 'API' } },
          poliza: null,
        },
      ]),
    },
    alqConcepto: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          over.delMes ?? [
            alquilerDelMes('5', 1_137_518, 1_137_518),
            alquilerDelMes('6', 400_000, 150_000),
          ],
        ),
    },
    $queryRaw: vi.fn(async (_t: TemplateStringsArray, ...v: unknown[]) => {
      valores.push(v);
      return respuestas.shift();
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
  it('los gráficos piden el año elegido, y los ingresos también el anterior', async () => {
    await servicio().tablero(HOY, 2025);
    const llamadas = rawCalls.at(-1)!;
    expect(llamadas[1]).toEqual(expect.arrayContaining(['2025-01', '2025-12']));
    const fechas = llamadas[2]!
      .filter((v: unknown) => v instanceof Date)
      .map((v) => (v as Date).toISOString().slice(0, 10));
    // Hasta fin del año en curso: la tarjeta «Ingresos del mes» es siempre del mes de hoy.
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
      const evolucion = [
        {
          periodo: '2026-10',
          moneda: 'ARS',
          tipo_contrato: 'vivienda',
          emitido: dec(1_000_000),
          cobrado: dec(800_000),
        },
        {
          periodo: '2026-10',
          moneda: 'ARS',
          tipo_contrato: 'comercial',
          emitido: dec(500_000),
          cobrado: dec(500_000),
        },
      ];
      const t = await servicio({ contratos: cartera(), evolucion }).tableros(HOY, 2026);
      expect(t.todos.evolucion).toEqual([
        { mes: '2026-10', moneda: 'ARS', emitido: 1_500_000, cobrado: 1_300_000 },
      ]);
      expect(t.comercial.evolucion).toEqual([
        { mes: '2026-10', moneda: 'ARS', emitido: 500_000, cobrado: 500_000 },
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
});
