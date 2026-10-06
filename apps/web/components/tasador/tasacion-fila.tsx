'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TasacionResumenDto } from '@vacker/types';
import { fmtFecha, fmtNum, fmtUSD } from '../../lib/format';
import { detalleEstado, tonoEstadoTasacion } from '../../lib/tasacion-estado';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AccionFila, AccionesFila, CLASE_FOCO, Insignia } from '../piezas';

interface Props {
  tasacion: TasacionResumenDto;
  /** Click en el badge de estado (abre el modal de cambio de estado). */
  onEstado: () => void;
  /** Generar el informe PDF. */
  onVer: () => void;
  /** Mientras se genera el PDF de esta fila. */
  generando?: boolean;
  /** Si viene, se muestra el botón de borrar (vista de gestión / historial). */
  onBorrar?: () => Promise<void>;
}

/**
 * Editar es ir a otra página: un link de verdad (se abre en otra pestaña, se
 * llega con Tab), con la misma pinta que los botones de `AccionesFila`.
 */
function LinkEditar({ href, nombre, tarjeta }: { href: string; nombre: string; tarjeta: boolean }) {
  return tarjeta ? (
    <Link
      href={href}
      className={`rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface ${CLASE_FOCO}`}
    >
      ✏️ Editar
    </Link>
  ) : (
    <Link
      href={href}
      aria-label={`Editar ${nombre}`}
      title="Editar"
      className={`rounded px-1.5 py-0.5 text-base hover:bg-surface ${CLASE_FOCO}`}
    >
      ✏️
    </Link>
  );
}

/**
 * Fila de tasación compartida entre el dashboard ("últimas tasaciones") y el
 * historial, para que ambas vistas se vean igual y no se desincronicen.
 */
export function TasacionFila({ tasacion: t, onEstado, onVer, generando, onBorrar }: Props) {
  const det = detalleEstado(t);
  const [aBorrar, setABorrar] = useState(false);
  const nombre = `la tasación de ${t.direccion}`;
  const href = `/tasador/tasaciones/${t.id}/editar`;

  // Las acciones como en el resto de la app (pedido de Javier del 6/10/2026:
  // «todo tiene que quedar homogéneo»): en el teléfono con texto, en
  // escritorio solo el ícono con el nombre completo para el lector de pantalla.
  const acciones = (tarjeta: boolean) => (
    <AccionesFila
      nombre={nombre}
      tarjeta={tarjeta}
      onBorrar={onBorrar ? () => setABorrar(true) : undefined}
      extra={
        <>
          {generando ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted"
            >
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border-2 border-brand-red border-t-transparent"
              />
              Generando…
            </span>
          ) : (
            <AccionFila
              icono="📄"
              texto="PDF"
              etiqueta={`Descargar el PDF de ${nombre}`}
              title="Descargar el PDF"
              onClick={onVer}
              tarjeta={tarjeta}
            />
          )}
          <LinkEditar href={href} nombre={nombre} tarjeta={tarjeta} />
        </>
      }
    />
  );

  return (
    <div className="grid grid-cols-1 gap-2 border-t border-surface py-3 first:border-t-0 sm:grid-cols-[2fr_92px_1fr_130px_auto] sm:items-center sm:gap-3.5">
      <div className="min-w-0">
        {/*
          La ciudad va PEGADA a la dirección y no en una línea nueva: en el
          historial hay decenas de filas y una línea más por fila multiplica el
          scroll en el celular. Como sufijo liviano se lee de un vistazo y, si
          no entra, envuelve sola.
        */}
        <div className="text-sm font-bold text-ink">
          {t.direccion}
          {t.ciudad && <span className="font-medium text-muted"> · {t.ciudad}</span>}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {t.cliente} · {t.tipoPropiedad} · {fmtNum(t.superficieTotal)} m² · {t.agente.nombre}
        </div>
      </div>
      {/*
        Fecha y precio: dos columnas en escritorio, UNA sola línea en el celular.
        `sm:contents` hace desaparecer este envoltorio a partir de `sm`, así los
        dos hijos vuelven a ser celdas de la grilla. Sin esto, en el celular la
        fecha se llevaba una línea entera para sí sola —unos 24px por fila— y
        con veinte tasaciones eso es media pantalla de scroll de más.
      */}
      <div className="flex items-baseline gap-2.5 sm:contents">
        <div className="text-xs text-muted sm:whitespace-nowrap">{fmtFecha(t.fecha)}</div>
        <div className="text-sm font-bold text-brand-red">{fmtUSD(t.valorRecomendado)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:flex-col">
        <button
          type="button"
          onClick={onEstado}
          aria-label={`Cambiar el estado de ${nombre} (${t.estado})`}
          title="Cambiar el estado"
          className={`rounded-full ${CLASE_FOCO}`}
        >
          <Insignia tono={tonoEstadoTasacion(t.estado)}>{t.estado} ▾</Insignia>
        </button>
        {det && <span className="text-[10.5px] font-semibold text-muted">{det}</span>}
      </div>
      <div className="sm:hidden">{acciones(true)}</div>
      <div className="hidden justify-end sm:flex">{acciones(false)}</div>

      {aBorrar && onBorrar && (
        <ConfirmarBorradoModal
          titulo="Borrar tasación"
          descripcion="Se elimina la tasación con sus comparables, fotos e informes. Los KPIs del Tasador se recalculan sin ella."
          detalle={
            <>
              <DatoBorrado etiqueta="Dirección">{t.direccion}</DatoBorrado>
              <DatoBorrado etiqueta="Cliente">{t.cliente}</DatoBorrado>
              <DatoBorrado etiqueta="Agente">{t.agente.nombre}</DatoBorrado>
              <DatoBorrado etiqueta="Valor recomendado">{fmtUSD(t.valorRecomendado)}</DatoBorrado>
              <DatoBorrado etiqueta="Estado">{t.estado}</DatoBorrado>
            </>
          }
          onConfirm={onBorrar}
          onClose={() => setABorrar(false)}
        />
      )}
    </div>
  );
}
