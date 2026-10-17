'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  type FiltroTipoContrato,
  type Indicador,
  type IndicadorDetalleTablero,
  type RespuestaTablerosAlquileres,
  type TramoMora,
  tablerosDeRespuesta,
} from '@vacker/types';
import { Card } from '@vacker/ui';
import { periodoPorDefecto, type PeriodoTablero } from '../../lib/periodo-tablero';
import { EncabezadoPagina, TituloSeccion } from './piezas';
import { FiltroAnio, FiltroPeriodo } from './selector-periodo';
import { Cartera } from './tablero/cartera';
import { Cobranza } from './tablero/cobranza';
import { ContratosNuevos } from './tablero/contratos-nuevos';
import { DetalleModal } from './tablero/detalle-modal';
import { EvolucionAnual } from './tablero/evolucion-anual';
import { Ingresos } from './tablero/ingresos';
import { Morosidad } from './tablero/morosidad';
import { delPeriodo, direccion } from './tablero/periodo';
import { contratosQueEsperanElIndice, LoQueHayQueHacer } from './tablero/tareas';
import { FiltroTipo } from './tablero/tipo-de-contrato';
import { VISTAS, type Columna, type Detalle, type Moneda } from './tablero/vistas';

/**
 * El tablero del módulo (reglas 26 a 32 y 74 a 82), armado con las piezas del
 * Tablero Comercial: tarjetas con ícono que se abren, rótulos de sección con
 * ícono y el gráfico de dos paneles con su planilla. Cada número abre la lista
 * de lo que cuenta, y esa lista suma el número: lo de hoy llega junto con el
 * tablero; lo de un período se pide al abrirlo, a la misma cuenta.
 *
 * Este archivo es la composición: el estado (tipo, período y año), las dos
 * formas de abrir un detalle y el orden de las secciones. Cada sección vive
 * en `tablero/`.
 */
export function TableroAlquileres({
  tableros,
  tipoInicial = 'todos',
  periodoInicial,
}: {
  /** La forma compacta (cada fila una vez) o, de una API anterior, la completa. */
  tableros: RespuestaTablerosAlquileres;
  tipoInicial?: FiltroTipoContrato;
  periodoInicial?: PeriodoTablero;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [actualizando, startTransition] = useTransition();
  // Los tres cortes ya están acá: cambiar de tipo es instantáneo (Javier,
  // 6/10/2026: «parece que no está funcionando»). Solo el año vuelve a pedir.
  const [tipo, setTipo] = useState<FiltroTipoContrato>(tipoInicial);
  // Se expande acá, en el navegador, y una sola vez: así la forma compacta
  // viaja también de Vercel al navegador, no solo de la API a Vercel.
  const cortes = useMemo(() => tablerosDeRespuesta(tableros), [tableros]);
  const t = cortes[tipo];
  const [anioElegido, setAnioElegido] = useState(t.anio);
  // Regla 74: los doce meses también están acá; cambiar de período tampoco pide nada.
  const [periodo, setPeriodo] = useState<PeriodoTablero>(
    periodoInicial ?? periodoPorDefecto(t.hoy, t.anio),
  );
  const elegirTipo = (nuevo: FiltroTipoContrato) => {
    setTipo(nuevo);
    // La dirección acompaña, sin pedirle nada al servidor.
    window.history.replaceState(null, '', direccion(pathname, t.hoy, t.anio, nuevo, periodo));
  };
  const elegirPeriodo = (nuevo: PeriodoTablero) => {
    setPeriodo(nuevo);
    window.history.replaceState(null, '', direccion(pathname, t.hoy, t.anio, tipo, nuevo));
  };
  const elegirAnio = (anio: number) => {
    setAnioElegido(anio);
    startTransition(() =>
      router.push(direccion(pathname, t.hoy, anio, tipo, periodo), { scroll: false }),
    );
  };
  const abrir =
    (
      titulo: string,
      indicador: Indicador,
      columnas: [Columna, string][],
      extra: Partial<Detalle> = {},
    ) =>
    () =>
      setDetalle({ titulo, indicador, columnas, ...extra });

  const p = delPeriodo(t, periodo);
  /** Abre la lista de un número del período: se pide al abrirla (regla 79). */
  const pedir =
    (
      titulo: string,
      indicador: IndicadorDetalleTablero,
      moneda: Moneda,
      columnas: [Columna, string][],
      extra: Partial<Detalle> & { tramo?: TramoMora } = {},
    ) =>
    () => {
      const { tramo, ...resto } = extra;
      setDetalle({
        titulo,
        pedido: { indicador, ...p.rango, moneda, ...(tramo ? { tramo } : {}) },
        columnas,
        ...resto,
      });
    };

  const esperanElIndice = contratosQueEsperanElIndice(t);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Dashboard">
        {actualizando && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <span
              aria-hidden
              className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-brand-red"
            />
            Actualizando…
          </span>
        )}
        <FiltroTipo tipo={tipo} cambiar={elegirTipo} />
        <FiltroPeriodo
          periodo={periodo}
          porDefecto={periodoPorDefecto(t.hoy, t.anio).mes}
          cambiar={elegirPeriodo}
        />
        <FiltroAnio hoy={t.hoy} anio={anioElegido} cambiar={elegirAnio} />
      </EncabezadoPagina>

      <div
        aria-busy={actualizando}
        className={`flex flex-col gap-5 transition-opacity ${actualizando ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Cartera t={t} p={p} abrir={abrir} pedir={pedir} elegirTipo={elegirTipo} />

        <ContratosNuevos
          t={t}
          periodo={periodo}
          elegir={elegirPeriodo}
          onAbrir={(titulo, ind, total) =>
            setDetalle({ titulo, indicador: ind, columnas: VISTAS.nuevos, total })
          }
        />

        <Cobranza p={p} periodo={periodo} pedir={pedir} />

        <Ingresos p={p} pedir={pedir} />

        <Morosidad t={t} p={p} abrir={abrir} pedir={pedir} />

        <section className="flex flex-col gap-2">
          <TituloSeccion icono="📊" detalle={`en pesos, ${t.anio}`}>
            Alquileres e ingresos
          </TituloSeccion>
          <Card className="p-0">
            <EvolucionAnual t={t} periodo={periodo} elegir={elegirPeriodo} />
          </Card>
        </section>

        <LoQueHayQueHacer t={t} abrir={abrir} />
      </div>

      {detalle && (
        <DetalleModal
          // Una lista nueva arranca de cero: no muestra la anterior mientras carga.
          key={`${detalle.titulo}|${JSON.stringify(detalle.pedido ?? null)}`}
          {...detalle}
          tipo={tipo}
          hoy={t.hoy}
          esperan={esperanElIndice}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
