import { describe, expect, it } from 'vitest';
import { fechaPrevistaDeSemana, type AccionCalc } from './protocolo.calc';
import {
  generarReporteSemanal,
  type PropiedadEnReporte,
  type ProtocoloParaReporte,
  type ReporteSemanal,
  type SemanaEnReporte,
} from './reporte-semanal';

// Los números de regla son los de docs/specs/reporte-semanal-protocolo.md.

const HOY = '2026-07-30';

/**
 * Primer elemento, o falla con un mensaje que se entiende. Existe porque el
 * proyecto compila con `noUncheckedIndexedAccess`: indexar devuelve
 * `T | undefined`, y un `!` escondería justo el caso que querríamos ver fallar.
 */
function primero<T>(items: readonly T[], que: string): T {
  const x = items[0];
  if (x === undefined) throw new Error(`el reporte no trajo ningún ${que}`);
  return x;
}

function unicaPropiedad(r: ReporteSemanal): PropiedadEnReporte {
  return primero(primero(r.porVendedor, 'vendedor').propiedades, 'propiedad');
}

function semanaDe(prop: PropiedadEnReporte, semana: number): SemanaEnReporte {
  const s = prop.semanas.find((x) => x.semana === semana);
  if (!s) throw new Error(`no hay semana ${semana} en el reporte`);
  return s;
}

function titulosDe(prop: PropiedadEnReporte): string[] {
  return [...prop.alertasGenerales, ...prop.semanas.flatMap((s) => s.alertas)].map(
    (a) => a.titulo,
  );
}

/** Acciones de las 5 semanas, dos por semana, con su fecha prevista real. */
function acciones(
  fechaInicio: string,
  estados: Partial<Record<number, AccionCalc['estado']>> = {},
): AccionCalc[] {
  const out: AccionCalc[] = [];
  for (const semana of [1, 2, 3, 4, 5]) {
    for (let i = 0; i < 2; i++) {
      out.push({
        semana,
        estado: estados[semana] ?? 'realizada',
        fechaPrevista: fechaPrevistaDeSemana(fechaInicio, semana),
      });
    }
  }
  return out;
}

function protocolo(over: Partial<ProtocoloParaReporte> = {}): ProtocoloParaReporte {
  const fechaInicio = over.fechaInicio ?? '2026-07-01';
  return {
    id: 'p1',
    direccion: 'Rivadavia 100',
    estado: 'activa',
    fechaInicio,
    vencimientoAutorizacion: null,
    actualizadoEn: HOY,
    consultas: 5,
    visitas: 2,
    acciones: acciones(fechaInicio),
    agente: { id: 'u1', nombre: 'Ana Perez' },
    ...over,
  };
}

