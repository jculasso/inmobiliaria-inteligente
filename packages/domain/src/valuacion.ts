// Análisis de comparables y valuación ponderada. Portado 1:1 del prototipo
// (Tasador_de_Propiedades_Vacker_Personal_Final_Corregido.html) — puro y
// compartido back/front. Trabaja con números (no strings de formulario).

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function median(values: number[]): number {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}
export function average(values: number[]): number {
  const a = values.filter(Number.isFinite);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}
export function standardDeviation(values: number[]): number {
  const a = values.filter(Number.isFinite);
  if (a.length < 2) return 0;
  const avg = average(a);
  return Math.sqrt(average(a.map((v) => (v - avg) ** 2)));
}

/** Ranking de estado del inmueble para medir similitud (Excelente=5 … A reciclar=1). */
function stateRank(value: string | null | undefined): number {
  return ({ Excelente: 5, 'Muy bueno': 4, Bueno: 3, Regular: 2, 'A reciclar': 1 } as Record<string, number>)[value ?? ''] ?? 3;
}

/** Meses transcurridos desde una fecha ISO (o null si no hay/está mal). */
function monthsOld(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth());
}

/** Superficies desglosadas de un inmueble o comparable. */
export interface Superficies {
  supCubierta?: number | null;
  supSemi?: number | null;
  supDescubierta?: number | null;
  supTerreno?: number | null;
  /** Valor único legacy, si no hay desglose. */
  superficie?: number | null;
}

/** Superficie construida ponderada: cubierta + semi + descubierta×0.3 (o el legacy si no hay desglose). */
function constructedSurface(s: Superficies): number {
  const built = num(s.supCubierta) + num(s.supSemi) + num(s.supDescubierta) * 0.3;
  return round2(built > 0 ? built : num(s.superficie));
}

/** Superficie de valuación según el tipo: Terreno usa el terreno; Cochera la construida o el terreno; resto la construida. */
export function valuationSurface(s: Superficies, tipo: string): number {
  if (tipo === 'Terreno') return round2(num(s.supTerreno) || constructedSurface(s));
  if (tipo === 'Cochera') return round2(constructedSurface(s) || num(s.supTerreno));
  return constructedSurface(s);
}

export interface ComparableCalc extends Superficies {
  tipoComp: string;
  precio?: number | null;
  dormitorios?: number | null;
  banos?: number | null;
  estado?: string | null;
  /** 'Sí' | 'No' */
  cocheraComp?: string | null;
  /** Publicación | Cierre real | Colega | Mapa de cierres | Otro */
  fuente?: string | null;
  /** Publicado | Cierre */
  tipoPrecio?: string | null;
  fechaReferencia?: string | null;
}

export interface PropiedadCalc extends Superficies {
  tipoPropiedad: string;
  dormitorios?: number | null;
  banos?: number | null;
  estado?: string | null;
  /** Cantidad de cocheras (o boolean). */
  cochera?: number | boolean | null;
}

/** Puntaje de similitud 0-100 entre un comparable y la propiedad tasada. */
export function comparableSimilarity(c: ComparableCalc, data: PropiedadCalc, targetSurface: number): number {
  let score = 0;
  const cSurface = valuationSurface(c, c.tipoComp);
  if ((c.tipoComp || '') === (data.tipoPropiedad || '')) score += 30;
  else if (['Casa', 'PH'].includes(c.tipoComp) && ['Casa', 'PH'].includes(data.tipoPropiedad)) score += 18;
  if (targetSurface > 0 && cSurface > 0) score += Math.max(0, 30 - (Math.abs(cSurface - targetSurface) / targetSurface) * 60);
  if (data.dormitorios != null && c.dormitorios != null) score += Math.max(0, 10 - Math.abs(data.dormitorios - c.dormitorios) * 5);
  if (data.banos != null && c.banos != null) score += Math.max(0, 8 - Math.abs(data.banos - c.banos) * 4);
  score += Math.max(0, 10 - Math.abs(stateRank(data.estado) - stateRank(c.estado)) * 3);
  const targetGarage = num(typeof data.cochera === 'boolean' ? (data.cochera ? 1 : 0) : data.cochera) > 0 ? 'Sí' : 'No';
  if ((c.cocheraComp || 'No') === targetGarage) score += 5;
  const age = monthsOld(c.fechaReferencia);
  score += age === null ? 2 : age <= 3 ? 7 : age <= 6 ? 5 : age <= 12 ? 3 : 0;
  return clamp(Math.round(score), 0, 100);
}

