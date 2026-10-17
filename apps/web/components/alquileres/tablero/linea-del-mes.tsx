import type { CicloDelMes } from '@vacker/types';
import { Card } from '@vacker/ui';
import { diaCorto, nombreDelMes } from './bloque';

/** Los cuatro renglones posibles de etiquetas: arriba y abajo de la línea, y uno más de cada lado. */
export type Carril = 'arriba' | 'abajo' | 'arriba2' | 'abajo2';

export interface Hito {
  clave: 'vence' | 'pago' | 'hoy' | 'generar';
  fecha: string;
  /** Dónde cae en la línea, de 0 a 100. */
  pos: number;
  /** Para la compu: «lun 5 · Vencieron los alquileres», con el motivo aparte. */
  largo: string;
  /** Para el teléfono: «5 · Vencieron». */
  corto: string;
  motivo: string | null;
}

// Cuánto ocupa una etiqueta, para que no se pisen. Se estima, no se mide: así
// se arma igual en el servidor y en el navegador, sin un salto al cargar.
const ANCHO_LETRA = 5.6; // px: Montserrat semibold de 11,5px mide ~5,3 por letra
const LINEA_TELEFONO = 300; // px: 375 menos los márgenes de la página y de la tarjeta
const LINEA_COMPU = 880; // px: la línea más angosta con la etiqueta larga (desde 1024)
const CORRIDA = 12; // px: la etiqueta empieza (o termina) un poco antes del punto
const AIRE = 4; // px entre dos etiquetas del mismo renglón
const PREFERENCIA: Record<Hito['clave'], Carril[]> = {
  vence: ['arriba', 'abajo', 'arriba2', 'abajo2'],
  pago: ['abajo', 'arriba', 'abajo2', 'arriba2'],
  generar: ['arriba', 'abajo', 'arriba2', 'abajo2'],
  hoy: ['arriba', 'abajo', 'arriba2', 'abajo2'],
};

/**
 * En qué renglón va la etiqueta de cada fecha. En el orden en que llegan
 * (primero las del ciclo, «Hoy» al final), cada una toma el primer renglón de
 * su preferencia donde no se pise con otra, ni con las etiquetas cortas del
 * teléfono ni con las largas de la compu. Pasada la mitad de la línea, la
 * etiqueta termina en el punto en vez de empezar ahí.
 */
export function carriles(hitos: Hito[]) {
  // En px de cada línea: [desde, hasta].
  type Rango = [number, number];
  const choca = (a: Rango, b: Rango) => a[0] < b[1] + AIRE && b[0] < a[1] + AIRE;
  const puestos: (Hito & { carril: Carril; alFinal: boolean; t: Rango; c: Rango })[] = [];
  for (const h of hitos) {
    const alFinal = h.pos > 55;
    const rango = (texto: string, linea: number): Rango => {
      const punto = (h.pos / 100) * linea;
      const ancho = texto.length * ANCHO_LETRA + 6;
      return alFinal
        ? [punto + CORRIDA - ancho, punto + CORRIDA]
        : [punto - CORRIDA, punto - CORRIDA + ancho];
    };
    const t = rango(h.corto, LINEA_TELEFONO);
    const c = rango(h.motivo ? `${h.largo} (${h.motivo})` : h.largo, LINEA_COMPU);
    const libre = (carril: Carril) =>
      puestos.every((p) => p.carril !== carril || (!choca(p.t, t) && !choca(p.c, c)));
    const carril = PREFERENCIA[h.clave].find(libre) ?? PREFERENCIA[h.clave].at(-1)!;
    puestos.push({ ...h, carril, alFinal, t, c });
  }
  return puestos.map(({ t: _t, c: _c, ...h }) => h);
}

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaLargo = (iso: string) =>
  `${DIAS_LARGOS[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${Number(iso.slice(8, 10))}`;

/** Las fechas de la línea, con sus etiquetas, para el mes del ciclo. */
export function hitosDelCiclo(ciclo: CicloDelMes, hoy: string): Hito[] {
  const [a, m] = ciclo.mes.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const pos = (fecha: string) =>
    fecha.slice(0, 7) > ciclo.mes
      ? 100
      : fecha.slice(0, 7) < ciclo.mes
        ? 0
        : ((Number(fecha.slice(8, 10)) - 1) / (ultimo - 1)) * 100;
  const dia = (fecha: string) => String(Number(fecha.slice(8, 10)));
  const v = ciclo.vencimiento;
  const p = ciclo.pagoPropietarios;
  const g = ciclo.generarSiguiente;
  const vencieron = v.fecha < hoy;
  const siguiente = nombreDelMes(g.mes);
  return [
    {
      clave: 'vence',
      fecha: v.fecha,
      pos: pos(v.fecha),
      largo: `${diaCorto(v.fecha)} · ${vencieron ? 'Vencieron' : 'Vencen'} los alquileres`,
      corto: `${dia(v.fecha)} · ${vencieron ? 'Vencieron' : 'Vencen'}`,
      motivo: v.motivo,
    },
    {
      clave: 'pago',
      fecha: p.fecha,
      pos: pos(p.fecha),
      largo: `${diaCorto(p.fecha)} · Pago a propietarios`,
      corto: `${dia(p.fecha)} · Propietarios`,
      motivo: p.motivo,
    },
    {
      clave: 'generar',
      fecha: g.fecha,
      pos: pos(g.fecha),
      largo: `${diaCorto(g.fecha)} · Generar ${siguiente}`,
      corto: `${dia(g.fecha)} · Generar ${siguiente.slice(0, 3)}.`,
      motivo: g.motivo,
    },
    { clave: 'hoy', fecha: hoy, pos: pos(hoy), largo: 'Hoy', corto: 'Hoy', motivo: null },
  ];
}

