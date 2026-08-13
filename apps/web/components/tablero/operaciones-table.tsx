'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  compararOperaciones,
  recortarAlLimite,
  type DirOrden,
  type OperacionDto,
  type OrdenOperacion,
  type TipoOperacion,
  type VendedorDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { deleteOperacion } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { estadoClass, estadoLabel } from '../../lib/operacion-estado';
import { AvisoListaRecortada } from '../aviso-lista-recortada';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { EncabezadoOrdenable } from './encabezado-ordenable';
import { OperacionFormModal } from './operacion-form-modal';

interface Props {
  tipo: TipoOperacion;
  operaciones: OperacionDto[];
  vendedores: VendedorDto[];
  /** Alta, edición y borrado van juntos: los tres son de dirección/admin. */
  puedeEscribir: boolean;
  /** Orden con el que la API devolvió esta lista (viene de la URL). */
  orden: OrdenOperacion;
  dir: DirOrden;
}

export function OperacionesTable({
  tipo,
  operaciones: recibidas,
  vendedores,
  puedeEscribir,
  orden,
  dir,
}: Props) {
  const router = useRouter();
  // La API pide una fila de más que el tope: si vino, es que quedó algo afuera.
  const { visibles: operaciones, hayMas } = recortarAlLimite(recibidas);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'create' | OperacionDto | null>(null);
  const [aBorrar, setABorrar] = useState<OperacionDto | null>(null);

  /**
   * Orden en el que se está mostrando la tabla.
   *
   * Cuando la lista vino COMPLETA (`!hayMas`), reordenar no necesita ir al
   * servidor: las filas ya están todas en el navegador. Se ordena en memoria y
   * el click es instantáneo — que con la API en EE.UU. y la base en San Pablo
   * es la diferencia entre "no pasó nada" y una tabla que responde.
   *
   * Si la lista quedó recortada, ordenar en memoria sería mentir: ordenaría las
   * 500 que bajaron y no las 500 primeras del orden pedido. En ese caso el
   * encabezado navega y vuelve a consultar (ver `EncabezadoOrdenable`).
   */
  const [ordenLocal, setOrdenLocal] = useState<{ orden: OrdenOperacion; dir: DirOrden }>({
    orden,
    dir,
  });
  // Si el server manda una lista con otro orden (p. ej. tras navegar porque la
  // lista está recortada), el estado local lo sigue en vez de pisarlo.
  const [ordenRecibido, setOrdenRecibido] = useState({ orden, dir });
  if (ordenRecibido.orden !== orden || ordenRecibido.dir !== dir) {
    setOrdenRecibido({ orden, dir });
    setOrdenLocal({ orden, dir });
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? operaciones.filter((op) => {
          const nombresPuntas = op.puntas.map((p) => p.nombre.toLowerCase()).join(' ');
          return (
            op.direccion.toLowerCase().includes(q) ||
            op.estado.toLowerCase().includes(q) ||
            nombresPuntas.includes(q)
          );
        })
      : operaciones;

    const yaOrdenada = ordenLocal.orden === orden && ordenLocal.dir === dir;
    if (yaOrdenada) return base;
    return [...base].sort((a, b) => compararOperaciones(a, b, ordenLocal.orden, ordenLocal.dir));
  }, [operaciones, busqueda, ordenLocal, orden, dir]);

  async function handleDelete(id: string) {
    const accessToken = await getAccessToken();
    await deleteOperacion(accessToken, id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {hayMas && <AvisoListaRecortada que={tipo === 'venta' ? 'ventas' : 'alquileres'} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={tipo === 'venta' ? 'Buscar por dirección, vendedor o estado…' : 'Buscar por dirección…'}
          className="h-9 w-full max-w-sm rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
        />
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted">
            {filtradas.length} de {operaciones.length} operaciones
          </span>
          {puedeEscribir && (
            <Button variant="primary" size="sm" onClick={() => setModal('create')}>
              ＋ {tipo === 'venta' ? 'Nueva venta' : 'Nuevo alquiler'}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-brand border border-line bg-white sm:hidden">
        {filtradas.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">Sin operaciones para mostrar.</p>
        ) : (
          <ListaTarjetas etiqueta="Operaciones">
            {filtradas.map((op) => {
              const vend = op.puntas.find((p) => p.lado === 'vendedora');
              const comp = op.puntas.find((p) => p.lado === 'compradora');
              return (
                <Tarjeta key={op.id}>
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">{op.direccion}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {op.codigo} · Firma {op.fechaFirma ?? '—'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${estadoClass(op.estado)}`}
                    >
                      {estadoLabel(op.estado)}
                    </span>
                  </div>

                  <CamposTarjeta>
                    <CampoTarjeta etiqueta={tipo === 'venta' ? 'Precio' : 'Valor/mes'}>
                      {fmtUSD(tipo === 'venta' ? op.precio : op.valorMensual)}
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="Comisión">{fmtUSD(op.comTotal)}</CampoTarjeta>
                    {tipo === 'venta' && (
                      <>
                        <CampoTarjeta etiqueta="Vendedora">{vend?.nombre ?? '—'}</CampoTarjeta>
                        <CampoTarjeta etiqueta="Compradora">{comp?.nombre ?? '—'}</CampoTarjeta>
                      </>
                    )}
                  </CamposTarjeta>

                  {puedeEscribir && (
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
                      <button
                        type="button"
                        onClick={() => setModal(op)}
                        className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setABorrar(op)}
                        className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5"
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  )}
                </Tarjeta>
              );
            })}
          </ListaTarjetas>
        )}
      </div>

      {/*
        Altura acotada y scroll DENTRO de la tabla, en vez de dejar crecer la
        página.

        Con los 39 alquileres de una inmobiliaria real la página medía 2,4
        pantallas y los títulos de columna se iban arriba: a la altura de la
        fila 20 ya no se sabía si esa cifra era el valor mensual o la comisión.

        No alcanzaba con hacer el `thead` fijo. Este contenedor tiene
        `overflow-x-auto` para las pantallas angostas, y CSS obliga a que
        entonces el eje vertical también sea `auto`: eso lo convierte en área de
        scroll, y el `sticky` pasa a referirse a él y no a la página — con lo
        cual nunca se activaba. Dándole altura propia, el área de scroll es la
        tabla y el encabezado sí se queda.

        60vh y no un cálculo contra el alto del encabezado: arriba hay barra de
        módulo, navegación, título y buscador, y esa suma cambia entre pantallas.
        Un porcentaje no se pasa nunca.
      */}
      <div className="hidden max-h-[60vh] overflow-x-auto overflow-y-auto overscroll-contain rounded-brand border border-line bg-white sm:block">
        <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            {/*
              La línea va en cada celda y no en la fila: al quedarse fija, la
              fila no se mueve pero sus celdas sí, y el borde se pierde — las
              filas terminan pegadas contra los títulos.
            */}
            <tr className="text-left text-xs uppercase tracking-wide text-muted [&>th]:border-b [&>th]:border-line">
              <EncabezadoOrdenable
                columna="codigo"
                // La esquina: fija en los dos ejes a la vez. Si la ventana
                // obliga a desplazar de costado, el código queda a la vista, y
                // al bajar por la lista el nombre de la columna también.
                // z-30 porque tiene que pasar por encima tanto del resto del
                // encabezado (z-20) como de la columna de código (z-10).
                thClass="sticky left-0 top-0 z-30 bg-white"
                activa={ordenLocal.orden === 'codigo'}
                dir={ordenLocal.dir}
                enMemoria={!hayMas}
                onOrdenar={setOrdenLocal}
              >
                Código
              </EncabezadoOrdenable>
              <EncabezadoOrdenable
                columna="fechaFirma"
                thClass="sticky top-0 z-20 bg-white"
                activa={ordenLocal.orden === 'fechaFirma'}
                dir={ordenLocal.dir}
                enMemoria={!hayMas}
                onOrdenar={setOrdenLocal}
              >
                Firma
              </EncabezadoOrdenable>
              <th className="sticky top-0 z-20 bg-white px-2 py-2">Dirección</th>
              {tipo === 'venta' ? (
                <>
                  <th className="sticky top-0 z-20 bg-white px-2 py-2">Precio</th>
                  <th className="sticky top-0 z-20 bg-white px-2 py-2">Ptas</th>
                  <th className="sticky top-0 z-20 bg-white px-2 py-2">Vendedora</th>
                  <th className="sticky top-0 z-20 bg-white px-2 py-2">Compradora</th>
                </>
              ) : (
                <th className="sticky top-0 z-20 bg-white px-2 py-2">Valor/mes</th>
              )}
              <th className="sticky top-0 z-20 bg-white px-2 py-2">Comisión</th>
              <th className="sticky top-0 z-20 bg-white px-2 py-2">Estado</th>
              {puedeEscribir && <th className="sticky right-0 top-0 z-30 bg-white px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td
                  colSpan={(tipo === 'venta' ? 9 : 6) + (puedeEscribir ? 1 : 0)}
                  className="px-4 py-6 text-center text-muted"
                >
                  Sin operaciones para mostrar.
                </td>
              </tr>
            ) : (
              filtradas.map((op) => {
                const vend = op.puntas.find((p) => p.lado === 'vendedora');
                const comp = op.puntas.find((p) => p.lado === 'compradora');
                return (
                  <tr key={op.id} className="border-b border-line last:border-0">
                    <td className="sticky left-0 z-10 border-r border-line bg-white px-2 py-2 text-muted">{op.codigo}</td>
                    <td className="px-2 py-2">{op.fechaFirma ?? '—'}</td>
                    <td className="px-2 py-2">
                      <span className="block max-w-[140px] truncate" title={op.direccion}>
                        {op.direccion}
                      </span>
                    </td>
                    {tipo === 'venta' ? (
                      <>
                        <td className="px-2 py-2">{fmtUSD(op.precio)}</td>
                        <td className="px-2 py-2">{op.cantPuntas}</td>
                        <td className="max-w-[110px] truncate px-2 py-2" title={vend?.nombre ?? undefined}>
                          {vend?.nombre ?? '—'}
                        </td>
                        <td className="max-w-[110px] truncate px-2 py-2" title={comp?.nombre ?? undefined}>
                          {comp?.nombre ?? '—'}
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2">{fmtUSD(op.valorMensual)}</td>
                    )}
                    <td className="px-2 py-2">{fmtUSD(op.comTotal)}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estadoClass(op.estado)}`}>
                        {estadoLabel(op.estado)}
                      </span>
                    </td>
                    {puedeEscribir && (
                      <td className="sticky right-0 border-l border-line bg-white px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setModal(op)}
                            aria-label="Editar"
                            className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setABorrar(op)}
                            aria-label="Borrar"
                            title="Borrar esta operación"
                            className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <OperacionFormModal
          tipo={tipo}
          vendedores={vendedores}
          operacion={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={tipo === 'venta' ? 'Borrar venta' : 'Borrar alquiler'}
          descripcion={
            tipo === 'venta'
              ? 'La venta y sus puntas se eliminan de la base. Los KPIs, el ranking y los objetivos se recalculan sin ella.'
              : 'El alquiler se elimina de la base. Los KPIs del período se recalculan sin él.'
          }
          detalle={
            <>
              <DatoBorrado etiqueta="Código">{aBorrar.codigo}</DatoBorrado>
              <DatoBorrado etiqueta="Dirección">{aBorrar.direccion}</DatoBorrado>
              <DatoBorrado etiqueta={tipo === 'venta' ? 'Precio' : 'Valor/mes'}>
                {fmtUSD(tipo === 'venta' ? aBorrar.precio : aBorrar.valorMensual)}
              </DatoBorrado>
              <DatoBorrado etiqueta="Comisión">{fmtUSD(aBorrar.comTotal)}</DatoBorrado>
              <DatoBorrado etiqueta="Estado">{estadoLabel(aBorrar.estado)}</DatoBorrado>
              {aBorrar.puntas.length > 0 && (
                <DatoBorrado etiqueta="Puntas">
                  {aBorrar.puntas.map((p) => p.nombre).join(' · ')}
                </DatoBorrado>
              )}
            </>
          }
          onConfirm={() => handleDelete(aBorrar.id)}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}
