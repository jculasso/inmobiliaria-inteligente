// El informe al propietario (spec alquileres-fase-1.md, reglas 83 a 97).
//
// Javier, 7/10/2026: «un reporte para el propietario, donde le podemos
// detallar los alquileres que cobró, los honorarios que pagó, los impuestos
// que se le hayan descontado o expensas extraordinarias y las atenciones con
// proveedores que tuvo su propiedad».
//
// No inventa reglas: mira los mismos conceptos que la liquidación, con la
// misma propuesta (`proponerLiquidacion`), y los parte en lo que ya se le
// liquidó, lo que se liquida la próxima vez y lo que espera al inquilino. Así
// la cadena del informe cierra al centavo y dice lo mismo que la pantalla de
// liquidaciones.

import { diasDelMes, proponerLiquidacion, redondear2, type ConceptoALiquidar } from './alquileres';

/**
 * Lo que un propietario puede deber por fuera de los honorarios: los gastos
 * sueltos (regla 14). Lo usan la liquidación —para saber qué se le descuenta—
 * y el informe —para mostrarlo—: una sola lista para los dos.
 */
export const GASTOS_DEL_PROPIETARIO = [
  'expensa',
  'impuesto',
  'servicio',
  'reparacion',
  'otro',
  'comision',
  'informe',
  'deposito',
  'sellado',
] as const;

/** Lo que se le descuenta al propietario al liquidar: sus honorarios y sus gastos. */
export const TIPOS_QUE_SE_LE_DESCUENTAN: readonly string[] = [
  'honorarios',
  ...GASTOS_DEL_PROPIETARIO,
];

/**
 * Marca en la clave de la parte que se separa al liquidar un pago parcial
 * (regla 22): `<clave del concepto>|liq:<liquidación>`.
 */
export const MARCA_PARTE_LIQUIDADA = '|liq:';

/** En qué renglón del informe cae un concepto del propietario. */
export type CategoriaInforme =
  'alquiler' | 'reintegros' | 'honorarios' | 'impuestos' | 'expensas' | 'arreglos' | 'otros';

/** Los descuentos, en el orden en que los lee el propietario (regla 91). */
export const CATEGORIAS_DESCUENTO = [
  'honorarios',
  'impuestos',
  'expensas',
  'arreglos',
  'otros',
] as const satisfies readonly CategoriaInforme[];

/**
 * El renglón de un concepto. Su alquiler (y el IVA del alquiler, que también
 * es suyo y espera al inquilino igual que el alquiler) es «alquiler»; lo demás
 * que se le paga, un reintegro. De lo que se le descuenta: impuestos y
 * servicios juntos, las expensas aparte —las extraordinarias son un servicio
 * más del catálogo, con su nombre—, los arreglos de proveedores y el resto.
 * `null`: no es del propietario como tal (no entra en el informe).
 */
export function categoriaDelInforme(tipo: string, sentido: string): CategoriaInforme | null {
  if (sentido === 'a_pagar')
    return tipo === 'alquiler' || tipo === 'iva' ? 'alquiler' : 'reintegros';
  if (sentido !== 'a_cobrar' || !TIPOS_QUE_SE_LE_DESCUENTAN.includes(tipo)) return null;
  if (tipo === 'honorarios') return 'honorarios';
  if (tipo === 'impuesto' || tipo === 'servicio') return 'impuestos';
  if (tipo === 'expensa') return 'expensas';
  if (tipo === 'reparacion') return 'arreglos';
  return 'otros';
}

/** Un concepto del propietario, tal como lo mira el informe. */
export interface ConceptoDelInforme {
  id: string;
  tipo: string;
  sentido: 'a_cobrar' | 'a_pagar';
  /**
   * Lo que pasa por la liquidación: el importe menos lo que se saldó por caja
   * (imputaciones de cobros activos). Lo que el propietario pagó él mismo, o se
   * compensó en un cobro, no se le descuenta ni se le transfiere.
   */
  base: number;
  /** Si ya entró en una liquidación que no se anuló. */
  liquidado: boolean;
  clave: string | null;
  /** La parte separada de un pago parcial apunta a su concepto original. */
  origenId: string | null;
  pagoGarantizado: boolean;
}

