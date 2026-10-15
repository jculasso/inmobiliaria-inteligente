// Liquidación parcial y final cuando el índice sale atrasado (spec
// alquileres-fase-1.md, reglas 130 a 141).
//
// Florencia (Vacker), 15/10/2026: «IPC sale atrasado, podemos hacer una
// liquidación provisoria ya que se espera el índice, entonces el inquilino
// recibe una liquidación provisoria, paga ese importe similar a la del mes
// pasado, y luego cuando sale el índice se hace la liquidación definitiva y el
// inquilino paga el saldo, y lo mismo pasa con el propietario».
//
// Nada de esto inventa una cuenta: la parcial es el mes generado con el
// importe del tramo anterior (`generarPeriodo`), y la final es la diferencia,
// concepto por concepto, entre el mes generado con el importe definitivo y lo
// que ya se generó. Por eso parcial + final = definitivo al centavo, también
// con dos dueños, honorarios y gastos: se resta lo mismo que se calculó.

import {
  diaHabilDesde,
  generarPeriodo,
  sumarDiasIso,
  type ConceptoGenerado,
  type ContratoParaGenerar,
  type ParteDelMes,
  type SentidoConcepto,
  type TipoConceptoGenerado,
} from './alquileres';

export type EtapaLiquidacion = 'parcial' | 'final';

/**
 * Un tramo que espera su índice (regla 130): mientras tanto se cobra el
 * importe del tramo anterior, como liquidación parcial.
 */
export interface EsperaDeIndice {
  /** El importe del tramo anterior: lo que se cobra mientras tanto. */
  importeProvisorio: number;
  /** Qué falta, en palabras: «el IPC de septiembre de 2026». */
  espera: string;
}

/** Un concepto generado del mes, con su etapa si es de un tramo que espera el índice. */
export interface ConceptoConEtapa extends ConceptoGenerado {
  etapa: EtapaLiquidacion | null;
  /** El número del tramo al que pertenece la parcial (o la final). */
  tramo: number | null;
}

export interface ResultadoConParciales {
  conceptos: ConceptoConEtapa[];
  /** Partes sin indexar que NO esperan un índice: el índice ya está y falta confirmar (regla 11). */
  sinIndexar: ParteDelMes[];
  /** Partes que se generaron como liquidación parcial, con lo que esperan (regla 130). */
  parciales: (ParteDelMes & { espera: string })[];
}

/**
 * La marca de la liquidación final en la clave de generación: va pegada al
 * día de la parte (`alq|c|2026-10|2026-10-01~final|…`), así la final es una
 * parte del mes propia. La liquidación al propietario libera cada parte en la
 * proporción que pagó el inquilino de ESA parte (regla 22): con la marca, la
 * final del dueño espera a que el inquilino pague la diferencia, y no se mezcla
 * con lo que ya pagó de la parcial (regla 136).
 */
export const MARCA_FINAL = '~final';

const SEGMENTO_DE_LA_PARTE = 3;

/**
 * La clave de una final. La primera es `…~final`; si el importe del tramo se
 * corrige después, la siguiente diferencia es `…~final2`, y así: cada una es
 * única y ninguna pisa a la anterior.
 */
export function claveFinal(claveParcial: string, version: number): string {
  const partes = claveParcial.split('|');
  partes[SEGMENTO_DE_LA_PARTE] =
    `${partes[SEGMENTO_DE_LA_PARTE]}${MARCA_FINAL}${version > 1 ? version : ''}`;
  return partes.join('|');
}

/** La clave de la parcial que completa una final; `null` si la clave no es de una final. */
export function claveParcialDeFinal(clave: string | null): string | null {
  if (!clave?.startsWith('alq|')) return null;
  const partes = clave.split('|');
  const parte = partes[SEGMENTO_DE_LA_PARTE] ?? '';
  const i = parte.indexOf(MARCA_FINAL);
  if (i < 0) return null;
  partes[SEGMENTO_DE_LA_PARTE] = parte.slice(0, i);
  return partes.join('|');
}

/**
 * Regla 130: el mes, con las partes de un tramo que espera su índice
 * generadas con el importe del tramo anterior y marcadas como parciales.
 *
 * `esperas` dice, por número de tramo, cuál espera y con qué importe. Una
 * parte sin importe que no está ahí —el índice ya salió y falta que alguien
 * confirme— sigue la regla 11: no se genera.
 *
 * Por fuera es `generarPeriodo` dos veces: con los tramos como están (para
 * saber qué partes esperan) y con el importe provisorio puesto. Las claves son
 * las de siempre, así que generar de nuevo después de confirmar no duplica
 * (regla 10): la parte ya existe, como parcial.
 */
