import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { sumarDiasIso, type IndiceConFuente } from '@vacker/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';

/** Un valor del índice, ya normalizado: el IPC con la fecha del día 1 del mes. */
export interface ValorIndice {
  fecha: string;
  valor: number;
}

/**
 * Desde cuándo se trae la historia la primera vez. El ICL existe desde el
 * 30/06/2020; el IPC de esta serie arranca en diciembre de 2016. Con esto
 * entra cualquier contrato que Vacker tenga vigente.
 */
const INICIO: Record<IndiceConFuente, string> = { ICL: '2020-06-30', IPC: '2016-12-01' };

const FUENTE: Record<IndiceConFuente, string> = {
  ICL: 'BCRA · Estadísticas monetarias v4, variable 40',
  IPC: 'INDEC vía datos.gob.ar · serie 148.3_INIVELNAL_DICI_M_26',
};

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Positivo = z.number().positive();

const RespuestaBcra = z.object({
  results: z.array(z.object({ detalle: z.array(z.object({ fecha: Fecha, valor: Positivo })) })),
});

const RespuestaDatosGob = z.object({
  data: z.array(z.tuple([Fecha, Positivo])),
});

const RespuestaFeriados = z.array(
  z.object({ fecha: Fecha, nombre: z.string().min(1), tipo: z.string().min(1) }),
);

/** Un feriado nacional, como lo publica la fuente (regla 101). */
export interface FeriadoFuente {
  fecha: string;
  nombre: string;
  tipo: string;
}

/** De dónde salen los feriados: una API pública que replica los decretos nacionales. */
export const FUENTE_FERIADOS = 'argentinadatos.com';

/**
 * Las dos fuentes oficiales. Aparte del servicio para poder simularlas en los
 * tests: lo que se prueba es qué se hace con lo que responden.
 */
@Injectable()
export class FuentesIndices {
  /** Reemplazable en los tests. No va por constructor: Nest intentaría inyectarlo. */
  http: typeof fetch = (input, init) => fetch(input, init);

  async traer(indice: IndiceConFuente, desde: string, hoy: string): Promise<ValorIndice[]> {
    return indice === 'ICL' ? this.icl(desde, hoy) : this.ipc(desde);
  }

  /**
   * El BCRA publica el ICL con unos diez días de anticipación, así que se pide
   * hasta dos meses adelante. `desde` no puede ser posterior a hoy: la API lo
   * rechaza con un 400.
   */
  private async icl(desde: string, hoy: string): Promise<ValorIndice[]> {
    const d = desde > hoy ? hoy : desde;
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/40?desde=${d}&hasta=${sumarDiasIso(hoy, 60)}&limit=3000`;
    const json = await this.pedir(url, 'BCRA');
    return RespuestaBcra.parse(json).results.flatMap((r) =>
      r.detalle.map((x) => ({ fecha: x.fecha, valor: x.valor })),
    );
  }

  private async ipc(desde: string): Promise<ValorIndice[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=${desde}&format=json&limit=1000`;
    const json = await this.pedir(url, 'INDEC');
    return RespuestaDatosGob.parse(json).data.map(([fecha, valor]) => ({ fecha, valor }));
  }

  /**
   * Los feriados nacionales de un año (regla 101), con los puentes
   * turísticos: ese día los bancos no abren. Verificado el 15/10/2026: 2026
   * trae 20 y 2027, 16 (sus trasladables todavía sin fecha definitiva).
   */
  async feriados(anio: number): Promise<FeriadoFuente[]> {
    const json = await this.pedir(
      `https://api.argentinadatos.com/v1/feriados/${anio}`,
      'argentinadatos.com',
    );
    return RespuestaFeriados.parse(json).filter((f) => f.fecha.startsWith(`${anio}-`));
  }

