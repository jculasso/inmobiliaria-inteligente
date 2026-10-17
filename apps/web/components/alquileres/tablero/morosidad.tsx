'use client';

import { TRAMOS_MORA, type Indicador, type TableroAlquileresDto } from '@vacker/types';
import { Card, KpiCard } from '@vacker/ui';
import { fmtMoneda } from '../../../lib/format';
import { TituloSeccion } from '../piezas';
import { Ancha } from './ancha';
import { NOMBRE_TRAMO, plural } from './formatos';
import type { DelPeriodo } from './periodo';
import { VISTAS, type Abrir, type Pedir } from './vistas';

/**
 * La deuda vencida de inquilinos, por moneda y por antigüedad (regla 29). Es
 * una foto (regla 77): a hoy, con su lista; al cierre, el número y la lista
 * se pide.
 */
export function Morosidad({
  t,
  p,
  abrir,
  pedir,
}: {
  t: TableroAlquileresDto;
  p: DelPeriodo;
  abrir: Abrir;
  pedir: Pedir;
}) {
  // --- Las fotos (regla 77): a hoy, con su lista; al cierre, el número y la lista se pide ---
  const mora = p.aHoy
    ? t.morosidad.map((m) => ({
        moneda: m.moneda,
        valor: m.total.valor,
        conceptos: m.total.filas.length,
        inquilinos: new Set(m.total.filas.map((f) => f.inquilino)).size,
        indicador: m.total as Indicador | undefined,
        tramos: m.tramos.map((x) => ({
          tramo: x.tramo,
          valor: x.indicador.valor,
          conceptos: x.indicador.filas.length,
          indicador: x.indicador as Indicador | undefined,
        })),
      }))
    : p.cierre!.mora.map((m) => ({
        ...m,
        indicador: undefined,
        tramos: TRAMOS_MORA.map((tramo) => ({
          tramo,
          valor: m.tramos.find((x) => x.tramo === tramo)?.valor ?? 0,
          conceptos: m.tramos.find((x) => x.tramo === tramo)?.conceptos ?? 0,
          indicador: undefined,
        })),
      }));

  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion
        icono="⏳"
        detalle={`deuda vencida de inquilinos, por antigüedad, ${p.alCierre}`}
      >
        Morosidad
      </TituloSeccion>
      {mora.length === 0 ? (
        <Card className="py-4 text-sm text-success">
          {p.aHoy
            ? 'Ningún inquilino tiene deuda vencida.'
            : `Ningún inquilino tenía deuda vencida ${p.alCierre}.`}
        </Card>
      ) : (
        mora.map((m) => {
          const enDolares = m.moneda === 'USD' ? ' en dólares' : '';
          return (
            <div key={m.moneda} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Ancha>
                <KpiCard
                  label={`Deuda vencida${m.moneda === 'USD' ? ' U$S' : ''}`}
                  value={fmtMoneda(m.valor, m.moneda)}
                  sub={`${plural(m.conceptos, 'concepto', 'conceptos')} · ${plural(m.inquilinos, 'inquilino', 'inquilinos')}`}
                  icon="⏳"
                  tone="warning"
                  onClick={
                    m.indicador
                      ? abrir(
                          `Deuda vencida de inquilinos${enDolares}, a hoy`,
                          m.indicador,
                          VISTAS.mora,
                          { total: m.moneda },
                        )
                      : pedir(
                          `Deuda vencida de inquilinos${enDolares} ${p.alCierre}`,
                          'mora',
                          m.moneda,
                          VISTAS.mora,
                          { total: m.moneda },
                        )
                  }
                />
              </Ancha>
              {m.tramos.map((x) => {
                const titulo = `Deuda vencida · ${NOMBRE_TRAMO[x.tramo].toLowerCase()}, ${p.alCierre}`;
                return (
                  <Ancha key={x.tramo}>
                    <KpiCard
                      label={NOMBRE_TRAMO[x.tramo]}
                      value={fmtMoneda(x.valor, m.moneda)}
                      sub={plural(x.conceptos, 'concepto', 'conceptos')}
                      onClick={
                        x.indicador
                          ? abrir(titulo, x.indicador, VISTAS.mora, { total: m.moneda })
                          : pedir(titulo, 'mora', m.moneda, VISTAS.mora, {
                              total: m.moneda,
                              tramo: x.tramo,
                            })
                      }
                    />
                  </Ancha>
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
}
