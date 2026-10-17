'use client';

import type { TableroAlquileresDto } from '@vacker/types';
import { fmtMoneda } from '../../../lib/format';
import type { PeriodoTablero } from '../../../lib/periodo-tablero';
import { PeriodosChart } from '../../tablero/periodos-chart';
import { PeriodosTabla, type FilaPeriodos } from '../../tablero/periodos-tabla';
import { pct, plata, porcentaje, suma } from './formatos';
import { agrupados, delPeriodo, ejeDelPeriodo } from './periodo';

/**
 * El año mes a mes —o por trimestre—, como la sección Alquileres del Tablero
 * Comercial: el gráfico de dos paneles —lo emitido y lo que gana la
 * inmobiliaria— y, abajo, la planilla con cada número. Tocar un mes o un
 * trimestre lo elige en toda la pantalla (regla 80).
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
  const eje = ejeDelPeriodo(t, periodo);
  const meses = Array.from({ length: 12 }, (_, i) => `${t.anio}-${String(i + 1).padStart(2, '0')}`);
  // Los gráficos van en pesos, la moneda de toda la cartera de Vacker.
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
  const ingresosAntes = agrupados(
    meses.map((m) => totalIngreso(`${t.anio - 1}${m.slice(4)}`)),
    eje.trimestral,
  );
  const pctCobrado = (c: number, e: number) => (e > 0 ? (c / e) * 100 : 0);

  if (suma(emitido) === 0 && suma(ingresos) === 0) {
    return (
      <p className="p-5 text-sm text-muted">Todavía no hay alquileres generados en {t.anio}.</p>
    );
  }

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
      label: 'Honorarios',
      valores: honorarios,
      total: suma(honorarios),
      formato: plata,
      separa: true,
    },
    { label: 'Gastos adm.', valores: gastos, total: suma(gastos), formato: plata },
    { label: 'Punitorios', valores: punitorios, total: suma(punitorios), formato: plata },
    {
      label: 'Comisiones e informes',
      valores: comisiones,
      total: suma(comisiones),
      formato: plata,
    },
    { label: 'Ingresos', valores: ingresos, total: suma(ingresos), formato: plata, destaca: true },
    {
      label: `Ingresos ${t.anio - 1}`,
      valores: ingresosAntes,
      total: suma(ingresosAntes),
      formato: plata,
    },
  ];
  const elegirBarra = (i: number) =>
    elegir(eje.trimestral ? { por: 'trimestre', q: i } : { por: 'mes', mes: i });
  // El pie es del período elegido: un mes, un trimestre o el año.
  const p = delPeriodo(t, periodo);
  const enPesos = p.cobranza.find((c) => c.moneda === 'ARS');
  const ganado = p.ingresos.find((i) => i.moneda === 'ARS')?.total ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodosChart
        titulo={`Alquileres e ingresos por ${eje.porMesOTrimestre} de ${t.anio}`}
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
      />
      <PeriodosTabla
        titulo={`Alquileres e ingresos por ${eje.porMesOTrimestre} de ${t.anio}`}
        etiquetas={eje.etiquetas}
        filas={filas}
        seleccionado={eje.seleccionado}
        onSelect={elegirBarra}
        anchoMinimo={eje.anchoMinimo}
      />
      <p className="text-sm text-muted">
        <span className="font-bold text-ink">{p.nombre}</span>: cobrado al cierre de cada mes{' '}
        {pct(enPesos?.alCierre ?? 0, enPesos?.importeEmitido ?? 0)} de lo emitido · ingresos{' '}
        {fmtMoneda(ganado, 'ARS')}
      </p>
    </div>
  );
}
