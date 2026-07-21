'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgregadoKpi, RankingItem } from '@vacker/types';
import { Card } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { getResumenPeriodo, type PeriodoResumen } from '../../lib/tablero-api';
import { getOrFetch } from '../../lib/kpi-cache';
import { VendedorTotalesTable } from './vendedor-totales-table';

type RankScope = 'anio' | 'trim' | 'mes';

const SCOPE_A_PERIODO: Record<RankScope, PeriodoResumen> = {
  anio: 'anual',
  trim: 'trimestral',
  mes: 'mensual',
};

const SCOPES: { key: RankScope; label: string }[] = [
  { key: 'anio', label: 'Acumulado año' },
  { key: 'trim', label: 'Acumulado trimestral' },
  { key: 'mes', label: 'Mes seleccionado' },
];

const TRIMESTRES = [1, 2, 3, 4];

/** Ranking de vendedores con alcance de período propio (independiente del
 * filtro de la página), como en el prototipo: Acumulado año / Acumulado
 * trimestral (+ Q1-Q4) / Mes seleccionado. */
interface Props {
  anio: number;
  mesSeleccionado: number;
  /** Acumulado anual ya resuelto server-side (mismo dato que pide el scope "Acumulado año" por defecto) — evita repetir esa consulta al montar. */
  inicial?: { agregado: AgregadoKpi; ranking: RankingItem[] };
}

export function RankingTable({ anio, mesSeleccionado, inicial }: Props) {
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState<RankScope>('anio');
  const [trimestre, setTrimestre] = useState(() => Math.ceil(mesSeleccionado / 3));
  const [items, setItems] = useState<RankingItem[]>(inicial?.ranking ?? []);
  const [loading, setLoading] = useState(!inicial);
  const primerRender = useRef(true);

  useEffect(() => {
    const periodo = SCOPE_A_PERIODO[scope];
    // El scope por defecto ('anio' → periodo 'anual') ya viene resuelto desde
    // el servidor junto con la página — nos ahorramos repetir la consulta.
    if (primerRender.current) {
      primerRender.current = false;
      if (inicial && periodo === 'anual') return;
    }
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) =>
        getOrFetch(`resumen:${anio}:${periodo}:${mesSeleccionado}:${trimestre}`, () =>
          getResumenPeriodo(accessToken, { anio, periodo, mes: mesSeleccionado, trimestre }),
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
  }, [anio, scope, trimestre, mesSeleccionado]);

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-bold text-ink">🏆 Ranking de vendedores</span>
        <span className="text-sm text-muted">{open ? '▾ Ocultar' : '▸ Mostrar'}</span>
      </button>

      {open && (
        <div className="border-t border-line">
          <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className={`rounded-brand px-3 py-1.5 text-sm font-semibold transition-colors ${
                  scope === s.key ? 'bg-ink text-white' : 'text-muted hover:bg-surface'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {scope === 'trim' && (
            <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
              {TRIMESTRES.map((q) => (
                <button
                  key={q}
                  type="button"
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
            <VendedorTotalesTable items={items} anio={anio} />
          )}
        </div>
      )}
    </Card>
  );
}
