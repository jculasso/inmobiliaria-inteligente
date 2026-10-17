'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  type FiltroTipoContrato,
  type IndicadorDetalleTablero,
  type MonedaAlquiler,
  type RespuestaTablerosAlquileres,
  type TramoMora,
  tablerosDeRespuesta,
} from '@vacker/types';
import { getDetalleTableroAlquileres } from '../../lib/alquileres-api';
import { nombreDelPeriodo, type PeriodoTablero } from '../../lib/periodo-tablero';
import { getAccessToken } from '../../lib/supabase/client';
import { EncabezadoPagina } from './piezas';
import { CobradoPorMesModal } from './tablero/cobrado-por-mes';
import { ComoVamos } from './tablero/como-vamos';
import { DetalleModal } from './tablero/detalle-modal';
import { BloqueHoy, type PedirDelMes } from './tablero/hoy';
import { crearListas, pedidoDelMes, pedidoDelPeriodo, pedidosALaVista } from './tablero/listas';
import { delPeriodo, direccion } from './tablero/periodo';
import { contratosQueEsperanElIndice, LoQueHayQueHacer } from './tablero/tareas';
import {
  VISTAS,
  type Columna,
  type Detalle,
  type IndicadorDetalle,
  type Moneda,
} from './tablero/vistas';

