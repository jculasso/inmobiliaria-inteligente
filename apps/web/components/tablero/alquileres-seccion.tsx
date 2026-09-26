'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AlquileresMes } from '@vacker/types';
import { Card, KpiCard } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  getAlquileresMensual,
  mesesDelTrimestre,
  sumarAlquileres,
  type AlquileresPeriodo,
} from '../../lib/tablero-api';
import { fmtK, fmtNum, fmtUSD } from '../../lib/format';
import { ABREV_MES, NOMBRES_MES } from '../../lib/meses';
import { PeriodosChart } from './periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from './periodos-tabla';

type Tab = 'anual' | 'trimestral' | 'mensual';

const TABS: { key: Tab; label: string; icono: string }[] = [
  { key: 'anual', label: 'Acumulado Anual', icono: '📅' },
  { key: 'trimestral', label: 'Acumulado Trimestral', icono: '📈' },
  { key: 'mensual', label: 'Acumulado del Mes', icono: '🗓️' },
];

const TRIMESTRES = [
  { q: 1, label: 'Q1 · Ene–Mar' },
  { q: 2, label: 'Q2 · Abr–Jun' },
  { q: 3, label: 'Q3 · Jul–Sep' },
  { q: 4, label: 'Q4 · Oct–Dic' },
];
const ETIQUETAS_TRIMESTRE = TRIMESTRES.map((t) => `Q${t.q}`);

/**
 * Las filas del cuadro, en el orden y con los nombres de la planilla de Vacker:
 * quien la venía mirando en Excel encuentra cada número donde lo busca.
 */
function filas(periodos: AlquileresPeriodo[], anual: AlquileresPeriodo): FilaPeriodos[] {
  return [
    {
      label: 'Alquileres firmados',
      valores: periodos.map((p) => p.firmados),
      total: anual.firmados,
      formato: fmtNum,
    },
    {
      label: 'Com. total USD',
      valores: periodos.map((p) => p.comision),
      total: anual.comision,
      formato: fmtUSD,
      destaca: true,
    },
    {
      // El total NO es el promedio de la fila: es el del año, sobre todos los
      // alquileres. Ver `sumarAlquileres`.
      label: 'Valor prom. alq. USD',
      valores: periodos.map((p) => p.valorPromedio),
      total: anual.valorPromedio,
      formato: fmtUSD,
      separa: true,
    },
  ];
}

function tarjetas(p: AlquileresPeriodo) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard label="Alquileres firmados" value={fmtNum(p.firmados)} tone="brand" />
      <KpiCard label="Comisión" value={fmtUSD(p.comision)} tone="success" />
      <KpiCard label="Valor promedio" value={fmtUSD(p.valorPromedio)} sub="por mes de alquiler" />
    </div>
  );
}

/**
 * La sección Alquileres del Tablero Comercial, pedida por Vacker el 25/09/2026:
 * «similar al esquema de ventas, nada más que acá no nos interesa quiénes son
 * los comerciales sino más bien los datos generales de la unidad de negocio».
 *
 * Por eso no tiene totales por vendedor ni la rige el tilde «Ver todo»: los
 * alquileres se cargan sin puntas, son de la inmobiliaria. Quién la ve lo
 * decide `puedeVerAlquileres`, y la página no la monta para los demás.
 *
 * Se piden los doce meses UNA vez y todo lo demás —trimestres, año— se arma de
 * ahí, sumando. Así el mensual, el trimestral y el anual no pueden
 * contradecirse: salen del mismo número.
 */