export type NivelConfianza = 'Alta' | 'Media' | 'Baja';

export interface AnalisisComparables {
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  avgUsdPerM2: number;
  medianUsdPerM2: number;
  /** Referencia ponderada (por similitud, fuente y descarte de outliers). */
  weightedUsdPerM2: number;
  /** Dispersión relativa de los USD/m² (%). */
  spreadPct: number;
  outlierCount: number;
  confidence: NivelConfianza;
  confidenceScore: number;
}

/**
 * Análisis de los comparables: USD/m² ponderado (referencia de mercado),
 * mediana, dispersión, outliers y nivel de confianza. Fiel al prototipo.
 */
export function analizarComparables(comparables: ComparableCalc[], propiedad: PropiedadCalc): AnalisisComparables {
  const targetSurface = valuationSurface(propiedad, propiedad.tipoPropiedad);

  const entries = comparables
    .map((c) => {
      const surface = valuationSurface(c, c.tipoComp);
      const price = num(c.precio);
      const usdM2 = surface > 0 && price > 0 ? price / surface : 0;
      const sourceWeight = c.fuente === 'Cierre real' || c.tipoPrecio === 'Cierre' ? 1.25 : c.fuente === 'Colega' ? 1.08 : 1;
      const similarity = comparableSimilarity(c, propiedad, targetSurface);
      return { c, surface, price, usdM2, similarity, sourceWeight, outlier: false, weight: 0 };
    })
    .filter((e) => e.price > 0 && e.surface > 0 && e.usdM2 > 0);

  const rawM2 = entries.map((e) => e.usdM2);
  const med = median(rawM2);
  const mad = median(rawM2.map((v) => Math.abs(v - med)));

  for (const e of entries) {
    e.outlier = entries.length >= 4 && (mad > 0 ? Math.abs(e.usdM2 - med) / mad > 3.5 : Math.abs(e.usdM2 - med) / med > 0.35);
    e.weight = Math.max(0.15, e.similarity / 100) * e.sourceWeight * (e.outlier ? 0.15 : 1);
  }

  const usable = entries.filter((e) => !e.outlier);
  const base = usable.length ? usable : entries;
  const weightedDen = base.reduce((s, e) => s + e.weight, 0);
  const weightedM2 = weightedDen ? base.reduce((s, e) => s + e.usdM2 * e.weight, 0) / weightedDen : 0;

  const spread = med ? (standardDeviation(rawM2) / med) * 100 : 0;
  const avgSimilarity = average(entries.map((e) => e.similarity));

  let confidenceScore = Math.min(40, entries.length * 8) + Math.min(35, avgSimilarity * 0.35) + Math.max(0, 25 - spread * 0.8);
  if (entries.some((e) => e.c.fuente === 'Cierre real' || e.c.tipoPrecio === 'Cierre')) confidenceScore += 8;
  confidenceScore = clamp(Math.round(confidenceScore), 0, 100);
  const confidence: NivelConfianza = confidenceScore >= 75 ? 'Alta' : confidenceScore >= 50 ? 'Media' : 'Baja';

  const prices = entries.map((e) => e.price);
  return {
    count: entries.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    avgPrice: average(prices),
    avgUsdPerM2: average(rawM2),
    medianUsdPerM2: med,
    weightedUsdPerM2: weightedM2 || med,
    spreadPct: spread,
    outlierCount: entries.filter((e) => e.outlier).length,
    confidence,
    confidenceScore,
  };
}