/**
 * El Dashboard del módulo, en tres bloques (reglas 176 a 186, 17/10/2026):
 *
 * - **Hoy** (regla 177): el mes en curso, a hoy y de toda la cartera —la
 *   línea del mes y cuatro tarjetas—.
 * - **Lo que hay que hacer** (reglas 179 a 181): a hoy y de toda la cartera,
 *   en tres grupos.
 * - **Cómo vamos** (regla 182): el período, con los únicos filtros de la
 *   pantalla —tipo, período y año—.
 *
 * Cada número abre la lista de lo que cuenta, y esa lista suma el número
 * (regla 26): lo de hoy llega junto con el tablero; lo de un período se pide
 * a la misma cuenta (regla 79) —en segundo plano apenas su tarjeta está a la
 * vista, y queda en memoria: tocarla no espera (reglas 189 y 190)—.
 *
 * Este archivo es la composición: el estado (tipo, período y año), las formas
 * de abrir un detalle y el orden de los bloques. Cada bloque vive en
 * `tablero/`.
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
  // Regla 188: la cuenta de «Cobrado dentro del mes», en esa moneda.
  const [porMes, setPorMes] = useState<MonedaAlquiler | null>(null);
  const [actualizando, startTransition] = useTransition();
  // Los tres cortes ya están acá: cambiar de tipo es instantáneo (Javier,
  // 6/10/2026: «parece que no está funcionando»). Solo el año vuelve a pedir.
  const [tipo, setTipo] = useState<FiltroTipoContrato>(tipoInicial);
  // Se expande acá, en el navegador, y una sola vez: así la forma compacta
  // viaja también de Vercel al navegador, no solo de la API a Vercel.
  const cortes = useMemo(() => tablerosDeRespuesta(tableros), [tableros]);
  // «Hoy» y lo que hay que hacer: siempre de toda la cartera (reglas 177 y 179).
  const todos = cortes.todos;
  // «Cómo vamos»: el corte del tipo elegido (regla 182).
  const t = cortes[tipo];
  const [anioElegido, setAnioElegido] = useState(t.anio);
  // Regla 182: al entrar, el año; los doce meses también están acá, así que
  // cambiar de período tampoco pide nada.
  const [periodo, setPeriodo] = useState<PeriodoTablero>(periodoInicial ?? { por: 'anio' });
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
  /** Abre el detalle de un número que viaja con el tablero: lo de hoy, con su lista. */
  const abrir =
    (
      titulo: string,
      indicador: IndicadorDetalle,
      columnas: [Columna, string][],
      extra: Partial<Detalle> = {},
    ) =>
    () =>
      setDetalle({ titulo, indicador, columnas, ...extra });

  // Reglas 189 y 190: las listas que se piden, en la memoria de esta pantalla.
  // Cada tablero trae la suya —al cambiar el año, o al recargar, empieza de
  // cero—, así que una lista nunca contradice a la tarjeta que la abre.
  const listas = useMemo(
    () =>
      crearListas((q) => getAccessToken().then((token) => getDetalleTableroAlquileres(token, q))),
    // `tableros` es la clave: con otro tablero, otra memoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableros],
  );

  const p = delPeriodo(t, periodo);
  /** Abre la lista de un número del período de «Cómo vamos» (regla 79). */
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
        pedido: pedidoDelPeriodo(p.rango, tipo, indicador, moneda, tramo),
        columnas,
        ...resto,
      });
    };
  /** Un flujo del mes en curso, de toda la cartera, para «Hoy» (regla 177). */
  const pedirDelMes: PedirDelMes =
    (titulo, indicador, moneda, columnas, extra = {}) =>
    () =>
      setDetalle({ titulo, pedido: pedidoDelMes(todos, indicador, moneda), columnas, ...extra });

  // Regla 190: apenas se pinta, y con cada período, tipo o año, se piden en
  // segundo plano las listas de las tarjetas a la vista. Lo que todavía no
  // salió de la tanda anterior se descarta.
  const aLaVista = useMemo(
    () => pedidosALaVista(todos, t, tipo, periodo),
    [todos, t, tipo, periodo],
  );
  useEffect(() => listas.anticipar(aLaVista), [listas, aLaVista]);

  /** Regla 188: la cuenta de «Cobrado dentro del mes»; un mes abre sus alquileres emitidos. */
  const abrirCobradoPorMes = (moneda: MonedaAlquiler) => () => {
    setDetalle(null);
    setPorMes(moneda);
  };
  const enDolares = (moneda: MonedaAlquiler) => (moneda === 'USD' ? ' en dólares' : '');
  const abrirMes = (moneda: MonedaAlquiler) => (mes: string) => {
    setPorMes(null);
    setDetalle({
      titulo: `Alquileres emitidos${enDolares(moneda)} de ${nombreDelPeriodo({ por: 'mes', mes: Number(mes.slice(5, 7)) }, Number(mes.slice(0, 4)))}`,
      pedido: pedidoDelPeriodo({ desde: mes, hasta: mes }, tipo, 'importeEmitido', moneda),
      columnas: VISTAS.cobranza,
      total: moneda,
      volver: { texto: 'Mes por mes', ir: abrirCobradoPorMes(moneda) },
    });
  };
  const cobradoPorMes = porMes && p.cobranza.find((c) => c.moneda === porMes);

  const esperanElIndice = contratosQueEsperanElIndice(todos);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Dashboard" />

      <BloqueHoy t={todos} abrir={abrir} pedirDelMes={pedirDelMes} />

      <LoQueHayQueHacer t={todos} abrir={abrir} />

      <ComoVamos
        t={t}
        tipo={tipo}
        elegirTipo={elegirTipo}
        periodo={periodo}
        elegirPeriodo={elegirPeriodo}
        anio={anioElegido}
        elegirAnio={elegirAnio}
        actualizando={actualizando}
        abrir={abrir}
        pedir={pedir}
        abrirCobradoPorMes={abrirCobradoPorMes}
      />

      {detalle && (
        <DetalleModal
          // Una lista nueva arranca de cero: no muestra la anterior mientras carga.
          key={`${detalle.titulo}|${JSON.stringify(detalle.pedido ?? null)}`}
          {...detalle}
          listas={listas}
          hoy={t.hoy}
          esperan={esperanElIndice}
          onClose={() => setDetalle(null)}
        />
      )}
      {porMes && (
        <CobradoPorMesModal
          titulo={`Cobrado dentro del mes${enDolares(porMes)}, ${p.nombre}`}
          moneda={porMes}
          meses={cobradoPorMes ? cobradoPorMes.porMes : []}
          mesEnCurso={t.mes}
          elegirMes={abrirMes(porMes)}
          onClose={() => setPorMes(null)}
        />
      )}
    </div>
  );
}