export function generarPeriodoConParciales(
  c: ContratoParaGenerar,
  periodo: string,
  ivaInmobiliariaPct: number,
  esperas: ReadonlyMap<number, EsperaDeIndice>,
  /** Los feriados del mes, como en `generarPeriodo` (regla 100). */
  feriados: ReadonlySet<string> = new Set(),
): ResultadoConParciales {
  const tal = generarPeriodo(c, periodo, ivaInmobiliariaPct, feriados);
  const espera = (p: ParteDelMes) => esperas.get(p.tramo);
  if (!tal.sinIndexar.some(espera))
    return {
      conceptos: tal.conceptos.map((k) => ({ ...k, etapa: null, tramo: null })),
      sinIndexar: tal.sinIndexar,
      parciales: [],
    };

  const tramos = c.tramos.map((t) =>
    t.importe == null && esperas.has(t.numero)
      ? { ...t, importe: esperas.get(t.numero)!.importeProvisorio }
      : t,
  );
  const provisorio = generarPeriodo({ ...c, tramos }, periodo, ivaInmobiliariaPct, feriados);
  const parciales = tal.sinIndexar.filter(espera).map((p) => ({ ...p, espera: espera(p)!.espera }));
  const parcialDe = (k: ConceptoGenerado) =>
    parciales.find((p) => k.clave.split('|')[SEGMENTO_DE_LA_PARTE] === p.desde);
  return {
    conceptos: provisorio.conceptos.map((k) => {
      const p = parcialDe(k);
      return p
        ? {
            ...k,
            etapa: 'parcial' as const,
            tramo: p.tramo,
            descripcion: `${k.descripcion} — liquidación parcial (espera ${p.espera})`,
          }
        : { ...k, etapa: null, tramo: null };
    }),
    sinIndexar: tal.sinIndexar.filter((p) => !espera(p)),
    parciales,
  };
}

/** Un concepto ya generado de un tramo con etapa: una parcial o una final anterior. */
export interface ConceptoDeLaEtapa {
  clave: string;
  sentido: SentidoConcepto;
  importe: number;
  etapa: EtapaLiquidacion;
  anulado: boolean;
}

/** Quién es quién en un concepto del mes, por su tipo y su sentido. */
export type PapelDiferencia = 'inquilino' | 'propietario';

export interface DiferenciaFinal extends Omit<ConceptoGenerado, 'tipo'> {
  /** El tipo del concepto que completa, u `otro` si es el espejo de una diferencia negativa. */
  tipo: TipoConceptoGenerado | 'otro';
  etapa: 'final';
  tramo: number;
  papel: PapelDiferencia;
  /** +1 si completa lo que faltaba; −1 si devuelve lo que se cobró de más (regla 134). */
  signo: 1 | -1;
}

const aCentavos = (n: number) => Math.round(n * 100);

/** Del lado del inquilino: lo que se le cobra a él (alquiler, gastos, IVA). El resto es del dueño. */
function papelDe(tipo: string, sentido: SentidoConcepto): PapelDiferencia {
  return sentido === 'a_cobrar' && tipo !== 'honorarios' ? 'inquilino' : 'propietario';
}

const invertir = (s: SentidoConcepto): SentidoConcepto =>
  s === 'a_cobrar' ? 'a_pagar' : 'a_cobrar';

/**
 * Reglas 131 a 134: las diferencias de la liquidación final de un tramo.
 *
 * Por cada mes que ya tiene parciales de este tramo, genera el mes con el
 * importe definitivo y compara concepto por concepto —alquiler, gastos
 * administrativos, IVA, el alquiler y los honorarios de cada dueño— contra la
 * parcial y las finales anteriores. La diferencia va en el MISMO mes:
 *
 * - positiva: un concepto del mismo tipo y sentido («Alquiler octubre 2026 —
 *   liquidación final (diferencia por IPC)»);
 * - negativa: el espejo, como un reintegro (regla 14): a favor del inquilino
 *   (se compensa en su próximo cobro, regla 15) y a devolver por el dueño (se
 *   le descuenta al liquidar, regla 20), con tipo `otro`, que es como el
 *   módulo ya mueve un reintegro de una parte a la otra;
 * - cero: nada.
 *
 * Una parcial anulada es una decisión (como la anulación de la regla 19): su
 * concepto no recibe final. La parcial nunca se toca.
 *
 * `contrato` trae el tramo con su importe definitivo; `existentes`, lo que ya
 * hay de este tramo con etapa (parciales y finales, anuladas incluidas).
 */
