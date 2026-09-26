'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgregadoKpi, RankingItem } from '@vacker/types';
import { Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getResumenPeriodo, type PeriodoResumen } from '../../lib/tablero-api';
import { getOrFetch } from '../../lib/kpi-cache';
import { NOMBRES_MES } from '../../lib/meses';
import { VendedorTotalesTable } from './vendedor-totales-table';

const PERIODOS: { key: PeriodoResumen; label: string }[] = [
  { key: 'anual', label: 'Acumulado año' },
  { key: 'trimestral', label: 'Acumulado trimestral' },
  { key: 'mensual', label: 'Mes seleccionado' },
];

const TRIMESTRES = [1, 2, 3, 4];

interface Props {
  anio: number;
  mesSeleccionado: number;
  /** "Ver solo lo mío": acota los totales al usuario actual. */
  verTodo?: boolean;
  /** Acumulado anual ya resuelto server-side — evita repetir esa consulta al montar. */
  inicial?: { agregado: AgregadoKpi; ranking: RankingItem[] };
}

/**
 * Totales por vendedor, con su propio selector de período.
 *
 * LA HISTORIA, porque se dio vuelta dos veces. Hasta septiembre de 2026 había
 * dos tablas iguales: «Totales por vendedor» dentro del Resumen acumulado,
 * siguiendo sus pestañas, y «Ranking de vendedores» en su propia sección, con
 * su propio selector. Vacker pidió unificarlas: quedarse con Totales y
 * «agregarle el acumulado año, el acumulado trimestral y el mes seleccionado».
 *
 * La primera versión (25/09) borró el Ranking y dejó Totales dentro del
 * Resumen, siguiendo las pestañas de arriba, con el período en el título. Era
 * un solo selector para todo, pero en la pantalla quedaba lejísimos: en el
 * trimestral o el mensual, entre las pestañas y la tabla había un gráfico, un
 * cuadro de nueve filas y nueve tarjetas. Se bajaba a los totales y no había
 * ningún selector a la vista, que es exactamente lo que Vacker había marcado.
 *
 * Ahora (26/09) es lo que Vacker pidió al pie de la letra: una sola tabla de
 * totales, en su propia sección, con el selector encima. El Resumen ya no la
 * incluye, así que el duplicado no vuelve.
 */
export function TotalesVendedores({ anio, mesSeleccionado, verTodo, inicial }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoResumen>('anual');
  const [trimestre, setTrimestre] = useState(() => Math.ceil(mesSeleccionado / 3));
  const [items, setItems] = useState<RankingItem[]>(inicial?.ranking ?? []);
  const [loading, setLoading] = useState(!inicial);
  const primerRender = useRef(true);

  // Si cambia el mes de arriba del tablero, el trimestre elegido lo sigue.
  useEffect(() => {
    setTrimestre(Math.ceil(mesSeleccionado / 3));
  }, [mesSeleccionado]);

  useEffect(() => {
    // El período por defecto (el año) ya viene resuelto desde el servidor
    // junto con la página: nos ahorramos repetir la consulta.
    if (primerRender.current) {
      primerRender.current = false;
      if (inicial && periodo === 'anual') return;
    }
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) =>
        getOrFetch(`resumen:${anio}:${periodo}:${mesSeleccionado}:${trimestre}:${verTodo ? 1 : 0}`, () =>
          getResumenPeriodo(accessToken, { anio, periodo, mes: mesSeleccionado, trimestre, verTodo }),
        ),
      )
      .then((res) => {
        if (!cancelado) setItems(res.ranking);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, periodo, trimestre, mesSeleccionado, verTodo]);

  const nombrePeriodo =
    periodo === 'anual'
      ? `Año ${anio}`
      : periodo === 'trimestral'
        ? `Q${trimestre} ${anio}`
        : `${NOMBRES_MES[mesSeleccionado - 1]} ${anio}`;

  return (
    <Card className="p-0">
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-base font-bold text-ink">
          👥 Totales por vendedor · {nombrePeriodo}{' '}
          <span className="text-xs font-normal text-muted">({items.length} vendedores)</span>
        </h3>
      </div>

      <div className="flex flex-wrap gap-1 border-y border-line px-4 py-2">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={periodo === p.key}
            onClick={() => setPeriodo(p.key)}
            className={`rounded-brand px-3 py-1.5 text-sm font-semibold transition-colors ${
              periodo === p.key ? 'bg-ink text-white' : 'text-muted hover:bg-surface'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodo === 'trimestral' && (
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
          {TRIMESTRES.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={trimestre === q}
              onClick={() => setTrimestre(q)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                trimestre === q ? 'bg-brand-red text-white' : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              Q{q}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="px-5 py-6 text-sm text-muted">Cargando…</p>
      ) : (
        <VendedorTotalesTable items={items} anio={anio} verTodo={verTodo} />
      )}
    </Card>
  );
}
