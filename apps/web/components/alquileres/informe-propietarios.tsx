'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { nombreDelRango } from '@vacker/domain';
import type { CadenaInformeDto, InformePropietariosDto } from '@vacker/types';
import { fmtMoneda } from '../../lib/format';
import {
  mesInformePorDefecto,
  parametrosDelInforme,
  type PeriodoInforme,
} from '../../lib/periodo-tablero';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import {
  CabezaTarjeta,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  LinkFila,
  Vacio,
} from './piezas';
import { FiltroAnio, FiltroPeriodo } from './selector-periodo';

// Siete columnas no entran en una tablet: tarjetas hasta `lg`, tabla desde ahí.
const CLASE_TABLA = CLASE_TABLA_ANCHA.replace('sm:block', 'lg:block');
const CLASE_TARJETAS = 'rounded-brand border border-line bg-white lg:hidden';

/** Lo que muestra cada columna de plata: la tabla y las tarjetas leen lo mismo. */
// La de «Pendiente de liquidar» lleva debajo, si hay, lo que se le descuenta en
// la próxima (regla 98): así no hace falta otra columna y la tabla no crece.
const COLUMNAS: [string, (c: CadenaInformeDto) => number, boolean?][] = [
  ['Cobrado', (c) => c.cobrado],
  ['Honorarios', (c) => c.honorarios],
  [
    'Otros descuentos',
    (c) => Math.round((c.impuestos + c.expensas + c.arreglos + c.otros) * 100) / 100,
  ],
  ['Liquidado', (c) => c.liquidado],
  ['Pendiente de liquidar', (c) => c.pendiente, true],
];