describe('generarReporteSemanal', () => {
  it('regla 1 · deja afuera los protocolos archivados', () => {
    const r = generarReporteSemanal(
      [
        protocolo({ id: 'activa' }),
        protocolo({ id: 'archivada', estado: 'archivada', direccion: 'Mitre 50' }),
      ],
      HOY,
    );

    expect(r.resumen.activas).toBe(1);
    expect(r.porVendedor.flatMap((v) => v.propiedades).map((p) => p.protocoloId)).toEqual([
      'activa',
    ]);
  });

  it('regla 2 · usa calcularAlertas: la autorización vencida llega al reporte', () => {
    const r = generarReporteSemanal([protocolo({ vencimientoAutorizacion: '2026-07-20' })], HOY);

    const prop = unicaPropiedad(r);
    expect(prop.alertasGenerales.map((a) => a.titulo)).toContain('Autorización vencida');
    expect(prop.prioridad).toBe('roja');
  });

  it('regla 3 · agrupa por vendedor y los ordena alfabéticamente', () => {
    const r = generarReporteSemanal(
      [
        protocolo({ id: 'a', agente: { id: 'u3', nombre: 'Zulema Ríos' } }),
        protocolo({ id: 'b', agente: { id: 'u2', nombre: 'ángel Duarte' } }),
        protocolo({ id: 'c', agente: { id: 'u1', nombre: 'Beto Suárez' } }),
      ],
      HOY,
    );

    expect(r.porVendedor.map((v) => v.vendedorNombre)).toEqual([
      'ángel Duarte',
      'Beto Suárez',
      'Zulema Ríos',
    ]);
  });

  it('regla 4 · dentro del vendedor manda la prioridad, después la dirección', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [
        protocolo({ id: 'verde', direccion: 'Zapiola 1' }),
        protocolo({
          id: 'roja',
          direccion: 'Alsina 9',
          acciones: acciones(inicio, { 1: 'pendiente' }),
        }),
        protocolo({ id: 'verde2', direccion: 'Belgrano 3' }),
      ],
      HOY,
    );

    const props = primero(r.porVendedor, 'vendedor').propiedades;
    expect(primero(props, 'propiedad').protocoloId).toBe('roja');
    expect(props.slice(1).map((p) => p.direccion)).toEqual(['Belgrano 3', 'Zapiola 1']);
  });

  it('regla 5 · necesitaDecision trae solo alertas rojas, con su vendedor', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [
        protocolo({
          id: 'con-atraso',
          direccion: 'Alsina 9',
          acciones: acciones(inicio, { 2: 'pendiente' }),
          agente: { id: 'u1', nombre: 'Ana Perez' },
        }),
        protocolo({ id: 'sin-nada', direccion: 'Mitre 50' }),
      ],
      HOY,
    );

    expect(r.necesitaDecision).toHaveLength(1);
    const item = primero(r.necesitaDecision, 'ítem');
    expect(item).toMatchObject({ vendedorNombre: 'Ana Perez', direccion: 'Alsina 9' });
    expect(item.alertas.every((a) => a.nivel === 'roja')).toBe(true);
  });

  it('regla 6 · clasifica las cinco semanas en futura, completa, en curso e incompleta', () => {
    const inicio = '2026-07-15'; // hoy es día 16 → semana 3
    const r = generarReporteSemanal(
      [
        protocolo({
          fechaInicio: inicio,
          acciones: acciones(inicio, { 2: 'pendiente', 3: 'pendiente' }),
        }),
      ],
      HOY,
    );

    const prop = unicaPropiedad(r);
    expect(prop.semanaActual).toBe(3);
    expect(prop.semanas.map((s) => s.estado)).toEqual([
      'completa', // semana 1, todo realizado
      'incompleta', // semana 2, ya pasó y quedó pendiente
      'en_curso', // semana 3, la actual sin cerrar
      'futura',
      'futura',
    ]);
  });

  it('regla 6 · una semana entera en no_corresponde cuenta como completa', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [protocolo({ fechaInicio: inicio, acciones: acciones(inicio, { 2: 'no_corresponde' }) })],
      HOY,
    );

    const semana2 = semanaDe(unicaPropiedad(r), 2);
    expect(semana2.estado).toBe('completa');
    expect(semana2.pendientes).toBe(0);
    expect(semana2.atrasadas).toBe(0);
  });

  it('regla 7 · las alertas sin semana van aparte de las semanales', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [
        protocolo({
          fechaInicio: inicio,
          vencimientoAutorizacion: '2026-07-20',
          acciones: acciones(inicio, { 1: 'pendiente' }),
        }),
      ],
      HOY,
    );

    const prop = unicaPropiedad(r);
    expect(prop.alertasGenerales.every((a) => a.semana == null)).toBe(true);
    expect(prop.alertasGenerales.map((a) => a.titulo)).toContain('Autorización vencida');

    const semanales = prop.semanas.flatMap((s) => s.alertas);
    expect(semanales.length).toBeGreaterThan(0);
    expect(semanales.every((a) => a.semana != null)).toBe(true);
    // La de acciones atrasadas apunta a la semana 1, que es por donde empezar.
    expect(semanaDe(prop, 1).alertas.map((a) => a.titulo)).toContain('2 acciones atrasadas');
  });

  it('regla 8 · el resumen cuenta activas, rojas, autorizaciones en riesgo y cierres', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [
        protocolo({ id: 'ok', direccion: 'A 1' }),
        protocolo({
          id: 'atraso',
          direccion: 'B 2',
          acciones: acciones(inicio, { 1: 'pendiente' }),
        }),
        protocolo({ id: 'autoriz', direccion: 'C 3', vencimientoAutorizacion: '2026-08-05' }),
      ],
      HOY,
    );

    expect(r.resumen.activas).toBe(3);
    expect(r.resumen.conRojas).toBe(1);
    expect(r.resumen.autorizacionesEnRiesgo).toBe(1);
    expect(r.resumen.listasParaCierre).toBe(3);
  });

  // Deja constancia de un comportamiento HEREDADO de calcularAlertas, no una
  // decisión de este reporte: "Protocolo listo para cierre" mira SOLO que la
  // semana 5 esté completa, así que convive con acciones atrasadas de semanas
  // anteriores. El reporte lo replica a propósito (regla 2) en vez de corregirlo
  // por su cuenta: si el mail contara distinto que el dashboard, se dejaría de
  // creer en los dos. Si se decide cambiarlo, se cambia en calcularAlertas y
  // los dos se mueven juntos.
  it('conocido · "listo para cierre" convive con atrasos de semanas previas', () => {
    const inicio = '2026-07-01';
    const r = generarReporteSemanal(
      [protocolo({ acciones: acciones(inicio, { 1: 'pendiente' }) })],
      HOY,
    );

    const prop = unicaPropiedad(r);
    expect(titulosDe(prop)).toContain('2 acciones atrasadas');
    expect(titulosDe(prop)).toContain('Protocolo listo para cierre');
    expect(prop.prioridad).toBe('roja');
    expect(r.resumen.listasParaCierre).toBe(1);
  });

  it('regla 9 · sin alertas rojas el reporte no necesita atención', () => {
    const r = generarReporteSemanal([protocolo()], HOY);

    expect(r.necesitaAtencion).toBe(false);
    expect(r.necesitaDecision).toHaveLength(0);
    expect(r.resumen.activas).toBe(1);
  });

  it('regla 10 · un vendedor sin propiedades activas no aparece', () => {
    const r = generarReporteSemanal(
      [
        protocolo({ id: 'a', agente: { id: 'u1', nombre: 'Ana Perez' } }),
        protocolo({
          id: 'b',
          estado: 'archivada',
          agente: { id: 'u2', nombre: 'Beto Suárez' },
        }),
      ],
      HOY,
    );

    expect(r.porVendedor.map((v) => v.vendedorNombre)).toEqual(['Ana Perez']);
  });

  it('borde · un protocolo iniciado hoy no arrastra atrasos ni semanas incompletas', () => {
    const r = generarReporteSemanal(
      [protocolo({ fechaInicio: HOY, acciones: acciones(HOY, { 1: 'pendiente', 2: 'pendiente' }) })],
      HOY,
    );

    const prop = unicaPropiedad(r);
    expect(prop.semanaActual).toBe(1);
    expect(semanaDe(prop, 1).estado).toBe('en_curso');
    expect(prop.semanas.slice(1).every((s) => s.estado === 'futura')).toBe(true);
    expect(prop.semanas.every((s) => s.atrasadas === 0)).toBe(true);
    expect(r.necesitaAtencion).toBe(false);
  });

  it('borde · pasadas las cinco semanas sigue apareciendo, clavado en la 5', () => {
    const inicio = '2026-05-01'; // muy pasado
    const r = generarReporteSemanal(
      [protocolo({ fechaInicio: inicio, acciones: acciones(inicio, { 5: 'pendiente' }) })],
      HOY,
    );

    const prop = unicaPropiedad(r);
    expect(prop.semanaActual).toBe(5);
    expect(prop.prioridad).toBe('roja');
    expect(r.resumen.activas).toBe(1);
  });

  it('borde · una inmobiliaria sin protocolos da un reporte vacío y sin atención', () => {
    const r = generarReporteSemanal([], HOY);

    expect(r.resumen).toEqual({
      activas: 0,
      conRojas: 0,
      autorizacionesEnRiesgo: 0,
      listasParaCierre: 0,
    });
    expect(r.necesitaAtencion).toBe(false);
    expect(r.porVendedor).toHaveLength(0);
    expect(r.generadoEl).toBe(HOY);
  });
});
