'use client';

import { KpiCard } from '@vacker/ui';
import { fmtMoneda } from '../../../lib/format';
import { TituloSeccion } from '../piezas';
import { Ancha } from './ancha';
import { pct } from './formatos';
import type { DelPeriodo } from './periodo';
import { VISTAS, type Pedir } from './vistas';

const PARTES = [
  ['honorarios', 'Honorarios', '🤝'],
  ['gastos', 'Gastos adm.', '🗂️'],
  ['punitorios', 'Punitorios', '⏱️'],
  ['comisiones', 'Comisiones e informes', '📝'],
] as const;

/**
 * Lo que ganó la inmobiliaria en el período, una sección por moneda, con el
 * desglose por parte (regla 30). Cada tarjeta pide su lista al abrirla.
 */
export function Ingresos({ p, pedir }: { p: DelPeriodo; pedir: Pedir }) {
  return (
    <>
      {p.ingresos.map((i) => (
        <section key={i.moneda} className="flex flex-col gap-2">
          <TituloSeccion
            icono="🏦"
            detalle={`${p.nombre}${i.moneda === 'USD' ? ', en dólares' : ''}`}
          >
            Ingresos de la inmobiliaria
          </TituloSeccion>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Ancha>
              <KpiCard
                label="Ingresos"
                value={fmtMoneda(i.total, i.moneda)}
                sub="cobrados y descontados"
                icon="🏦"
                tone="success"
                onClick={
                  i.total
                    ? pedir(
                        `Ingresos de la inmobiliaria, ${p.nombre}`,
                        'ingresos',
                        i.moneda,
                        VISTAS.ingresos,
                        { total: i.moneda },
                      )
                    : undefined
                }
              />
            </Ancha>
            {PARTES.map(([parte, nombre, icono]) => (
              <Ancha key={parte}>
                <KpiCard
                  label={nombre}
                  value={fmtMoneda(i[parte], i.moneda)}
                  sub={`${pct(i[parte], i.total)} de los ingresos`}
                  icon={icono}
                  onClick={
                    i[parte]
                      ? pedir(`${nombre} · ${p.nombre}`, parte, i.moneda, VISTAS.ingresos, {
                          total: i.moneda,
                        })
                      : undefined
                  }
                />
              </Ancha>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
