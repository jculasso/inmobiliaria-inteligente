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
    return RespuestaBcra.parse(json).results.flatMap((r) => r.detalle.map((x) => ({ fecha: x.fecha, valor: x.valor })));
  }

  private async ipc(desde: string): Promise<ValorIndice[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=${desde}&format=json&limit=1000`;
    const json = await this.pedir(url, 'INDEC');
    return RespuestaDatosGob.parse(json).data.map(([fecha, valor]) => ({ fecha, valor }));
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
      const ultima = await this.prisma.indiceValor.aggregate({ where: { indice }, _max: { fecha: true } });
      const ultimaFecha = fromDate(ultima._max.fecha);
      try {
        const desde = ultimaFecha ? (indice === 'IPC' ? ultimaFecha : sumarDiasIso(ultimaFecha, 1)) : INICIO[indice];
        const valores = (await this.fuentes.traer(indice, desde, hoy)).filter((v) => !ultimaFecha || v.fecha > ultimaFecha);
        const { count } = await this.prisma.indiceValor.createMany({
          data: valores.map((v) => ({ indice, fecha: toDate(v.fecha)!, valor: v.valor, fuente: FUENTE[indice] })),
          skipDuplicates: true,
        });
        const nueva = valores.reduce<string | null>((m, v) => (m === null || v.fecha > m ? v.fecha : m), ultimaFecha);
        resultados.push({ indice, nuevos: count, ultimaFecha: nueva });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.log.warn(`No se pudo traer el ${indice}: ${error}`);
        resultados.push({ indice, nuevos: 0, ultimaFecha, error });
      }
    }
    return resultados;
  }
}