export function AlquileresSeccion({ anio, mesSeleccionado }: { anio: number; mesSeleccionado: number }) {
  const [tab, setTab] = useState<Tab>('anual');
  const [trimestre, setTrimestre] = useState(() => Math.ceil(mesSeleccionado / 3));
  const [mes, setMes] = useState(mesSeleccionado);
  const [meses, setMeses] = useState<AlquileresMes[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMes(mesSeleccionado);
    setTrimestre(Math.ceil(mesSeleccionado / 3));
  }, [mesSeleccionado]);

  useEffect(() => {
    let cancelado = false;
    setError(false);
    getAccessToken()
      .then((accessToken) => getAlquileresMensual(accessToken, anio))
      .then((res) => {
        if (!cancelado) setMeses(res);
      })
      // Si falla, falla la sección y no el tablero. Pasa, por ejemplo, en los
      // minutos en que la web nueva ya salió y la API todavía no: el endpoint
      // no existe y el resto de la página tiene que seguir andando.
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [anio]);

  const calculo = useMemo(() => {
    if (!meses) return null;
    const porMes = meses.map((m) => sumarAlquileres([m]));
    const porTrimestre = [1, 2, 3, 4].map((q) => sumarAlquileres(mesesDelTrimestre(q).map((m) => meses[m - 1]!)));
    return { porMes, porTrimestre, anual: sumarAlquileres(meses) };
  }, [meses]);

  const plata = (n: number) => `$${fmtK(n)}`;

  let cuerpo: React.ReactNode;
  if (error) {
    cuerpo = <p className="p-5 text-sm text-muted">No se pudieron cargar los alquileres. Probá recargar la página.</p>;
  } else if (!calculo) {
    cuerpo = <p className="p-5 text-sm text-muted">Cargando…</p>;
  } else if (calculo.anual.firmados === 0) {
    cuerpo = <p className="p-5 text-sm text-muted">Todavía no hay alquileres firmados en {anio}.</p>;
  } else {
    const { porMes, porTrimestre, anual } = calculo;
    const periodos = tab === 'mensual' ? porMes : porTrimestre;
    const etiquetas = tab === 'mensual' ? ABREV_MES : ETIQUETAS_TRIMESTRE;
    const seleccionado = tab === 'mensual' ? mes : trimestre;
    const elegir = tab === 'mensual' ? setMes : setTrimestre;
    const delPeriodo = tab === 'anual' ? anual : tab === 'mensual' ? porMes[mes - 1]! : porTrimestre[trimestre - 1]!;
    const nombrePeriodo =
      tab === 'anual' ? `Año ${anio}` : tab === 'mensual' ? `${NOMBRES_MES[mes - 1]} ${anio}` : `Q${trimestre} ${anio}`;

    cuerpo = (
      <>
        {tab === 'trimestral' && (
          <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
            {TRIMESTRES.map((t) => (
              <button
                key={t.q}
                type="button"
                onClick={() => setTrimestre(t.q)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  trimestre === t.q ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab !== 'anual' && (
          <div className="flex flex-col gap-4 border-b border-line p-4">
            <PeriodosChart
              titulo={`Alquileres y comisión por ${tab === 'mensual' ? 'mes' : 'trimestre'}`}
              etiquetas={etiquetas}
              barras={periodos.map((p) => p.firmados)}
              linea={periodos.map((p) => p.comision)}
              formatoBarras={fmtNum}
              formatoLinea={plata}
              nombreBarras="Alquileres firmados"
              nombreLinea="Comisión USD"
              nombreLineaCorto="Comisión"
              barrasEnteras
              seleccionado={seleccionado}
              onSelect={elegir}
              pista={`tocá una barra o un ${tab === 'mensual' ? 'mes' : 'trimestre'}`}
            />
            <PeriodosTabla
              titulo="Alquileres por período"
              etiquetas={etiquetas}
              filas={filas(periodos, anual)}
              seleccionado={seleccionado}
              onSelect={elegir}
              anchoMinimo={tab === 'mensual' ? 'min-w-[60rem]' : 'min-w-[34rem]'}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 p-5">
          <p className="text-sm font-bold text-ink">{nombrePeriodo}</p>
          {tarjetas(delPeriodo)}
        </div>
      </>
    );
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap gap-1 border-b border-line p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-brand px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-brand-red text-white' : 'text-muted hover:bg-surface'
            }`}
          >
            <span aria-hidden>{t.icono}</span> {t.label}
          </button>
        ))}
      </div>
      {cuerpo}
    </Card>
  );
}