/** En qué está cada peso de un concepto. Las tres partes suman su `base`. */
export interface EstadoDelConcepto {
  /** Ya entró en una liquidación. */
  liquidado: number;
  /** Liberado y todavía sin liquidar: va en la próxima. */
  pendiente: number;
  /** Lo que espera a que pague el inquilino (regla 22). */
  espera: number;
}

const aCentavos = (n: number) => Math.round(n * 100);

/**
 * Parte cada concepto en liquidado, pendiente y en espera. Lo no liquidado
 * pasa por `proponerLiquidacion`, la misma propuesta que arma la pantalla de
 * liquidaciones: un alquiler se libera en la proporción que pagó el inquilino
 * (regla 22, o entero con pago garantizado, regla 21) y sus honorarios lo
 * siguen; los gastos se descuentan enteros.
 *
 * `cobrado` es la fracción pagada de cada parte del inquilino, como la arma
 * `fraccionesCobradas` en la API.
 */
export function estadosDelInforme(
  conceptos: ConceptoDelInforme[],
  cobrado: ReadonlyMap<string, number>,
): Map<string, EstadoDelConcepto> {
  const estados = new Map<string, EstadoDelConcepto>();
  // Lo que ya se le liquidó de cada concepto por pagos parciales: sus partes separadas.
  const yaLiquidado = new Map<string, number>();
  for (const k of conceptos)
    if (k.liquidado && k.origenId && k.clave?.includes(MARCA_PARTE_LIQUIDADA))
      yaLiquidado.set(k.origenId, redondear2((yaLiquidado.get(k.origenId) ?? 0) + k.base));

  const abiertos: ConceptoALiquidar[] = [];
  for (const k of conceptos) {
    if (k.liquidado) estados.set(k.id, { liquidado: k.base, pendiente: 0, espera: 0 });
    else if (k.base > 0)
      abiertos.push({
        id: k.id,
        tipo: k.tipo,
        sentido: k.sentido,
        saldo: k.base,
        clave: k.clave,
        pagoGarantizado: k.pagoGarantizado,
        yaLiquidado: yaLiquidado.get(k.id) ?? 0,
      });
    else estados.set(k.id, { liquidado: 0, pendiente: 0, espera: 0 });
  }
  const p = proponerLiquidacion(abiertos, cobrado);
  const sumar = (id: string, campo: keyof EstadoDelConcepto, monto: number) => {
    const e = estados.get(id) ?? { liquidado: 0, pendiente: 0, espera: 0 };
    e[campo] = redondear2(e[campo] + monto);
    estados.set(id, e);
  };
  for (const c of [...p.aPagar, ...p.aDescontar]) sumar(c.id, 'pendiente', c.saldo);
  for (const c of p.enEspera) sumar(c.id, 'espera', c.saldo);
  return estados;
}

/** La cadena del informe en una moneda (regla 87). */
export interface CadenaInforme {
  /** Su alquiler de los meses del período (y el IVA del alquiler, si lo tiene). */
  alquiler: number;
  /** De eso, lo que el inquilino todavía no pagó. */
  enEspera: number;
  /** Alquiler − en espera: lo que ya está para él. */
  cobrado: number;
  honorarios: number;
  impuestos: number;
  expensas: number;
  arreglos: number;
  otros: number;
  /** Lo que se le reconoce además del alquiler: un gasto suyo que pagó él, por ejemplo. */
  reintegros: number;
  /** Cobrado − descuentos + reintegros. */
  neto: number;
  /** La parte del neto que ya se le liquidó. */
  liquidado: number;
  /** La que va en la próxima liquidación. Negativa: se le descuenta en la próxima. */
  pendiente: number;
}

/** Un concepto con su renglón y su estado: lo que suma la cadena. */
export interface PartidaInforme extends EstadoDelConcepto {
  categoria: CategoriaInforme;
}

/**
 * Regla 87: la cadena, sumada en centavos.
 *
 *   alquiler − en espera = cobrado
 *   cobrado − honorarios − impuestos − expensas − arreglos − otros + reintegros = neto
 *   neto = liquidado + pendiente
 *
 * Lo que espera al inquilino no se cuenta en ningún lado salvo en «en
 * espera»: un honorario cuyo alquiler no se cobró todavía no se descontó.
 */