/** La misma línea, en palabras: para el lector de pantalla. */
function enPalabras(ciclo: CicloDelMes, hoy: string) {
  const porque = (motivo: string | null) => (motivo ? `, porque ${motivo}` : '');
  const v = ciclo.vencimiento;
  const p = ciclo.pagoPropietarios;
  const g = ciclo.generarSiguiente;
  const mes = nombreDelMes(ciclo.mes);
  return (
    `${mes.charAt(0).toUpperCase()}${mes.slice(1)}: los alquileres ${v.fecha < hoy ? 'vencieron' : 'vencen'} el ${diaLargo(v.fecha)}${porque(v.motivo)}; ` +
    `a los propietarios se les ${p.fecha < hoy ? 'pagó' : 'paga'} el ${diaLargo(p.fecha)}${porque(p.motivo)}; ` +
    `hoy es ${diaLargo(hoy)}; ${nombreDelMes(g.mes)} se genera desde el ${diaLargo(g.fecha)}${porque(g.motivo)}.`
  );
}

const ARRIBA: Record<Carril, string> = {
  arriba: 'bottom-3',
  arriba2: 'bottom-[1.875rem]',
  abajo: 'top-3',
  abajo2: 'top-[1.875rem]',
};

/**
 * Regla 178: la línea del mes en curso —cuándo vencen los alquileres, cuándo
 * se paga a los propietarios, hoy y desde cuándo hay que generar el mes
 * siguiente—, con las fechas ya corridas por la API. Si una se corrió, dice
 * por qué: en la compu, al lado; en el teléfono, debajo de la línea.
 */
export function LineaDelMes({ ciclo, hoy }: { ciclo: CicloDelMes; hoy: string }) {
  const hitos = carriles(hitosDelCiclo(ciclo, hoy));
  const usa = (c: Carril) => hitos.some((h) => h.carril === c);
  const pasado = hitos.find((h) => h.clave === 'hoy')!.pos;
  const conMotivo = hitos.filter((h) => h.motivo);
  return (
    <Card className="px-4 py-3 sm:px-6">
      <div
        role="img"
        aria-label={enPalabras(ciclo, hoy)}
        className={`${usa('arriba2') ? 'pt-12' : 'pt-8'} ${usa('abajo2') ? 'pb-12' : usa('abajo') ? 'pb-8' : 'pb-3'}`}
      >
        <div className="relative h-1.5 rounded-full bg-surface">
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-line"
            style={{ width: `${pasado}%` }}
          />
          {hitos.map((h) => (
            <span
              key={h.clave}
              data-hito={h.clave}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${h.clave === 'hoy' ? 'z-10' : ''}`}
              style={{ left: `${h.pos}%` }}
            >
              <i
                aria-hidden
                className={`block rounded-full border-2 ${
                  h.clave === 'hoy'
                    ? 'h-3.5 w-3.5 border-brand-red bg-brand-red shadow-[0_0_0_4px_rgb(193_18_31/0.15)]'
                    : h.fecha > hoy
                      ? 'h-3 w-3 border-dashed border-muted bg-white'
                      : 'h-3 w-3 border-ink bg-white'
                }`}
              />
              <b
                className={`absolute whitespace-nowrap text-[11.5px] font-semibold ${ARRIBA[h.carril]} ${h.alFinal ? 'right-0 translate-x-1.5' : 'left-0 -translate-x-1.5'} ${h.clave === 'hoy' ? 'font-extrabold text-brand-red' : 'text-ink'}`}
              >
                <span className="lg:hidden">{h.corto}</span>
                <span className="hidden lg:inline">
                  {h.largo}
                  {h.motivo && (
                    <small className="text-[11.5px] font-medium text-muted"> ({h.motivo})</small>
                  )}
                </span>
              </b>
            </span>
          ))}
        </div>
      </div>
      {conMotivo.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted lg:hidden">
          {conMotivo.map((h) => (
            <li key={h.clave}>
              {h.clave === 'vence'
                ? 'Vencimiento'
                : h.clave === 'pago'
                  ? 'Pago a propietarios'
                  : `Generar ${nombreDelMes(ciclo.generarSiguiente.mes)}`}
              : {diaCorto(h.fecha)}, porque {h.motivo}.
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
