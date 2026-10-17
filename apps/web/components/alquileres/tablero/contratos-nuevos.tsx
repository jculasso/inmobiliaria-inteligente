'use client';

import type { Indicador, TableroAlquileresDto } from '@vacker/types';
import { Card, KpiCard } from '@vacker/ui';
import { fmtMoneda, fmtNum } from '../../../lib/format';
import type { PeriodoTablero } from '../../../lib/periodo-tablero';
import { PeriodosChart } from '../../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../../tablero/periodos-tabla';
import { TituloSeccion } from '../piezas';
import { Ancha } from './ancha';
import { plata, suma } from './formatos';
import { agrupados, delPeriodo, ejeDelPeriodo } from './periodo';
import type { Moneda } from './vistas';

/**
 * Contratos nuevos (punto 8, «es fundamental»): los del período, como las
 * ventas del Tablero Comercial. Un contrato es «nuevo» en el mes en que
 * empieza. Sigue al selector de la pantalla (regla 75): ya no tiene sus
 * propias tarjetas Q1 a Q4.
 */
export function ContratosNuevos({
  t,
  periodo,
  elegir,
  onAbrir,
}: {
  t: TableroAlquileresDto;
  periodo: PeriodoTablero;
  elegir: (p: PeriodoTablero) => void;
  onAbrir: (titulo: string, ind: Indicador, total?: Moneda) => void;
}) {
  const n = t.nuevos;
  if (n.porMes.length !== 12) return null;
  const p = delPeriodo(t, periodo);
  const eje = ejeDelPeriodo(t, periodo);
  const cantidades = agrupados(
    n.porMes.map((i) => i.valor),
    eje.trimestral,
  );
  const importes = agrupados(n.importePorMes, eje.trimestral);
  const anteriores = agrupados(n.anterior, eje.trimestral);
  const filas: FilaPeriodos[] = [
    {
      label: 'Contratos nuevos',
      valores: cantidades,
      total: suma(cantidades),
      formato: (x) => fmtNum(x),
      destaca: true,
    },
    {
      label: `Nuevos ${t.anio - 1}`,
      valores: anteriores,
      total: suma(anteriores),
      formato: (x) => fmtNum(x),
    },
    {
      label: 'Alquiler inicial $',
      valores: importes,
      total: suma(importes),
      formato: plata,
      separa: true,
    },
  ];
  const elegirBarra = (i: number) =>
    elegir(eje.trimestral ? { por: 'trimestre', q: i } : { por: 'mes', mes: i });
  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion icono="🆕" detalle={`los que empiezan en ${p.nombre}`}>
        Contratos nuevos
      </TituloSeccion>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={`Nuevos en ${p.nombre}`}
          value={fmtNum(p.nuevos.indicador.valor)}
          sub={`${fmtNum(p.nuevos.anterior)} en ${t.anio - 1}`}
          icon="🆕"
          tone="brand"
          onClick={() => onAbrir(`Contratos nuevos de ${p.nombre}`, p.nuevos.indicador)}
        />
        <Ancha>
          <KpiCard
            label="Alquiler inicial"
            value={fmtMoneda(p.nuevos.importe, 'ARS')}
            sub="de los nuevos, en pesos"
            icon="💰"
            onClick={() =>
              onAbrir(`Alquiler inicial de los nuevos, ${p.nombre}`, p.nuevos.indicador, 'ARS')
            }
          />
        </Ancha>
      </div>
      <Card className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <PeriodosChart
            titulo={`Contratos nuevos por ${eje.porMesOTrimestre} de ${t.anio}`}
            etiquetas={eje.etiquetas}
            barras={cantidades}
            linea={importes}
            formatoBarras={(x) => fmtNum(x)}
            formatoLinea={plata}
            nombreBarras="Contratos nuevos"
            nombreLinea="Alquiler inicial de los nuevos $"
            nombreLineaCorto="Alquiler inicial"
            barrasEnteras
            transcurridos={eje.transcurridos}
            seleccionado={eje.seleccionado}
            onSelect={elegirBarra}
            pista={eje.pista}
          />
          <PeriodosTabla
            titulo={`Contratos nuevos por ${eje.porMesOTrimestre} de ${t.anio}`}
            etiquetas={eje.etiquetas}
            filas={filas}
            seleccionado={eje.seleccionado}
            onSelect={elegirBarra}
            anchoMinimo={eje.trimestral ? 'min-w-[34rem]' : 'min-w-[52rem]'}
          />
        </div>
      </Card>
    </section>
  );
}
