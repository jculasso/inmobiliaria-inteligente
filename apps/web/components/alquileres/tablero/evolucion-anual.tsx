'use client';

import { useId, useState } from 'react';
import type { TableroAlquileresDto } from '@vacker/types';
import { fmtNum } from '../../../lib/format';
import type { PeriodoTablero } from '../../../lib/periodo-tablero';
import { PeriodosChart } from '../../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../../tablero/periodos-tabla';
import { CLASE_FOCO } from '../piezas';
import { plata, porcentaje, suma } from './formatos';
import { agrupados, ejeDelPeriodo } from './periodo';

/**
 * El año mes a mes —o por trimestre— de «Cómo vamos» (regla 182): UN gráfico,
 * el de lo emitido y lo que gana la inmobiliaria, y debajo la planilla con
 * cada número, plegada en «Ver mes por mes». Tocar un mes o un trimestre lo
 * elige en el bloque (regla 80). Sin comparación con el año anterior (regla
 * 183) ni pie: lo del período ya está en las tarjetas.
 */
export function EvolucionAnual({
  t,
  periodo,
  elegir,
}: {
  t: TableroAlquileresDto;
  periodo: PeriodoTablero;
  elegir: (p: PeriodoTablero) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const idPlanilla = useId();
  const eje = ejeDelPeriodo(t, periodo);
  const meses = Array.from({ length: 12 }, (_, i) => `${t.anio}-${String(i + 1).padStart(2, '0')}`);
  // Los gráficos van en pesos, la moneda de toda la cartera de Vacker (regla 26).
  const evolucion = (m: string) => t.evolucion.find((x) => x.mes === m && x.moneda === 'ARS');
  const ingreso = (m: string) => t.ingresos.find((x) => x.mes === m && x.moneda === 'ARS');
  const deIngreso = (campo: 'honorarios' | 'gastos' | 'punitorios' | 'comisiones') =>
    agrupados(
      meses.map((m) => ingreso(m)?.[campo] ?? 0),
      eje.trimestral,
    );
  const totalIngreso = (m: string) => {
    const i = ingreso(m);
    return i ? i.honorarios + i.gastos + i.punitorios + (i.comisiones ?? 0) : 0;
  };

  const emitido = agrupados(
    meses.map((m) => evolucion(m)?.emitido ?? 0),
    eje.trimestral,
  );
  const cobrado = agrupados(
    meses.map((m) => evolucion(m)?.cobrado ?? 0),
    eje.trimestral,
  );
  const ingresos = agrupados(meses.map(totalIngreso), eje.trimestral);
  const pctCobrado = (c: number, e: number) => (e > 0 ? (c / e) * 100 : 0);

  if (suma(emitido) === 0 && suma(ingresos) === 0) {
    return (
      <p className="rounded-brand border border-line bg-white p-5 text-sm text-muted">
        Todavía no hay alquileres generados en {t.anio}.
      </p>
    );
  }

  const nuevos = agrupados(
    t.nuevos.porMes.map((i) => i.valor),
    eje.trimestral,
  );
  const inicial = agrupados(t.nuevos.importePorMes, eje.trimestral);
  const honorarios = deIngreso('honorarios');
  const gastos = deIngreso('gastos');
  const punitorios = deIngreso('punitorios');
  const comisiones = deIngreso('comisiones');
  const filas: FilaPeriodos[] = [
    { label: 'Alquileres emitidos', valores: emitido, total: suma(emitido), formato: plata },
    { label: 'Cobrado al cierre', valores: cobrado, total: suma(cobrado), formato: plata },
    {
      label: '% cobrado',
      valores: emitido.map((e, i) => pctCobrado(cobrado[i]!, e)),
      // Se recalcula sobre los totales: el promedio de los porcentajes mentiría.
      total: pctCobrado(suma(cobrado), suma(emitido)),
      formato: porcentaje,
    },
    {
      label: 'Ingresos',
      valores: ingresos,
      total: suma(ingresos),
      formato: plata,
      destaca: true,
      separa: true,
    },
    { label: 'Honorarios', valores: honorarios, total: suma(honorarios), formato: plata },
    { label: 'Gastos adm.', valores: gastos, total: suma(gastos), formato: plata },
    { label: 'Punitorios', valores: punitorios, total: suma(punitorios), formato: plata },
    {
      label: 'Comisiones e informes',
      valores: comisiones,
      total: suma(comisiones),
      formato: plata,
    },
    ...(t.nuevos.porMes.length === 12
      ? [
          {
            label: 'Contratos nuevos',
            valores: nuevos,
            total: suma(nuevos),
            formato: (x: number) => fmtNum(x),
            separa: true,
          },
          {
            label: 'Alquiler inicial de los nuevos',
            valores: inicial,
            total: suma(inicial),
            formato: plata,
          },
        ]
      : []),
  ];
  const elegirBarra = (i: number) =>
    elegir(eje.trimestral ? { por: 'trimestre', q: i } : { por: 'mes', mes: i });
  const titulo = `Alquileres e ingresos por ${eje.porMesOTrimestre} de ${t.anio}`;

  return (
    <div className="flex flex-col gap-2">
      <PeriodosChart
        titulo={titulo}
        etiquetas={eje.etiquetas}
        barras={emitido}
        linea={ingresos}
        formatoBarras={plata}
        formatoLinea={plata}
        nombreBarras="Alquileres emitidos $"
        nombreLinea="Ingresos de la inmobiliaria $"
        nombreLineaCorto="Ingresos"
        transcurridos={eje.transcurridos}
        seleccionado={eje.seleccionado}
        onSelect={elegirBarra}
        pista={eje.pista}
        // Regla 186: acá el gráfico acompaña; las tarjetas y las tareas van primero.
        compacto
      />
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idPlanilla}
        onClick={() => setAbierta((x) => !x)}
        className={`inline-flex min-h-10 items-center gap-1.5 self-start rounded-md text-sm font-bold text-brand-red hover:underline ${CLASE_FOCO}`}
      >
        <span
          aria-hidden
          className={`inline-block transition-transform ${abierta ? 'rotate-90' : ''}`}
        >
          ›
        </span>
        {abierta ? 'Ocultar mes por mes' : 'Ver mes por mes'}
      </button>
      <div id={idPlanilla} hidden={!abierta} className="rounded-brand border border-line bg-white">
        {abierta && (
          <PeriodosTabla
            titulo={titulo}
            etiquetas={eje.etiquetas}
            filas={filas}
            seleccionado={eje.seleccionado}
            onSelect={elegirBarra}
            anchoMinimo={eje.anchoMinimo}
          />
        )}
      </div>
    </div>
  );
}