  private async pedir(url: string, quien: string): Promise<unknown> {
    const res = await this.http(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${quien} respondió ${res.status}.`);
    return res.json();
  }
}

export interface ResultadoIndice {
  indice: IndiceConFuente;
  nuevos: number;
  ultimaFecha: string | null;
  error?: string;
}

/**
 * Lo que dejó la importación de feriados, con la misma forma que la de un
 * índice: el workflow de GitHub recorre la lista y muestra cada renglón.
 * `aviso` no hace fallar la corrida (la fuente no respondió, pero los dos años
 * ya estaban cargados); `error`, sí.
 */
export interface ResultadoFeriados {
  indice: 'Feriados';
  nuevos: number;
  ultimaFecha: string | null;
  error?: string;
  aviso?: string;
}

/**
 * El importador diario de índices (regla 8).
 *
 * Usa `PrismaService` directo, y es correcto: `indice_valor` no tiene
 * tenant_id ni datos de ninguna inmobiliaria, y escribirla requiere el rol
 * dueño de la tabla (la API dentro de withTenant solo puede leerla).
 *
 * Un valor ya cargado **no se pisa** (`skipDuplicates`): si el INDEC revisa un
 * mes, los contratos ya indexados con el valor anterior no cambian por
 * debajo. Las queries son dos por índice, traiga uno o dos mil valores.
 */
@Injectable()
export class IndicesService {
  private readonly log = new Logger(IndicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fuentes: FuentesIndices,
  ) {}

  async importar(hoy = hoyArgentina()): Promise<ResultadoIndice[]> {
    const resultados: ResultadoIndice[] = [];
    // Uno por vez y cada uno con su try: que el BCRA no responda no frena al IPC.
    for (const indice of ['ICL', 'IPC'] as const) {
      const ultima = await this.prisma.indiceValor.aggregate({
        where: { indice },
        _max: { fecha: true },
      });
      const ultimaFecha = fromDate(ultima._max.fecha);
      try {
        const desde = ultimaFecha
          ? indice === 'IPC'
            ? ultimaFecha
            : sumarDiasIso(ultimaFecha, 1)
          : INICIO[indice];
        const valores = (await this.fuentes.traer(indice, desde, hoy)).filter(
          (v) => !ultimaFecha || v.fecha > ultimaFecha,
        );
        const { count } = await this.prisma.indiceValor.createMany({
          data: valores.map((v) => ({
            indice,
            fecha: toDate(v.fecha)!,
            valor: v.valor,
            fuente: FUENTE[indice],
          })),
          skipDuplicates: true,
        });
        const nueva = valores.reduce<string | null>(
          (m, v) => (m === null || v.fecha > m ? v.fecha : m),
          ultimaFecha,
        );
        resultados.push({ indice, nuevos: count, ultimaFecha: nueva });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.log.warn(`No se pudo traer el ${indice}: ${error}`);
        resultados.push({ indice, nuevos: 0, ultimaFecha, error });
      }
    }
    return resultados;
  }

  /**
   * Regla 101: los feriados nacionales del año en curso y del siguiente, una
   * vez por día, en la misma tarea que los índices.
   *
   * Cada año se sincroniza entero cuando la fuente responde: entra lo nuevo
   * (un feriado puente decretado a mitad de año) y sale lo que la fuente ya no
   * trae (un trasladable que se movió). Una respuesta vacía no borra nada: un
   * año sin feriados es un error de la fuente, no un año sin feriados.
   *
   * Si la fuente no responde, nunca se frena la generación del mes: se usa lo
   * que ya está cargado. Es un error —falla el workflow y llega el mail— solo
   * si algún año quedó sin un solo feriado; si no, un aviso.
   */
  async importarFeriados(hoy = hoyArgentina()): Promise<ResultadoFeriados> {
    const anio = Number(hoy.slice(0, 4));
    let nuevos = 0;
    const problemas: string[] = [];
    const vacios: number[] = [];
    for (const a of [anio, anio + 1]) {
      const rango = { gte: toDate(`${a}-01-01`)!, lte: toDate(`${a}-12-31`)! };
      try {
        const traidos = await this.fuentes.feriados(a);
        if (traidos.length === 0) throw new Error(`la fuente no trajo ningún feriado de ${a}.`);
        const fechas = traidos.map((f) => toDate(f.fecha)!);
        const [, creados] = await this.prisma.$transaction([
          this.prisma.feriado.deleteMany({
            where: { fecha: { ...rango, notIn: fechas }, fuente: FUENTE_FERIADOS },
          }),
          this.prisma.feriado.createMany({
            data: traidos.map((f) => ({
              fecha: toDate(f.fecha)!,
              nombre: f.nombre,
              tipo: f.tipo,
              fuente: FUENTE_FERIADOS,
            })),
            skipDuplicates: true,
          }),
        ]);
        nuevos += creados.count;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.log.warn(`No se pudieron traer los feriados de ${a}: ${error}`);
        problemas.push(`${a}: ${error}`);
        if ((await this.prisma.feriado.count({ where: { fecha: rango } })) === 0) vacios.push(a);
      }
    }
    const ultima = await this.prisma.feriado.aggregate({ _max: { fecha: true } });
    const ultimaFecha = fromDate(ultima._max.fecha);
    if (vacios.length)
      return {
        indice: 'Feriados',
        nuevos,
        ultimaFecha,
        error: `Sin feriados cargados de ${vacios.join(' y ')}: los vencimientos solo se corren por fin de semana. ${problemas.join(' · ')}`,
      };
    return problemas.length
      ? { indice: 'Feriados', nuevos, ultimaFecha, aviso: problemas.join(' · ') }
      : { indice: 'Feriados', nuevos, ultimaFecha };
  }
}