export function diferenciasDeLiquidacionFinal(p: {
  contrato: ContratoParaGenerar;
  tramo: number;
  ivaInmobiliariaPct: number;
  existentes: ConceptoDeLaEtapa[];
  vencimiento: string;
  /** Cómo se nombra el índice en la descripción: «IPC», «ICL», «Casa Propia». */
  indice: string;
  /**
   * Desde qué mes (`AAAA-MM`), si no son todos: al corregir el importe de un
   * tramo se elige desde cuándo rige (regla 108), y los meses de antes no
   * cambian.
   */
  desde?: string;
}): DiferenciaFinal[] {
  const parciales = new Map(
    p.existentes.filter((e) => e.etapa === 'parcial').map((e) => [e.clave, e]),
  );
  const finales = p.existentes.filter((e) => e.etapa === 'final' && !e.anulado);
  const periodos = [...new Set([...parciales.keys()].map((k) => k.split('|')[2]!))]
    .filter((periodo) => !p.desde || periodo >= p.desde)
    .sort();
  const diferencias: DiferenciaFinal[] = [];

  for (const periodo of periodos) {
    const definitivo = generarPeriodo(p.contrato, periodo, p.ivaInmobiliariaPct).conceptos;
    for (const d of definitivo) {
      const parcial = parciales.get(d.clave);
      if (!parcial || parcial.anulado) continue;
      const anteriores = finales.filter((f) => claveParcialDeFinal(f.clave) === d.clave);
      const yaEsta =
        aCentavos(parcial.importe) +
        anteriores.reduce(
          (s, f) => s + (f.sentido === d.sentido ? 1 : -1) * aCentavos(f.importe),
          0,
        );
      const diferencia = aCentavos(d.importe) - yaEsta;
      if (diferencia === 0) continue;
      const signo = diferencia > 0 ? 1 : -1;
      const sentido = signo > 0 ? d.sentido : invertir(d.sentido);
      const como =
        signo > 0
          ? `diferencia por ${p.indice}`
          : `diferencia por ${p.indice}, ${sentido === 'a_pagar' ? 'a su favor' : 'a devolver'}`;
      diferencias.push({
        clave: claveFinal(d.clave, anteriores.length + 1),
        personaId: d.personaId,
        tipo: signo > 0 ? d.tipo : 'otro',
        sentido,
        moneda: d.moneda,
        periodo,
        vencimiento: p.vencimiento,
        importe: Math.abs(diferencia) / 100,
        descripcion: `${d.descripcion} — liquidación final (${como})`,
        etapa: 'final',
        tramo: p.tramo,
        papel: papelDe(d.tipo, d.sentido),
        signo,
      });
    }
  }
  return diferencias;
}

/**
 * Lo que cambia para cada lado, para la vista previa de la confirmación y el
 * historial (regla 137). Inquilino: lo que paga de más (o, negativo, lo que se
 * le devuelve). Propietarios: lo que se les transfiere de más, ya descontados
 * los honorarios.
 */
export function resumenDeDiferencias(ds: DiferenciaFinal[]): {
  periodos: string[];
  inquilino: number;
  propietarios: number;
} {
  let inquilino = 0;
  let propietarios = 0;
  for (const d of ds) {
    const c = d.signo * aCentavos(d.importe);
    if (d.papel === 'inquilino') {
      // El IVA del alquiler lo paga el inquilino y lo recibe el dueño; los gastos son de la inmobiliaria.
      inquilino += c;
    } else {
      // Del dueño: su alquiler (y su IVA) suma; sus honorarios restan.
      const esCargo = d.clave.split('|')[5] === 'a_cobrar';
      propietarios += esCargo ? -c : c;
    }
  }
  return {
    periodos: [...new Set(ds.map((d) => d.periodo))].sort(),
    inquilino: inquilino / 100,
    propietarios: propietarios / 100,
  };
}

/**
 * Regla 133: la diferencia vence a los `dias` de confirmar la indexación,
 * corrida al siguiente día hábil —sábado, domingo o feriado nacional— con la
 * misma función que los vencimientos del mes (`diaHabilDesde`, regla 100).
 * Antes de ese día no corre punitorio, porque el punitorio cuenta desde el
 * vencimiento de cada concepto (reglas 16 y 102).
 */
export function vencimientoDeLaDiferencia(
  confirmadoEl: string,
  dias: number,
  feriados: ReadonlySet<string> = new Set(),
): string {
  return diaHabilDesde(sumarDiasIso(confirmadoEl, dias), feriados);
}