/** Una línea por moneda: pesos y dólares no se suman (regla 88). */
function PorMoneda({
  monedas,
  valor,
  conADescontar = false,
}: {
  monedas: CadenaInformeDto[];
  valor: (c: CadenaInformeDto) => number;
  /** Regla 98: debajo de lo pendiente, lo que se le descuenta en la próxima. */
  conADescontar?: boolean;
}) {
  return (
    <>
      {monedas.map((c) => (
        <span key={c.moneda} className="block whitespace-nowrap tabular-nums">
          {fmtMoneda(valor(c), c.moneda)}
          {conADescontar && c.aDescontar > 0 && (
            <span className="block text-xs font-normal text-warning">
              a descontar {fmtMoneda(c.aDescontar, c.moneda)}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

/**
 * «Informe de propietarios» (regla 96, Javier, 7/10/2026: «algo global que lo
 * vea el administrador de la inmobiliaria»): cada propietario del período con
 * lo que cobró, lo que se le descontó, lo que se le liquidó, lo que queda por
 * liquidar y sus reclamos. Cada fila abre su informe, en la ficha, con el
 * mismo período. Los números son los de cada informe: salen del mismo cálculo.
 */
export function InformePropietarios({
  datos,
  hoy,
  elegido,
}: {
  datos: InformePropietariosDto;
  hoy: string;
  elegido: PeriodoInforme;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [actualizando, startTransition] = useTransition();
  const periodo = nombreDelRango(datos.desde, datos.hasta);
  const ir = (p: PeriodoInforme) => {
    const q = new URLSearchParams(parametrosDelInforme(p, hoy));
    startTransition(() =>
      router.push(`${pathname}${q.toString() ? `?${q}` : ''}`, { scroll: false }),
    );
  };
  const hrefDe = (personaId: string) =>
    `/alquileres/personas/${personaId}?${new URLSearchParams([
      ['solapa', 'informe'],
      ...parametrosDelInforme(elegido, hoy),
    ])}`;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Informe de propietarios"
        detalle={
          <p className="text-sm text-muted">
            {periodo} · lo cobrado y lo liquidado, hasta hoy. Cada fila abre su informe para
            descargarlo o mandárselo.
          </p>
        }
      >
        {actualizando && (
          <span role="status" className="text-xs font-semibold text-muted">
            Actualizando…
          </span>
        )}
        <FiltroPeriodo
          periodo={elegido.periodo}
          porDefecto={mesInformePorDefecto(hoy, elegido.anio).mes}
          cambiar={(p) => ir({ ...elegido, periodo: p })}
        />
        <FiltroAnio hoy={hoy} anio={elegido.anio} cambiar={(anio) => ir({ ...elegido, anio })} />
      </EncabezadoPagina>

      {datos.filas.length === 0 ? (
        <Vacio>Ningún propietario tiene contratos en {periodo}.</Vacio>
      ) : (
        <div
          aria-busy={actualizando}
          className={`flex flex-col gap-4 transition-opacity ${actualizando ? 'opacity-50' : ''}`}
        >
          <div className={CLASE_TARJETAS}>
            <ListaTarjetas etiqueta="Propietarios" hasta="lg">
              {datos.filas.map((f) => (
                <Tarjeta
                  key={f.persona.id}
                  onClick={() => router.push(hrefDe(f.persona.id))}
                  titulo={`Abrir el informe de ${f.persona.nombre}`}
                >
                  <CabezaTarjeta
                    titulo={f.persona.nombre}
                    detalle={`${f.contratos} ${f.contratos === 1 ? 'contrato' : 'contratos'} · ${f.reclamos} ${f.reclamos === 1 ? 'reclamo' : 'reclamos'}`}
                  />
                  {f.monedas.length === 0 ? (
                    <span className="mt-2 block text-sm text-muted">Sin movimientos</span>
                  ) : (
                    <CamposTarjeta>
                      {COLUMNAS.map(([nombre, valor, conADescontar]) => (
                        <CampoTarjeta key={nombre} etiqueta={nombre}>
                          <PorMoneda
                            monedas={f.monedas}
                            valor={valor}
                            conADescontar={conADescontar}
                          />
                        </CampoTarjeta>
                      ))}
                    </CamposTarjeta>
                  )}
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>

          <div className={CLASE_TABLA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${CLASE_TH} left-0 z-30 border-r`}>Propietario</th>
                  {COLUMNAS.map(([nombre]) => (
                    <th key={nombre} className={`${CLASE_TH} text-right`}>
                      {nombre}
                    </th>
                  ))}
                  <th className={`${CLASE_TH} text-right`}>Reclamos</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((f) => (
                  <tr
                    key={f.persona.id}
                    onClick={() => router.push(hrefDe(f.persona.id))}
                    className={`${CLASE_TR_ABRIBLE} align-top`}
                  >
                    <td className={CLASE_TD_FIJA}>
                      <LinkFila href={hrefDe(f.persona.id)}>{f.persona.nombre}</LinkFila>
                      <span className="block text-xs font-normal text-muted">
                        {f.contratos} {f.contratos === 1 ? 'contrato' : 'contratos'}
                      </span>
                    </td>
                    {f.monedas.length === 0 ? (
                      <td colSpan={COLUMNAS.length} className={`${CLASE_TD} text-muted`}>
                        Sin movimientos
                      </td>
                    ) : (
                      COLUMNAS.map(([nombre, valor, conADescontar]) => (
                        <td key={nombre} className={`${CLASE_TD} text-right text-ink`}>
                          <PorMoneda
                            monedas={f.monedas}
                            valor={valor}
                            conADescontar={conADescontar}
                          />
                        </td>
                      ))
                    )}
                    <td className={`${CLASE_TD} text-right tabular-nums text-muted`}>
                      {f.reclamos}
                    </td>
                  </tr>
                ))}
              </tbody>
              {datos.totales.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line bg-surface/60 font-bold">
                    <td className={`${CLASE_TD} sticky left-0 bg-surface`}>
                      Total
                      <span className="block text-xs font-normal text-muted">
                        {datos.filas.reduce((s, f) => s + f.contratos, 0)} contratos
                      </span>
                    </td>
                    {COLUMNAS.map(([nombre, valor, conADescontar]) => (
                      <td key={nombre} className={`${CLASE_TD} text-right`}>
                        <PorMoneda
                          monedas={datos.totales}
                          valor={valor}
                          conADescontar={conADescontar}
                        />
                      </td>
                    ))}
                    <td className={`${CLASE_TD} text-right tabular-nums`}>
                      {datos.filas.reduce((s, f) => s + f.reclamos, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {datos.totales.length > 0 && (
            <p className="text-xs text-muted lg:hidden">
              Total:{' '}
              {datos.totales
                .map(
                  (t) =>
                    `cobrado ${fmtMoneda(t.cobrado, t.moneda)}, liquidado ${fmtMoneda(t.liquidado, t.moneda)}`,
                )
                .join(' · ')}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
