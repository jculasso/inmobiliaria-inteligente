import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@vacker/ui';

// Las piezas de pantalla del módulo, copiadas del Tablero Comercial para que
// Alquileres se vea igual que el resto del sistema (pedido de Javier del
// 6/10/2026: «toda la gráfica, tal como está en los otros módulos»). Cada una
// replica el patrón que ese módulo escribe en línea: el título de la página
// con sus filtros (`app/tablero/page.tsx`), el rótulo de sección con su ícono,
// la insignia de estado (`lib/operacion-estado.ts`) y la tabla con encabezado
// fijo (`operaciones-table.tsx`).

/**
 * El título de la página, con sus filtros o acciones a la derecha. `volver`
 * pone arriba el camino de regreso («Cobros /»), como en la ficha de un contrato.
 */
export function EncabezadoPagina({ titulo, volver, children }: { titulo: string; volver?: { href: string; texto: string }; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {volver && (
          <p className="text-xs text-muted">
            <Link href={volver.href} className="hover:underline">
              {volver.texto}
            </Link>{' '}
            /
          </p>
        )}
        <h2 className="text-lg font-bold text-ink">{titulo}</h2>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

/** El rótulo de una sección, con su ícono: «📊 Resumen acumulado». */
export function TituloSeccion({ icono, children, detalle }: { icono: string; children: ReactNode; detalle?: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
      <span aria-hidden>{icono}</span> {children}
      {detalle && <span className="font-normal normal-case tracking-normal"> · {detalle}</span>}
    </h3>
  );
}

export type TonoInsignia = 'exito' | 'marca' | 'aviso' | 'neutro';

const TONO: Record<TonoInsignia, string> = {
  exito: 'bg-success/10 text-success',
  marca: 'bg-brand-red/10 text-brand-red',
  aviso: 'bg-warning/10 text-warning',
  neutro: 'bg-ink/5 text-muted',
};

/** La insignia de estado, igual a la de ventas. */
export function Insignia({ tono, children }: { tono: TonoInsignia; children: ReactNode }) {
  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${TONO[tono]}`}>{children}</span>;
}

/**
 * El contenedor de una tabla de escritorio, con el encabezado fijo y el
 * desplazamiento adentro, como la de ventas (ver el porqué en
 * `operaciones-table.tsx`): en el teléfono se esconde y van tarjetas.
 */
export const CLASE_TABLA_ANCHA =
  'hidden max-h-[clamp(20rem,60vh,48rem)] overflow-x-auto overflow-y-auto overscroll-contain rounded-brand border border-line bg-white sm:block';

/** Una celda de encabezado fija arriba. */
export const CLASE_TH = 'sticky top-0 z-20 border-b border-line bg-white px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted';

/** El contenedor de las tarjetas del teléfono. */
export const CLASE_LISTA_MOVIL = 'rounded-brand border border-line bg-white sm:hidden';

/** El buscador de las listas, igual al de ventas. */
export const CLASE_BUSCADOR =
  'h-9 w-full max-w-sm rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red';

/** La primera columna de una tabla ancha (el código), fija a la izquierda al desplazar. */
export const CLASE_TD_FIJA = 'sticky left-0 z-10 whitespace-nowrap border-r border-line bg-white px-3 py-2 font-semibold tabular-nums text-ink';

/** Una celda común de tabla ancha. */
export const CLASE_TD = 'whitespace-nowrap px-3 py-2';

/** Una fila de tabla que se abre al tocarla. */
export const CLASE_TR_ABRIBLE = 'cursor-pointer border-b border-line last:border-0 hover:bg-surface/60 [&:hover>td]:bg-surface/60';

/**
 * La barra de una lista, como la de ventas: el buscador a la izquierda y, a la
 * derecha, cuántas se ven de cuántas hay y el botón de alta.
 */
export function BarraLista({
  busqueda,
  onBusqueda,
  placeholder,
  visibles,
  total,
  nombre,
  children,
}: {
  busqueda?: string;
  onBusqueda?: (v: string) => void;
  placeholder?: string;
  visibles: number;
  total: number;
  /** En plural: «contratos». */
  nombre: string;
  /** El botón de alta (`BotonNuevo`). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {onBusqueda ? (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={CLASE_BUSCADOR}
        />
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-xs text-muted">
          {visibles === total ? `${total} ${nombre}` : `${visibles} de ${total} ${nombre}`}
        </span>
        {children}
      </div>
    </div>
  );
}

/** El botón de alta de una lista: «＋ Nuevo contrato». Con `href` navega; con `onClick` abre un modal. */
export function BotonNuevo({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const boton = (
    <Button variant="primary" size="sm" onClick={onClick}>
      ＋ {children}
    </Button>
  );
  return href ? <Link href={href}>{boton}</Link> : boton;
}

/** Lo que se muestra en lugar de una lista vacía, o de una búsqueda sin resultados. */
export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/**
 * El encabezado de una tarjeta del teléfono, como en ventas: el título en
 * negrita, debajo «código · fecha» y la insignia de estado a la derecha.
 */
export function CabezaTarjeta({ titulo, detalle, insignia }: { titulo: ReactNode; detalle?: ReactNode; insignia?: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-[11px] text-muted">{detalle}</span>}
      </span>
      {insignia}
    </div>
  );
}

/** Un bloque de pantalla con su rótulo arriba, en una tarjeta blanca. */
export function Bloque({ icono, titulo, detalle, children, acciones }: { icono: string; titulo: ReactNode; detalle?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloSeccion icono={icono} detalle={detalle}>
          {titulo}
        </TituloSeccion>
        {acciones}
      </div>
      <div className="overflow-hidden rounded-brand border border-line bg-white shadow-sm">{children}</div>
    </section>
  );
}

/** Una tarjeta de ficha, con su rótulo arriba a la izquierda y, si hace falta, algo a la derecha. */
export function Panel({ icono, titulo, derecha, children }: { icono: string; titulo: ReactNode; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-brand border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloSeccion icono={icono}>{titulo}</TituloSeccion>
        {derecha}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** La celda de acciones de una tabla ancha, fija a la derecha, como en ventas. */
export const CLASE_TD_ACCIONES = 'sticky right-0 border-l border-line bg-white px-2 py-2';
export const CLASE_TH_ACCIONES = `${CLASE_TH} right-0 z-30 border-l`;

/**
 * El lápiz y la papelera de cada fila, como en ventas (pedido de Javier del
 * 6/10/2026: «todo tiene que quedar homogéneo»). La papelera borra lo que no
 * tiene historia y anula lo demás: `anula` cambia el ícono y el texto.
 */
export function AccionesFila({
  nombre,
  onEditar,
  onBorrar,
  anula = false,
  tarjeta = false,
}: {
  /** De qué es la fila, para lectores de pantalla: «el contrato ALT-0003». */
  nombre: string;
  onEditar?: () => void;
  onBorrar?: () => void;
  anula?: boolean;
  /** En la tarjeta del teléfono van con texto; en la tabla, solo el ícono. */
  tarjeta?: boolean;
}) {
  const parar = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  if (!onEditar && !onBorrar) return null;
  if (tarjeta) {
    return (
      <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
        {onEditar && (
          <button type="button" onClick={parar(onEditar)} className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">
            ✏️ Editar
          </button>
        )}
        {onBorrar && (
          <button type="button" onClick={parar(onBorrar)} className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5">
            {anula ? '🚫 Anular' : '🗑️ Borrar'}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {onEditar && (
        <button type="button" onClick={parar(onEditar)} aria-label={`Editar ${nombre}`} title="Editar" className="rounded px-1.5 py-0.5 text-base hover:bg-surface">
          ✏️
        </button>
      )}
      {onBorrar && (
        <button
          type="button"
          onClick={parar(onBorrar)}
          aria-label={`${anula ? 'Anular' : 'Borrar'} ${nombre}`}
          title={anula ? 'Anular, con un motivo' : 'Borrar'}
          className="rounded px-1.5 py-0.5 text-base hover:bg-brand-red/5"
        >
          {anula ? '🚫' : '🗑️'}
        </button>
      )}
    </div>
  );
}

/** «Registró Lucía · 06/10/2026 14:32». */
export function Registrado({ por, en }: { por: string | null; en?: string | null }) {
  if (!por && !en) return null;
  const cuando = en ? new Date(en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : null;
  return (
    <span className="text-xs text-muted">
      {por ? `Registró ${por}` : 'Registrado'}
      {cuando ? ` · ${cuando}` : ''}
    </span>
  );
}
