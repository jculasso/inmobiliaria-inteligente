import type { AgregadoKpi, LadoPunta, RankingItem, SeguimientoObjetivo } from '@vacker/types';

/**
 * Lógica de negocio del Tablero (MODELO Parte C), replicada del prototipo
 * (`agg`, `vendStats`). Funciones PURAS: reciben datos ya traídos de la base y
 * el conjunto de alcance; sin dependencias de Prisma → testeables en memoria.
 *
 * Regla central: cada punta atribuida aporta el PRECIO COMPLETO de la operación
 * al volumen y su propia comisión. Volumen = Σ precio por punta; ticket = vol/puntas.
 */

/** Punta de una venta escriturada, aplanada para el cálculo. */
export interface PuntaCalc {
  operacionId: string;
  usuarioId: string;
  nombre: string;
  fotoUrl: string | null;
  lado: LadoPunta;
  /** Precio de la operación (aporte de esta punta al volumen). */
  precio: number;
  comision: number;
}

/** `null` = todo el alcance (sin filtro); un Set = solo esos usuarios. */
export type ScopeSet = Set<string> | null;

function enAlcance(p: PuntaCalc, scope: ScopeSet): boolean {
  return scope === null || scope.has(p.usuarioId);
}

/** Agrega volumen, puntas, comisión y ticket sobre las puntas del alcance. */
export function agregar(puntas: PuntaCalc[], scope: ScopeSet): AgregadoKpi {
  const ops = new Set<string>();
  let volumen = 0;
  let n = 0;
  let pc = 0;
  let pv = 0;
  let comision = 0;
  for (const p of puntas) {
    if (!enAlcance(p, scope)) continue;
    ops.add(p.operacionId);
    volumen += p.precio;
    n += 1;
    if (p.lado === 'compradora') pc += 1;
    else pv += 1;
    comision += p.comision;
  }
  return {
    volumen,
    operaciones: ops.size,
    puntas: n,
    puntasCompradoras: pc,
    puntasVendedoras: pv,
    comision,
    ticketPromedio: n ? volumen / n : 0,
  };
}

/** Ranking de vendedores por volumen (solo usuarios dentro del alcance). */
export function ranking(puntas: PuntaCalc[], scope: ScopeSet): RankingItem[] {
  const porUsuario = new Map<string, RankingItem & { _ops: Set<string> }>();
  let volumenTotal = 0;

  for (const p of puntas) {
    if (!enAlcance(p, scope)) continue;
    let item = porUsuario.get(p.usuarioId);
    if (!item) {
      item = {
        usuarioId: p.usuarioId,
        nombre: p.nombre,
        fotoUrl: p.fotoUrl,
        volumen: 0,
        operaciones: 0,
        puntas: 0,
        puntasCompradoras: 0,
        puntasVendedoras: 0,
        ticketPromedio: 0,
        comision: 0,
        peso: 0,
        _ops: new Set<string>(),
      };
      porUsuario.set(p.usuarioId, item);
    }
    item.volumen += p.precio;
    item.puntas += 1;
    if (p.lado === 'compradora') item.puntasCompradoras += 1;
    else item.puntasVendedoras += 1;
    item.comision += p.comision;
    item._ops.add(p.operacionId);
    volumenTotal += p.precio;
  }

  return [...porUsuario.values()]
    .map(({ _ops, ...item }) => ({
      ...item,
      operaciones: _ops.size,
      ticketPromedio: item.puntas ? item.volumen / item.puntas : 0,
      peso: volumenTotal ? item.volumen / volumenTotal : 0,
    }))
    .sort((a, b) => b.volumen - a.volumen);
}

/** Insumo por vendedor para el seguimiento de objetivos. */
export interface ObjetivoRow {
  usuarioId: string;
  nombre: string;
  objComision: number;
  objVolumen: number;
  objPuntas: number;
}

/**
 * Compara real (de las puntas escrituradas del año) vs objetivo, por vendedor.
 * Incluye a todo vendedor con objetivo cargado o con actividad real en el alcance.
 */
export function seguimientoObjetivos(
  puntas: PuntaCalc[],
  objetivos: ObjetivoRow[],
  anio: number,
  scope: ScopeSet,
): SeguimientoObjetivo[] {
  const real = new Map<string, { nombre: string; vol: number; pts: number; com: number }>();
  for (const p of puntas) {
    if (!enAlcance(p, scope)) continue;
    const r = real.get(p.usuarioId) ?? { nombre: p.nombre, vol: 0, pts: 0, com: 0 };
    r.vol += p.precio;
    r.pts += 1;
    r.com += p.comision;
    real.set(p.usuarioId, r);
  }

  const usuarios = new Map<string, string>();
  for (const [id, r] of real) usuarios.set(id, r.nombre);
  for (const o of objetivos) {
    if (scope !== null && !scope.has(o.usuarioId)) continue;
    usuarios.set(o.usuarioId, o.nombre);
  }
  const objByUser = new Map(objetivos.map((o) => [o.usuarioId, o]));

  const avance = (r: number, o: number): number => (o > 0 ? r / o : 0);

  return [...usuarios.entries()]
    .map(([usuarioId, nombre]) => {
      const o = objByUser.get(usuarioId);
      const r = real.get(usuarioId);
      const realComision = r?.com ?? 0;
      const realVolumen = r?.vol ?? 0;
      const realPuntas = r?.pts ?? 0;
      const objComision = o?.objComision ?? 0;
      const objVolumen = o?.objVolumen ?? 0;
      const objPuntas = o?.objPuntas ?? 0;
      return {
        usuarioId,
        nombre,
        anio,
        objComision,
        objVolumen,
        objPuntas,
        realComision,
        realVolumen,
        realPuntas,
        avanceComision: avance(realComision, objComision),
        avanceVolumen: avance(realVolumen, objVolumen),
        avancePuntas: avance(realPuntas, objPuntas),
      };
    })
    .sort((a, b) => b.realVolumen - a.realVolumen);
}
