// Reglas de cálculo del módulo Alquileres (docs/specs/alquileres-fase-1.md).
//
// Funciones puras sobre fechas ISO (`YYYY-MM-DD`): sin base, sin reloj, sin
// zona horaria. Las usan la API —que es la que decide— y la web, para mostrar
// una vista previa idéntica a lo que la API va a guardar.
//
// Cada regla está probada contra números reales de Gexion, relevados el
// 5/10/2026 en los contratos de Vacker (ver alquileres.test.ts).

// --- Fechas ---------------------------------------------------------------------

const DIA_MS = 86_400_000;

function aUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function deUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function sumarDiasIso(iso: string, dias: number): string {
  return deUtc(aUtc(iso) + dias * DIA_MS);
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Suma meses conservando el día; si el mes destino es más corto, queda en su
 * último día (31/01 + 1 mes = 28/02 o 29/02).
 */
export function sumarMesesIso(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const dia = Math.min(d, diasDelMes(anio, mes));
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Días entre dos fechas, contando las dos puntas. */
export function diasInclusive(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS) + 1;
}

/** `30/06/2025`, para los mensajes que lee una persona. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// --- Dinero -----------------------------------------------------------------------

/**
 * Redondeo a centavos, mitad hacia arriba, sin el error de coma flotante que
 * hace que `Math.round(1.005 * 100)` dé 100. Se corrige con un épsilon relativo.
 */
export function redondear2(n: number): number {
  return Math.round((n + Math.sign(n) * Number.EPSILON * Math.abs(n)) * 100) / 100;
}

// --- Tramos (reglas 1 y 5) --------------------------------------------------------

export interface TramoBase {
  numero: number;
  desde: string;
  hasta: string;
}

export interface TramoConImporte extends TramoBase {
  /** `null` si el tramo todavía no se indexó (regla 6). */
  importe: number | null;
}

/**
 * Los tramos de un contrato, de `periodicidadMeses` cada uno, de punta a
 * punta. Cada tramo empieza el mismo día del mes que el contrato: uno que
 * arranca el 15/08 tiene tramos del 15 al 14, como en Gexion.
 */
export function generarTramos(inicio: string, fin: string, periodicidadMeses: number): TramoBase[] {
  if (periodicidadMeses < 1) throw new Error('La periodicidad tiene que ser de al menos un mes.');
  const tramos: TramoBase[] = [];
  let desde = inicio;
  for (let numero = 1; desde <= fin; numero++) {
    const siguiente = sumarMesesIso(inicio, numero * periodicidadMeses);
    const hasta = sumarDiasIso(siguiente, -1) < fin ? sumarDiasIso(siguiente, -1) : fin;
    tramos.push({ numero, desde, hasta });
    desde = siguiente;
  }
  return tramos;
}

/**
 * Regla 1: los tramos cubren el contrato entero, sin huecos ni
 * superposiciones. Devuelve un mensaje por problema, con las fechas, para que
 * quien carga sepa dónde mirar. Lista vacía = está bien.
 */
export function validarTramos(inicio: string, fin: string, tramos: TramoBase[]): string[] {
  if (tramos.length === 0) return ['El contrato no tiene tramos.'];
  const errores: string[] = [];
  const orden = [...tramos].sort((a, b) => (a.desde < b.desde ? -1 : 1));
  for (const t of orden) {
    if (t.hasta < t.desde)
      errores.push(
        `El tramo ${t.numero} termina (${fechaCorta(t.hasta)}) antes de empezar (${fechaCorta(t.desde)}).`,
      );
  }
  if (orden[0]!.desde !== inicio) {
    errores.push(
      orden[0]!.desde > inicio
        ? `Del ${fechaCorta(inicio)} al ${fechaCorta(sumarDiasIso(orden[0]!.desde, -1))} no hay tramo.`
        : `El tramo ${orden[0]!.numero} empieza el ${fechaCorta(orden[0]!.desde)}, antes que el contrato.`,
    );
  }
  for (let i = 1; i < orden.length; i++) {
    const prev = orden[i - 1]!;
    const act = orden[i]!;
    const esperado = sumarDiasIso(prev.hasta, 1);
    if (act.desde > esperado) {
      errores.push(
        `Del ${fechaCorta(esperado)} al ${fechaCorta(sumarDiasIso(act.desde, -1))} no hay tramo.`,
      );
    } else if (act.desde < esperado) {
      errores.push(
        `Los tramos ${prev.numero} y ${act.numero} se superponen desde el ${fechaCorta(act.desde)}.`,
      );
    }
  }
  const ultimo = orden[orden.length - 1]!;
  if (ultimo.hasta !== fin) {
    errores.push(
      ultimo.hasta < fin
        ? `Del ${fechaCorta(sumarDiasIso(ultimo.hasta, 1))} al ${fechaCorta(fin)} no hay tramo.`
        : `El tramo ${ultimo.numero} termina el ${fechaCorta(ultimo.hasta)}, después que el contrato.`,
    );
  }
  return errores;
}

// --- Indexación (reglas 5 a 7) ----------------------------------------------------

export type IndiceConFuente = 'ICL' | 'IPC';

/**
 * Regla 5: el importe de un tramo indexado es el del tramo ANTERIOR por la
 * relación entre el índice al empezar este tramo y al empezar el anterior,
 * redondeado a peso entero. Se encadena sobre lo que efectivamente se cobró.
 *
 * Verificado contra los tramos ya indexados de Vacker en Gexion: con los
 * valores oficiales, IPC 23 de 25 exactos y ICL 61 de 109 exactos más 31 a
 * menos del 0,005% (lo que mueven los dos decimales con que se publica el
 * ICL). Calcularlo desde el importe inicial da 16/25 y 41/109.
 */
export function importeIndexado(
  importeAnterior: number,
  valorAnterior: number,
  valorNuevo: number,
): number {
  if (!(valorAnterior > 0))
    throw new Error('El valor anterior del índice tiene que ser mayor que cero.');
  return Math.round(redondear2((importeAnterior * valorNuevo) / valorAnterior));
}

/**
 * La fecha del valor del índice que corresponde a un tramo que empieza en
 * `desde` (regla 5). El ICL es diario: el del mismo día. El IPC es mensual y
 * se toma el del mes anterior, guardado como su primer día: un tramo que
 * empieza el 15/12/2025 usa el IPC de noviembre (`2025-11-01`).
 *
 * Para el segundo tramo, el «anterior» es el primero, que empieza con el
 * contrato: por eso no hace falta guardar un período base.
 */
export function fechaDelIndice(indice: IndiceConFuente, desde: string): string {
  if (indice === 'ICL') return desde;
  return sumarMesesIso(`${desde.slice(0, 7)}-01`, -1);
}

/** `agosto de 2026`, para nombrar un IPC que falta. */
export function mesLargo(iso: string): string {
  const MESES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

export type PropuestaIndexacion =
  | {
      estado: 'lista';
      fechaBase: string;
      valorBase: number;
      fechaRequerida: string;
      valorRequerido: number;
      importe: number;
    }
  /** Regla 7: el índice todavía no se publicó. No es una indexación vencida. */
  | { estado: 'pendiente_indice'; fechaBase: string; fechaRequerida: string; falta: string[] }
  /** Casa Propia, o cualquier índice sin fuente: el importe se carga a mano. */
  | { estado: 'manual' };

/**
 * Lo que el sistema propone para un tramo (regla 6: proponer no es aplicar).
 * `valor` busca un valor cargado del índice por fecha; `undefined` si no está.
 */
export function proponerIndexacion(
  indice: string,
  anterior: { desde: string; importe: number },
  tramo: { desde: string },
  valor: (indice: IndiceConFuente, fecha: string) => number | undefined,
): PropuestaIndexacion {
  if (indice !== 'ICL' && indice !== 'IPC') return { estado: 'manual' };
  const fechaBase = fechaDelIndice(indice, anterior.desde);
  const fechaRequerida = fechaDelIndice(indice, tramo.desde);
  const valorBase = valor(indice, fechaBase);
  const valorRequerido = valor(indice, fechaRequerida);
  if (valorBase === undefined || valorRequerido === undefined) {
    const nombre = (f: string) =>
      indice === 'ICL' ? `el ICL del ${fechaCorta(f)}` : `el IPC de ${mesLargo(f)}`;
    const falta = [
      valorBase === undefined ? fechaBase : null,
      valorRequerido === undefined ? fechaRequerida : null,
    ]
      .filter((f): f is string => f !== null)
      .map(nombre);
    return { estado: 'pendiente_indice', fechaBase, fechaRequerida, falta };
  }
  return {
    estado: 'lista',
    fechaBase,
    valorBase,
    fechaRequerida,
    valorRequerido,
    importe: importeIndexado(anterior.importe, valorBase, valorRequerido),
  };
}

/** Día del mes desde el que el IPC del mes anterior ya tendría que estar. */
export const DIA_IPC_PUBLICADO = 20;

/**
 * Regla 8: cuándo avisar que un índice no se está actualizando. Devuelve el
 * aviso en palabras, o `null` si está todo bien.
 *
 * - ICL: el BCRA publica un valor por día, así que pasar más de 3 días sin
 *   cargar ninguno nuevo quiere decir que la fuente no responde.
 * - IPC: el INDEC lo publica a mediados del mes siguiente; pasado el día 20,
 *   el del mes anterior tendría que estar.
 *
 * `ultimaCarga` es el día en que entró el último valor nuevo; `ultimaFecha`,
 * la fecha del último valor.
 */
export function alertaIndice(
  indice: IndiceConFuente,
  ultimaFecha: string | null,
  ultimaCarga: string | null,
  hoy: string,
): string | null {
  if (ultimaFecha === null || ultimaCarga === null)
    return `Todavía no hay valores del ${indice} cargados.`;
  if (indice === 'ICL') {
    return diasInclusive(ultimaCarga, hoy) - 1 > 3
      ? `El ICL no trae valores nuevos desde el ${fechaCorta(ultimaCarga)}. Las indexaciones que lo necesiten van a quedar pendientes.`
      : null;
  }
  const mesAnterior = sumarMesesIso(`${hoy.slice(0, 7)}-01`, -1);
  return Number(hoy.slice(8, 10)) > DIA_IPC_PUBLICADO && ultimaFecha < mesAnterior
    ? `El IPC de ${mesLargo(mesAnterior)} ya tendría que estar publicado y no se cargó.`
    : null;
}

// --- Partes (regla 4) -------------------------------------------------------------

export interface ParteCalc {
  personaId: string;
  papel: 'propietario' | 'inquilino' | 'garante';
  porcentaje?: number | null;
}

/**
 * Regla 4 y lo mínimo de un contrato: al menos un propietario y un inquilino,
 * nadie repetido en el mismo papel, y los porcentajes de los propietarios
 * suman exactamente 100. Un único propietario sin porcentaje cuenta como 100.
 */
export function validarPartes(partes: ParteCalc[]): string[] {
  const errores: string[] = [];
  const propietarios = partes.filter((p) => p.papel === 'propietario');
  if (propietarios.length === 0) errores.push('Falta el propietario.');
  if (!partes.some((p) => p.papel === 'inquilino')) errores.push('Falta el inquilino.');

  const vistas = new Set<string>();
  for (const p of partes) {
    const clave = `${p.personaId}:${p.papel}`;
    if (vistas.has(clave)) errores.push('Hay una persona cargada dos veces con el mismo papel.');
    vistas.add(clave);
  }

  if (propietarios.length > 1 || propietarios.some((p) => p.porcentaje != null)) {
    // En centésimos, para que 33,33 + 33,33 + 33,34 dé 100 y no 99,99999.
    const suma = propietarios.reduce((s, p) => s + Math.round((p.porcentaje ?? 0) * 100), 0);
    if (suma !== 10_000) {
      errores.push(
        `Los porcentajes de los propietarios suman ${(suma / 100).toLocaleString('es-AR')}%, y tienen que sumar 100%.`,
      );
    }
  }
  return errores;
}

// --- El mes calendario (regla 13) -------------------------------------------------

export interface ParteDelMes {
  tramo: number;
  desde: string;
  hasta: string;
  dias: number;
  diasDelMes: number;
  /** `null` si el tramo no está indexado: esa parte no se puede cobrar todavía (regla 11). */
  importe: number | null;
  /** Si es una parte del mes y no el mes entero. */
  proporcional: boolean;
}

/**
 * Regla 13: lo que se cobra en un mes calendario. Si en el mes empieza o
 * termina el contrato, o cambia el tramo, cada parte se cobra proporcional a
 * sus días sobre los días del mes, con centavos.
 *
 * Verificado en Gexion: un contrato que cambia de tramo el 15/08/2026 genera
 * 1.043.387 × 14/31 = 471.207,03 y 1.137.518 × 17/31 = 623.800,19.
 */
export function partesDelMes(anio: number, mes: number, tramos: TramoConImporte[]): ParteDelMes[] {
  const total = diasDelMes(anio, mes);
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = `${anio}-${String(mes).padStart(2, '0')}-${String(total).padStart(2, '0')}`;
  return tramos
    .filter((t) => t.desde <= ultimo && t.hasta >= primero)
    .sort((a, b) => (a.desde < b.desde ? -1 : 1))
    .map((t) => {
      const desde = t.desde > primero ? t.desde : primero;
      const hasta = t.hasta < ultimo ? t.hasta : ultimo;
      const dias = diasInclusive(desde, hasta);
      const proporcional = dias !== total;
      return {
        tramo: t.numero,
        desde,
        hasta,
        dias,
        diasDelMes: total,
        importe:
          t.importe == null
            ? null
            : proporcional
              ? redondear2((t.importe * dias) / total)
              : t.importe,
        proporcional,
      };
    });
}

// --- Honorarios y gastos (regla 12) -----------------------------------------------

/**
 * Regla 12: honorarios o gastos administrativos sobre un alquiler, con el IVA
 * de la inmobiliaria. Primero el neto, redondeado a centavos; después el IVA
 * sobre ese neto. Es lo que hace Gexion, y no da lo mismo que aplicar el
 * porcentaje con IVA de una vez: sobre 513.717,81 al 2% con 21%, Gexion cobra
 * 12.431,98 (10.274,36 × 1,21); el 2,42% directo daría 12.431,97.
 */
export function cargoConIva(alquiler: number, porcentaje: number, ivaPct: number): number {
  const neto = redondear2((alquiler * porcentaje) / 100);
  return redondear2(neto * (1 + ivaPct / 100));
}

// --- Vencimientos (regla 37) --------------------------------------------------------

/**
 * El vencimiento de un mes: el día pedido (o el último del mes, si es más
 * corto) y, si cae sábado o domingo, el lunes siguiente. Los feriados NO se
 * corren, igual que en Gexion: el 12/10/2026 queda el 12.
 */
export function vencimientoDelMes(periodo: string, dia: number): string {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  const fecha = `${periodo}-${String(Math.min(dia, diasDelMes(anio, mes))).padStart(2, '0')}`;
  const diaSemana = new Date(aUtc(fecha)).getUTCDay(); // 0 domingo, 6 sábado
  return diaSemana === 6
    ? sumarDiasIso(fecha, 2)
    : diaSemana === 0
      ? sumarDiasIso(fecha, 1)
      : fecha;
}

// --- Generación del período (reglas 9 a 13) ---------------------------------------

export type TipoConceptoGenerado = 'alquiler' | 'gastos_adm' | 'honorarios' | 'iva';
export type SentidoConcepto = 'a_cobrar' | 'a_pagar';

export interface ContratoParaGenerar {
  id: string;
  moneda: string;
  inicio: string;
  fin: string;
  /** Si está rescindido: desde el mes siguiente a esta fecha no se genera nada (regla 3). */
  rescindidoEl: string | null;
  diaVencimiento: number;
  diaPagoPropietario: number;
  honorariosPct: number;
  gastosAdmPct: number;
  /** IVA del alquiler, a cargo del inquilino. Ningún contrato de Vacker lo tiene. */
  ivaPct: number;
  tramos: TramoConImporte[];
  propietarios: { personaId: string; porcentaje: number }[];
  /** El primero es el titular: a él se le generan los cargos. */
  inquilinos: { personaId: string }[];
}

export interface ConceptoGenerado {
  /** Única por inmobiliaria: generar dos veces el mismo mes no duplica (regla 10). */
  clave: string;
  personaId: string;
  tipo: TipoConceptoGenerado;
  sentido: SentidoConcepto;
  moneda: string;
  periodo: string;
  vencimiento: string;
  importe: number;
  descripcion: string;
}

export interface ResultadoPeriodo {
  conceptos: ConceptoGenerado[];
  /** Partes del mes cuyo tramo no está indexado: no se generan (regla 11). */
  sinIndexar: ParteDelMes[];
}

/**
 * Reparte un importe según porcentajes, con centavos, y sin perder ni
 * inventar un centavo: lo que sobra del redondeo va, de a uno, a los que más
 * fracción perdieron. Dos dueños al 50% de 100.000,01 cobran 50.000,01 y
 * 50.000, no 50.000,01 cada uno.
 */
export function repartir(importe: number, porcentajes: number[]): number[] {
  const centavos = Math.round(importe * 100);
  const exactos = porcentajes.map((p) => (centavos * p) / 100);
  const base = exactos.map((x) => Math.floor(x + 1e-9));
  let resto = centavos - base.reduce((s, x) => s + x, 0);
  const orden = exactos.map((x, i) => [x - base[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of orden) {
    if (resto <= 0) break;
    base[i]! += 1;
    resto -= 1;
  }
  return base.map((c) => c / 100);
}

const NOMBRE_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Reglas 9 a 13: lo que genera un contrato en un mes calendario.
 *
 * Por cada parte del mes (una, o dos si cambia el tramo; proporcional si el
 * contrato empieza o termina en el mes):
 * - alquiler a cobrar al inquilino titular y a pagar a cada propietario, según
 *   su porcentaje;
 * - gastos administrativos a cobrar al inquilino y honorarios a cobrarle a
 *   cada propietario (se le descuentan al liquidar), con el IVA de la
 *   inmobiliaria, neto redondeado primero (regla 12);
 * - IVA del alquiler, si el contrato lo tiene: a cobrar al inquilino y a pagar
 *   al propietario, que es quien lo factura.
 *
 * Un porcentaje en cero no genera un concepto en cero. Una parte cuyo tramo no
 * está indexado no genera nada y vuelve en `sinIndexar` (regla 11): no se
 * cobra un importe viejo por defecto.
 */
export function generarPeriodo(
  c: ContratoParaGenerar,
  periodo: string,
  ivaInmobiliariaPct: number,
): ResultadoPeriodo {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  const ultimoDelMes = `${periodo}-${String(diasDelMes(anio, mes)).padStart(2, '0')}`;
  // Regla 3: rescindido, se genera hasta el mes de la rescisión inclusive.
  if (c.rescindidoEl && c.rescindidoEl.slice(0, 7) < periodo)
    return { conceptos: [], sinIndexar: [] };
  const inquilino = c.inquilinos[0];
  if (!inquilino || c.propietarios.length === 0) return { conceptos: [], sinIndexar: [] };

  const fin = c.fin < ultimoDelMes ? c.fin : ultimoDelMes;
  const tramos = c.tramos
    .filter((t) => t.desde <= fin)
    .map((t) => ({ ...t, hasta: t.hasta < fin ? t.hasta : fin }));
  const partes = partesDelMes(anio, mes, tramos);

  const vencInquilino = vencimientoDelMes(periodo, c.diaVencimiento);
  const vencPropietario = vencimientoDelMes(periodo, c.diaPagoPropietario);
  const mesTexto = `${NOMBRE_MES[mes - 1]} ${anio}`;
  const conceptos: ConceptoGenerado[] = [];
  const sinIndexar: ParteDelMes[] = [];

  for (const p of partes) {
    if (p.importe == null) {
      sinIndexar.push(p);
      continue;
    }
    const cuando = p.proporcional
      ? `${fechaCorta(p.desde).slice(0, 5)} al ${fechaCorta(p.hasta)} (${p.dias}/${p.diasDelMes} días)`
      : mesTexto;
    const nuevo = (
      papel: 'inquilino' | 'propietario',
      tipo: TipoConceptoGenerado,
      sentido: SentidoConcepto,
      personaId: string,
      importe: number,
      nombre: string,
    ) => {
      if (!(importe > 0)) return;
      conceptos.push({
        clave: `alq|${c.id}|${periodo}|${p.desde}|${tipo}|${sentido}|${personaId}`,
        personaId,
        tipo,
        sentido,
        moneda: c.moneda,
        periodo,
        vencimiento: papel === 'inquilino' ? vencInquilino : vencPropietario,
        importe,
        descripcion: `${nombre} ${cuando}`,
      });
    };

    nuevo('inquilino', 'alquiler', 'a_cobrar', inquilino.personaId, p.importe, 'Alquiler');
    nuevo(
      'inquilino',
      'gastos_adm',
      'a_cobrar',
      inquilino.personaId,
      cargoConIva(p.importe, c.gastosAdmPct, ivaInmobiliariaPct),
      'Gastos administrativos',
    );
    const ivaAlquiler = redondear2((p.importe * c.ivaPct) / 100);
    nuevo('inquilino', 'iva', 'a_cobrar', inquilino.personaId, ivaAlquiler, 'IVA del alquiler');

    const porcentajes = c.propietarios.map((x) => x.porcentaje);
    const alquileres = repartir(p.importe, porcentajes);
    const ivas = repartir(ivaAlquiler, porcentajes);
    c.propietarios.forEach((dueno, i) => {
      nuevo('propietario', 'alquiler', 'a_pagar', dueno.personaId, alquileres[i]!, 'Alquiler');
      nuevo('propietario', 'iva', 'a_pagar', dueno.personaId, ivas[i]!, 'IVA del alquiler');
      nuevo(
        'propietario',
        'honorarios',
        'a_cobrar',
        dueno.personaId,
        cargoConIva(alquileres[i]!, c.honorariosPct, ivaInmobiliariaPct),
        'Honorarios',
      );
    });
  }
  return { conceptos, sinIndexar };
}

// --- Cobros (reglas 15 a 17) ------------------------------------------------------

/** Algo que se puede imputar, con lo que todavía le falta. */
export interface PendienteDeCobro {
  conceptoId: string;
  saldo: number;
}

export interface ImputacionPlaneada {
  /** De qué cobro sale la plata: `null` es el cobro que se está registrando. */
  cobroId: string | null;
  conceptoId: string;
  importe: number;
}

export interface PlanCobro {
  imputaciones: ImputacionPlaneada[];
  /** Reintegros a favor de la persona que se compensaron contra su deuda. */
  compensado: number;
  /** Lo que se usó de cobros anteriores que habían sobrado (regla 17). */
  saldoAFavorUsado: number;
  /** Lo que sobra del cobro nuevo: queda a favor para el próximo (regla 17). */
  sobrante: number;
}

const aCentavos = (n: number) => Math.round(n * 100);

/**
 * Reglas 15 y 17: cómo se reparte un cobro.
 *
 * `deudas` llega en el orden en que se cancela —del vencimiento más viejo al
 * más nuevo, o solo las que eligió la persona— y la última puede quedar
 * parcial. La plata sale, en este orden:
 * 1. del saldo a favor de cobros anteriores, del más viejo al más nuevo;
 * 2. de los reintegros que se le deben a la persona (`compensables`: un gasto
 *    del dueño que pagó el inquilino), hasta donde alcance la deuda;
 * 3. del cobro nuevo. Lo que sobre de este queda a favor.
 *
 * Todo en centavos enteros: un cobro de 360.000 con un reintegro de 140.699 no
 * puede dejar 0,0000001 colgando.
 */
export function planificarCobro(p: {
  importe: number;
  creditos: { cobroId: string; disponible: number }[];
  compensables: PendienteDeCobro[];
  deudas: PendienteDeCobro[];
}): PlanCobro {
  const imputaciones: ImputacionPlaneada[] = [];
  let deudaTotal = p.deudas.reduce((s, d) => s + aCentavos(d.saldo), 0);

  const fuentes: { cobroId: string | null; centavos: number }[] = p.creditos.map((c) => ({
    cobroId: c.cobroId,
    centavos: aCentavos(c.disponible),
  }));
  const usadoDeCreditos = Math.min(
    deudaTotal,
    fuentes.reduce((s, f) => s + f.centavos, 0),
  );

  let compensado = 0;
  let porCompensar = deudaTotal - usadoDeCreditos;
  for (const c of p.compensables) {
    const monto = Math.min(aCentavos(c.saldo), porCompensar);
    if (monto <= 0) break;
    imputaciones.push({ cobroId: null, conceptoId: c.conceptoId, importe: monto / 100 });
    compensado += monto;
    porCompensar -= monto;
  }
  const nuevo = { cobroId: null, centavos: aCentavos(p.importe) + compensado };
  fuentes.push(nuevo);

  let f = 0;
  for (const d of p.deudas) {
    let falta = aCentavos(d.saldo);
    while (falta > 0 && f < fuentes.length) {
      const fuente = fuentes[f]!;
      const monto = Math.min(falta, fuente.centavos);
      if (monto > 0) {
        const previa = imputaciones.find(
          (i) => i.cobroId === fuente.cobroId && i.conceptoId === d.conceptoId,
        );
        if (previa) previa.importe = (aCentavos(previa.importe) + monto) / 100;
        else
          imputaciones.push({
            cobroId: fuente.cobroId,
            conceptoId: d.conceptoId,
            importe: monto / 100,
          });
        fuente.centavos -= monto;
        falta -= monto;
        deudaTotal -= monto;
      }
      if (fuente.centavos === 0) f++;
    }
  }
  return {
    imputaciones,
    compensado: compensado / 100,
    saldoAFavorUsado: usadoDeCreditos / 100,
    sobrante: nuevo.centavos / 100,
  };
}

/**
 * Regla 16: el punitorio que se propone por pagar tarde. Saldo del alquiler ×
 * tasa diaria × días de atraso, con centavos. Los días se cuentan desde el
 * vencimiento o, si ya se cobró un punitorio por ese alquiler, desde ese
 * último: un pago parcial no hace cobrar dos veces los mismos días.
 */
export function proponerPunitorio(
  saldo: number,
  desde: string,
  fecha: string,
  tasaDiariaPct: number,
): { dias: number; importe: number } {
  const dias = Math.max(0, diasInclusive(desde, fecha) - 1);
  return {
    dias,
    importe:
      dias === 0 || tasaDiariaPct <= 0 ? 0 : redondear2((saldo * tasaDiariaPct * dias) / 100),
  };
}

// --- Liquidación al propietario (reglas 20 a 22) -----------------------------------

/**
 * La parte del mes de un concepto generado: `alq|contrato|periodo|desde`. El
 * alquiler a cobrar al inquilino, el alquiler a pagar a cada propietario y sus
 * honorarios de la misma parte la comparten; es lo que los une.
 */
export function parteDeClave(clave: string | null): string | null {
  if (!clave?.startsWith('alq|')) return null;
  return clave.split('|').slice(0, 4).join('|');
}

/** Un concepto pendiente de un propietario, como lo mira la liquidación. */
export interface ConceptoALiquidar {
  id: string;
  tipo: string;
  sentido: 'a_cobrar' | 'a_pagar';
  saldo: number;
  clave: string | null;
  pagoGarantizado: boolean;
  /**
   * Lo que ya se le liquidó de este concepto en liquidaciones anteriores, por
   * pagos parciales del inquilino (regla 22). El total del concepto es este
   * más su saldo.
   */
  yaLiquidado?: number;
  /**
   * En la propuesta: solo una parte del saldo entra ahora (el resto queda en
   * espera). La liquidación lo parte en dos al guardarse.
   */
  parcial?: boolean;
}

export interface PropuestaLiquidacion {
  /** Lo que se le paga: alquileres (y su IVA) ya cobrados al inquilino, reintegros. */
  aPagar: ConceptoALiquidar[];
  /** Lo que se le descuenta: honorarios de esos alquileres, gastos suyos. */
  aDescontar: ConceptoALiquidar[];
  /** En espera: lo que el inquilino todavía no pagó de esa parte (regla 22). */
  enEspera: ConceptoALiquidar[];
  neto: number;
}

const QUE_ESPERAN_AL_INQUILINO = ['alquiler', 'iva'];

/**
 * Cuánto de un concepto del propietario se libera con lo que pagó el
 * inquilino: la misma proporción del total, menos lo que ya se le liquidó.
 */
function liberable(c: ConceptoALiquidar, fraccion: number): number {
  if (fraccion >= 1) return c.saldo;
  if (fraccion <= 0) return 0;
  const ya = aCentavos(c.yaLiquidado ?? 0);
  const total = aCentavos(c.saldo) + ya;
  const objetivo = Math.round(total * fraccion);
  return Math.max(0, Math.min(aCentavos(c.saldo), objetivo - ya)) / 100;
}

/**
 * Reglas 20 a 22: qué entra en la liquidación de un propietario.
 *
 * - Su alquiler (y el IVA del alquiler) entra en la proporción que el
 *   inquilino ya pagó de esa misma parte del mes (regla 22): si pagó la mitad,
 *   se le liquida la mitad y el resto queda en espera. Con pago garantizado
 *   entra entero (regla 21).
 * - Los honorarios de una parte se descuentan en la misma proporción que su
 *   alquiler.
 * - Lo demás que debe el propietario (una reparación, un impuesto) se
 *   descuenta; lo que se le debe (un reintegro) se le paga.
 *
 * `cobrado` dice, por parte y tipo (`alq|c|2026-11|2026-11-01#alquiler`),
 * qué fracción del concepto del inquilino ya está pagada (0 a 1). Un `Set`
 * vale como «pagadas del todo».
 */
export function proponerLiquidacion(
  conceptos: ConceptoALiquidar[],
  cobrado: ReadonlyMap<string, number> | ReadonlySet<string>,
): PropuestaLiquidacion {
  const fraccionDe = (clave: string): number =>
    cobrado instanceof Map
      ? (cobrado.get(clave) ?? 0)
      : (cobrado as ReadonlySet<string>).has(clave)
        ? 1
        : 0;
  const aPagar: ConceptoALiquidar[] = [];
  const aDescontar: ConceptoALiquidar[] = [];
  const enEspera: ConceptoALiquidar[] = [];
  /** Qué fracción del alquiler de cada parte entra en esta liquidación. */
  const fraccionAlquiler = new Map<string, number>();

  /** Lo liberable va a `destino`; el resto, a la espera. */
  const repartir = (c: ConceptoALiquidar, monto: number, destino: ConceptoALiquidar[]) => {
    if (monto >= c.saldo) destino.push(c);
    else if (monto <= 0) enEspera.push(c);
    else {
      destino.push({ ...c, saldo: monto, parcial: true });
      enEspera.push({ ...c, saldo: redondear2(c.saldo - monto) });
    }
  };

  for (const c of conceptos.filter((x) => x.sentido === 'a_pagar')) {
    const parte = parteDeClave(c.clave);
    if (parte && QUE_ESPERAN_AL_INQUILINO.includes(c.tipo)) {
      const fraccion = c.pagoGarantizado ? 1 : fraccionDe(`${parte}#${c.tipo}`);
      if (c.tipo === 'alquiler') fraccionAlquiler.set(parte, fraccion);
      repartir(c, liberable(c, fraccion), aPagar);
    } else {
      aPagar.push(c);
    }
  }
  for (const c of conceptos.filter((x) => x.sentido === 'a_cobrar')) {
    const parte = parteDeClave(c.clave);
    if (c.tipo === 'honorarios' && parte) {
      repartir(c, liberable(c, fraccionAlquiler.get(parte) ?? 0), aDescontar);
    } else {
      aDescontar.push(c);
    }
  }
  const suma = (xs: ConceptoALiquidar[]) => xs.reduce((s, x) => s + aCentavos(x.saldo), 0);
  return { aPagar, aDescontar, enEspera, neto: (suma(aPagar) - suma(aDescontar)) / 100 };
}

// --- Tablero (regla 29) --------------------------------------------------------------

/** El tramo de antigüedad de una deuda, por días desde el vencimiento. */
export function tramoDeMora(dias: number): '1-30' | '31-60' | '61-90' | '90+' {
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
}

// --- Firma del contrato (reglas 33 y 34) ---------------------------------------------

export type EstadoFirma =
  'sin_enviar' | 'enviado' | 'firmado_parcial' | 'firmado' | 'rechazado' | 'vencido';
export type EstadoFirmante = 'pendiente' | 'firmado' | 'rechazado';

/**
 * Regla 33: el estado del documento sale de sus firmantes. Alguien rechazó:
 * rechazado. Firmaron todos: firmado. Algunos: firmado en parte. Nadie
 * todavía: queda como estaba (sin enviar, enviado o vencido).
 */
export function estadoDeFirma(actual: EstadoFirma, firmantes: EstadoFirmante[]): EstadoFirma {
  if (firmantes.some((f) => f === 'rechazado')) return 'rechazado';
  if (firmantes.length > 0 && firmantes.every((f) => f === 'firmado')) return 'firmado';
  if (firmantes.some((f) => f === 'firmado')) return 'firmado_parcial';
  return actual === 'firmado' || actual === 'firmado_parcial' || actual === 'rechazado'
    ? 'enviado'
    : actual;
}

// --- Contrato desde plantilla (entrega 15) ----------------------------------------------

const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const DECENAS = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function hastaMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto =
    r < 30
      ? UNIDADES[r]!
      : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` y ${UNIDADES[r % 10]}` : ''}`;
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
}

/**
 * Un número entero en letras, como se escribe en un contrato: 350000 →
 * «trescientos cincuenta mil». «Uno» delante de «mil» se dice «un» y antes de
 * un sustantivo se apocopa («veintiún mil»).
 */
export function enLetras(n: number): string {
  const entero = Math.floor(Math.abs(n));
  if (entero === 0) return 'cero';
  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;
  const apocope = (t: string) => t.replace(/uno$/, 'ún').replace(/^ún$/, 'un');
  const partes: string[] = [];
  if (millones)
    partes.push(millones === 1 ? 'un millón' : `${apocope(enLetras(millones))} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocope(hastaMil(miles))} mil`);
  if (resto) partes.push(hastaMil(resto));
  return partes.join(' ');
}

/** «$ 350.000,00 (pesos trescientos cincuenta mil)». */
export function importeEnLetras(n: number, moneda: 'ARS' | 'USD'): string {
  const centavos = Math.round((n - Math.floor(n)) * 100);
  const signo = moneda === 'USD' ? 'dólares estadounidenses' : 'pesos';
  return `${signo} ${enLetras(n)}${centavos ? ` con ${centavos}/100` : ''}`;
}

/**
 * Reemplaza las variables `{{así}}` de una plantilla. La que no existe queda
 * a la vista entre corchetes, para que se note antes de mandar a firmar.
 */
export function completarPlantilla(cuerpo: string, valores: Record<string, string>): string {
  // `Object.hasOwn`: «{{constructor}}» no tiene que imprimir el código de una función.
  return cuerpo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave: string) =>
    Object.hasOwn(valores, clave) ? valores[clave]! : `[falta: ${clave}]`,
  );
}

/**
 * El alquiler que rige hoy: el del último tramo ya empezado que tiene importe.
 * Si el tramo de hoy espera indexación, sigue el anterior —es lo que se cobra
 * mientras tanto—, no «—». Una sola definición para el tablero, la lista de
 * contratos y la persona (revisión del 6/10/2026: daban distinto).
 */
export function alquilerDeHoy(
  tramos: { desde: string; importe: number | null }[],
  hoy: string,
): number | null {
  const empezados = tramos
    .filter((t) => t.importe != null && t.desde <= hoy)
    .sort((a, b) => (a.desde < b.desde ? -1 : 1));
  return empezados.at(-1)?.importe ?? null;
}

/**
 * El próximo cambio de alquiler: el primer tramo sin importe (si ya empezó,
 * la indexación está vencida) o el primero que todavía no empezó —el escalón
 * de un escalonado—. El primer tramo no cuenta: es el de inicio.
 */
export function proximoCambio(
  tramos: { numero: number; desde: string; importe: number | null }[],
  hoy: string,
): string | null {
  const t = [...tramos]
    .sort((a, b) => a.numero - b.numero)
    .find((x) => x.numero > 1 && (x.importe == null || x.desde > hoy));
  return t?.desde ?? null;
}