export function cadenaDelInforme(partidas: PartidaInforme[]): CadenaInforme {
  const c = {
    alquiler: 0,
    enEspera: 0,
    honorarios: 0,
    impuestos: 0,
    expensas: 0,
    arreglos: 0,
    otros: 0,
    reintegros: 0,
    liquidado: 0,
    pendiente: 0,
  };
  for (const p of partidas) {
    const liberado = aCentavos(p.liquidado) + aCentavos(p.pendiente);
    const signo = p.categoria === 'alquiler' || p.categoria === 'reintegros' ? 1 : -1;
    if (p.categoria === 'alquiler') {
      c.alquiler += liberado + aCentavos(p.espera);
      c.enEspera += aCentavos(p.espera);
    } else c[p.categoria] += liberado;
    c.liquidado += signo * aCentavos(p.liquidado);
    c.pendiente += signo * aCentavos(p.pendiente);
  }
  const cobrado = c.alquiler - c.enEspera;
  const neto =
    cobrado - c.honorarios - c.impuestos - c.expensas - c.arreglos - c.otros + c.reintegros;
  const pesos = (x: number) => x / 100;
  return {
    alquiler: pesos(c.alquiler),
    enEspera: pesos(c.enEspera),
    cobrado: pesos(cobrado),
    honorarios: pesos(c.honorarios),
    impuestos: pesos(c.impuestos),
    expensas: pesos(c.expensas),
    arreglos: pesos(c.arreglos),
    otros: pesos(c.otros),
    reintegros: pesos(c.reintegros),
    neto: pesos(neto),
    liquidado: pesos(c.liquidado),
    pendiente: pesos(c.pendiente),
  };
}

/** Suma cadenas de una misma moneda (los totales de la tabla de propietarios). */
export function sumarCadenas(cadenas: CadenaInforme[]): CadenaInforme {
  const claves = [
    'alquiler',
    'enEspera',
    'cobrado',
    'honorarios',
    'impuestos',
    'expensas',
    'arreglos',
    'otros',
    'reintegros',
    'neto',
    'liquidado',
    'pendiente',
  ] as const;
  const total = Object.fromEntries(claves.map((k) => [k, 0])) as unknown as CadenaInforme;
  for (const c of cadenas)
    for (const k of claves) total[k] = (aCentavos(total[k]) + aCentavos(c[k])) / 100;
  return total;
}

// --- El período del informe -------------------------------------------------------

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

/** Los meses `AAAA-MM` de `desde` a `hasta`, los dos incluidos. */
export function mesesDelRango(desde: string, hasta: string): string[] {
  const [a0, m0] = desde.split('-').map(Number) as [number, number];
  const [a1, m1] = hasta.split('-').map(Number) as [number, number];
  const meses: string[] = [];
  for (let t = a0 * 12 + m0 - 1; t <= a1 * 12 + m1 - 1; t++)
    meses.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
  return meses;
}

/** El último día de un mes `AAAA-MM`. */
export function ultimoDiaDelMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return `${mes}-${String(diasDelMes(a, m)).padStart(2, '0')}`;
}

/**
 * El período dicho como lo lee el propietario: «septiembre 2026», «julio a
 * septiembre 2026», «año 2026», «noviembre 2025 a enero 2026». Lo usan el
 * PDF, el asunto del mail y la pantalla.
 */
export function nombreDelRango(desde: string, hasta: string): string {
  const mes = (p: string) => NOMBRE_MES[Number(p.slice(5, 7)) - 1]!;
  const anio = (p: string) => p.slice(0, 4);
  if (desde === hasta) return `${mes(desde)} ${anio(desde)}`;
  if (anio(desde) === anio(hasta)) {
    if (desde.endsWith('-01') && hasta.endsWith('-12')) return `año ${anio(desde)}`;
    return `${mes(desde)} a ${mes(hasta)} ${anio(hasta)}`;
  }
  return `${mes(desde)} ${anio(desde)} a ${mes(hasta)} ${anio(hasta)}`;
}
