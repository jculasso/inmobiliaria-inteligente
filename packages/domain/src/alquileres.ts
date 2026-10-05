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
    if (t.hasta < t.desde) errores.push(`El tramo ${t.numero} termina (${fechaCorta(t.hasta)}) antes de empezar (${fechaCorta(t.desde)}).`);
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
      errores.push(`Del ${fechaCorta(esperado)} al ${fechaCorta(sumarDiasIso(act.desde, -1))} no hay tramo.`);
    } else if (act.desde < esperado) {
      errores.push(`Los tramos ${prev.numero} y ${act.numero} se superponen desde el ${fechaCorta(act.desde)}.`);
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

/**
 * Regla 5: el importe indexado sale del importe INICIAL del contrato por la
 * variación acumulada del índice, redondeado a peso entero. Nunca encadenando
 * sobre el tramo anterior: así el redondeo de un tramo no se arrastra.
 */
export function importeIndexado(importeInicial: number, valorBase: number, valorRequerido: number): number {
  if (!(valorBase > 0)) throw new Error('El valor base del índice tiene que ser mayor que cero.');
  return Math.round(redondear2((importeInicial * valorRequerido) / valorBase));
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
      errores.push(`Los porcentajes de los propietarios suman ${(suma / 100).toLocaleString('es-AR')}%, y tienen que sumar 100%.`);
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
        importe: t.importe == null ? null : proporcional ? redondear2((t.importe * dias) / total) : t.importe,
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
