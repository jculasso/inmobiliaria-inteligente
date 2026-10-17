'use client';

import { Card, KpiCard } from '@vacker/ui';
import { fmtMoneda, fmtNum } from '../../../lib/format';
import type { PeriodoTablero } from '../../../lib/periodo-tablero';
import { TituloSeccion } from '../piezas';
import { Ancha } from './ancha';
import { pct } from './formatos';
import type { DelPeriodo } from './periodo';
import { VISTAS, type Pedir } from './vistas';

/**
 * La cobranza del período, una sección por moneda: es un flujo (regla 75),
 * la suma de sus meses. Cada tarjeta pide su lista al abrirla (regla 79).
 */
export function Cobranza({
  p,
  periodo,
  pedir,
}: {
  p: DelPeriodo;
  periodo: PeriodoTablero;
  pedir: Pedir;
}) {
  return p.cobranza.length === 0 ? (
    <section className="flex flex-col gap-2">
      <TituloSeccion icono="💵">Cobranza de {p.nombre}</TituloSeccion>
      <Card className="py-4 text-sm text-muted">No hay alquileres emitidos en {p.nombre}.</Card>
    </section>
  ) : (
    <>
      {p.cobranza.map((c) => (
        <section key={c.moneda} className="flex flex-col gap-2">
          <TituloSeccion icono="💵" detalle={c.moneda === 'USD' ? 'en dólares' : undefined}>
            Cobranza de {p.nombre}
          </TituloSeccion>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Alquileres emitidos"
              value={fmtNum(c.emitidos)}
              sub={periodo.por === 'mes' ? 'del mes' : `de ${p.nombre}`}
              icon="🧾"
              onClick={pedir(
                `Alquileres emitidos de ${p.nombre}`,
                'emitidos',
                c.moneda,
                VISTAS.cobranza,
              )}
            />
            <KpiCard
              label="Alquileres cobrados"
              value={fmtNum(c.cobrados)}
              sub={`${pct(c.cobrados, c.emitidos)} de los emitidos`}
              icon="✅"
              tone="success"
              onClick={pedir(
                `Alquileres cobrados del todo, ${p.nombre}`,
                'cobrados',
                c.moneda,
                VISTAS.cobranza,
              )}
            />
            <Ancha>
              <KpiCard
                label="Importe emitido"
                value={fmtMoneda(c.importeEmitido, c.moneda)}
                sub="lo que hay que cobrar"
                icon="📄"
                onClick={pedir(
                  `Importe emitido de ${p.nombre}`,
                  'importeEmitido',
                  c.moneda,
                  VISTAS.cobranza,
                  { total: c.moneda },
                )}
              />
            </Ancha>
            <Ancha>
              {/* Regla 76: lo cobrado hasta hoy, y cuánto de eso entró dentro de su mes. */}
              <KpiCard
                label="Importe cobrado"
                value={fmtMoneda(c.importeCobrado, c.moneda)}
                sub={`${pct(c.importeCobrado, c.importeEmitido)} de lo emitido · ${pct(c.alCierre, c.importeEmitido)} se cobró dentro del mes`}
                icon="💵"
                tone="success"
                onClick={pedir(
                  `Importe cobrado de ${p.nombre}`,
                  'importeCobrado',
                  c.moneda,
                  VISTAS.cobrado,
                  { total: c.moneda },
                )}
              />
            </Ancha>
          </div>
        </section>
      ))}
    </>
  );
}
