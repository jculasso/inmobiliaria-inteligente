'use client';

import type { FiltroTipoContrato, Indicador, TableroAlquileresDto } from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtMoneda, fmtNum } from '../../../lib/format';
import { TituloSeccion } from '../piezas';
import { Ancha } from './ancha';
import { plural, suma } from './formatos';
import type { DelPeriodo } from './periodo';
import { RepartoTipo } from './tipo-de-contrato';
import { VISTAS, type Abrir, type Pedir } from './vistas';

/**
 * La cartera del período: los vigentes, el alquiler mensual y lo que vence.
 * Es una foto (regla 77): a hoy, con su lista; al cierre, el número y la
 * lista se pide.
 */
export function Cartera({
  t,
  p,
  abrir,
  pedir,
  elegirTipo,
}: {
  t: TableroAlquileresDto;
  p: DelPeriodo;
  abrir: Abrir;
  pedir: Pedir;
  elegirTipo: (tipo: FiltroTipoContrato) => void;
}) {
  // --- Las fotos (regla 77): a hoy, con su lista; al cierre, el número y la lista se pide ---
  const vigentes = p.aHoy
    ? {
        valor: t.cartera.vigentes.valor,
        vivienda: t.cartera.vivienda,
        comercial: t.cartera.comercial,
      }
    : { valor: p.cierre!.vigentes, vivienda: p.cierre!.vivienda, comercial: p.cierre!.comercial };
  const abrirVigentes = p.aHoy
    ? abrir('Contratos vigentes, a hoy', t.cartera.vigentes, VISTAS.contratos)
    : pedir(`Contratos vigentes ${p.alCierre}`, 'vigentes', 'ARS', VISTAS.contratos);
  const alquilerMensual = p.aHoy
    ? t.cartera.alquilerMensual.map((a) => ({
        moneda: a.moneda,
        valor: a.indicador.valor,
        contratos: a.indicador.filas.length,
        indicador: a.indicador as Indicador | undefined,
      }))
    : p.cierre!.alquilerMensual.map((a) => ({ ...a, indicador: undefined }));

  // Las tres ventanas de vencimiento juntas, para la tarjeta de la cartera.
  const vencen90: Indicador = {
    valor: suma(t.tareas.vencen.map((v) => v.indicador.valor)),
    filas: t.tareas.vencen.flatMap((v) => v.indicador.filas),
  };

  return (
    <section className="flex flex-col gap-2">
      <TituloSeccion icono="🏘️" detalle={p.alCierre}>
        Cartera
      </TituloSeccion>
      {/*
        Los ingresos del período tienen su sección, con el desglose: acá
        eran la misma cifra dos veces (Javier, 7/10/2026). Con alquileres
        en dólares hay una tarjeta más.
      */}
      <div
        className={`grid grid-cols-2 gap-3 ${alquilerMensual.length > 1 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
      >
        <Ancha>
          <KpiCard
            label="Contratos vigentes"
            value={fmtNum(vigentes.valor)}
            sub={`${plural(vigentes.vivienda, 'particular', 'particulares')} · ${plural(vigentes.comercial, 'comercial', 'comerciales')}`}
            icon="📄"
            tone="brand"
            onClick={abrirVigentes}
          />
        </Ancha>
        {alquilerMensual.map((a) => {
          const titulo = `Alquiler mensual${a.moneda === 'USD' ? ' en dólares' : ''}, ${p.alCierre}`;
          return (
            <Ancha key={a.moneda}>
              <KpiCard
                label={a.moneda === 'USD' ? 'Alquiler mensual U$S' : 'Alquiler mensual'}
                value={fmtMoneda(a.valor, a.moneda)}
                sub={`de ${plural(a.contratos, 'contrato', 'contratos')}${a.moneda === 'USD' ? ' en dólares' : ''}`}
                icon="💰"
                onClick={
                  a.indicador
                    ? abrir(titulo, a.indicador, VISTAS.alquilerMensual, { total: a.moneda })
                    : pedir(titulo, 'alquilerMensual', a.moneda, VISTAS.alquilerMensual, {
                        total: a.moneda,
                      })
                }
              />
            </Ancha>
          );
        })}
        <Ancha>
          <KpiCard
            label="Vencen en 90 días"
            value={fmtNum(vencen90.valor)}
            sub="contratos para renovar, a hoy"
            icon="📅"
            tone={vencen90.valor ? 'warning' : 'default'}
            onClick={abrir('Contratos que vencen en los próximos 90 días', vencen90, VISTAS.vencen)}
          />
        </Ancha>
      </div>
      {t.tipo === 'todos' && <RepartoTipo porTipo={t.cartera.porTipo} onElegir={elegirTipo} />}
    </section>
  );
}
