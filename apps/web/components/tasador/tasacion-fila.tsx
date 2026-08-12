'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TasacionResumenDto } from '@vacker/types';
import { fmtFecha, fmtNum, fmtUSD } from '../../lib/format';
import { detalleEstado, estadoClass } from '../../lib/tasacion-estado';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';

interface Props {
  tasacion: TasacionResumenDto;
  /** Click en el badge de estado (abre el modal de cambio de estado). */
  onEstado: () => void;
  /** Generar/ver el informe PDF. */
  onVer: () => void;
  /** Muestra el spinner "Generando…" en el botón Ver. */
  generando?: boolean;
  /** Si viene, se muestra el botón de borrar (vista de gestión / historial). */
  onBorrar?: () => Promise<void>;
}

/**
 * Fila de tasación compartida entre el dashboard ("últimas tasaciones") y el
 * historial, para que ambas vistas se vean igual y no se desincronicen.
 */
export function TasacionFila({ tasacion: t, onEstado, onVer, generando, onBorrar }: Props) {
  const router = useRouter();
  const det = detalleEstado(t);
  const [aBorrar, setABorrar] = useState(false);

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
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onEstado}
          className={`w-full rounded-full px-2 py-1 text-center text-xs font-bold ${estadoClass(t.estado)}`}
        >
          {t.estado}
        </button>
        {det && (
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${estadoClass(t.estado)}`}>{det}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => router.push(`/tasador/tasaciones/${t.id}/editar`)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onVer}
          disabled={generando}
          aria-busy={generando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:cursor-progress disabled:opacity-70"
        >
          {generando ? (
            <>
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border-2 border-brand-red border-t-transparent"
              />
              Generando…
            </>
          ) : (
            'Ver'
          )}
        </button>
        {onBorrar && (
          <button
            type="button"
            onClick={() => setABorrar(true)}
            title="Borrar esta tasación"
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
          >
            Borrar
          </button>
        )}
      </div>

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
