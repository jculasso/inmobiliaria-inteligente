import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { mesLargo, sumarMesesIso } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { fmtFechaHora } from '../../lib/format';

// Las piezas de pantalla del módulo, copiadas del Tablero Comercial para que
// Alquileres se vea igual que el resto del sistema (pedido de Javier del
// 6/10/2026: «toda la gráfica, tal como está en los otros módulos»). Cada una
// replica el patrón que ese módulo escribe en línea: el título de la página
// con sus filtros (`app/tablero/page.tsx`), el rótulo de sección con su ícono,
// la insignia de estado (`lib/operacion-estado.ts`) y la tabla con encabezado
// fijo (`operaciones-table.tsx`).

/**
 * El anillo de foco del teclado, igual en todos los botones propios del
 * módulo: sin él, quien navega con Tab no ve dónde está parado (los botones de
 * `@vacker/ui` ya lo traen; estos se escriben a mano).
 */
export const CLASE_FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40';

/**
 * El título de la página, con sus filtros o acciones a la derecha. `volver`
 * pone arriba el camino de regreso («Cobros /»), como en la ficha de un contrato;
 * `detalle`, debajo del título, lo que lo identifica (la dirección, el contacto).
 */
export function EncabezadoPagina({
  titulo,
  volver,
  detalle,
  children,
}: {
  titulo: ReactNode;
  volver?: { href: string; texto: string };
  detalle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap justify-between gap-3 ${detalle ? 'items-start' : 'items-center'}`}>
      <div className="min-w-0">
        {volver && (
          <p className="text-xs text-muted">
            <Link href={volver.href} className={`rounded hover:underline ${CLASE_FOCO}`}>
              {volver.texto}
            </Link>{' '}
            /
          </p>
        )}
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-ink">{titulo}</h2>
        {detalle}
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

/**
 * `peligro` es lo urgente o vencido: va con `danger`, que ninguna inmobiliaria
 * pisa. `marca` es el color de cada inmobiliaria —en Alteva, verde— y no sirve
 * para avisar que algo urge (CONVENCIONES_TECNICAS §13). Lo anulado va
 * `neutro`, como algo que ya no cuenta; lo pendiente, `aviso`.
 */
export type TonoInsignia = 'exito' | 'marca' | 'aviso' | 'peligro' | 'neutro';

const TONO: Record<TonoInsignia, string> = {
  exito: 'bg-success/10 text-success',
  marca: 'bg-brand-red/10 text-brand-red',
  aviso: 'bg-warning/10 text-warning',
  peligro: 'bg-danger/10 text-danger',
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
 * El contenido de la primera celda de una fila que se abre al tocarla, como
 * link de verdad: el `onClick` de la fila no se alcanza con el teclado, el
 * link sí (Tab y Enter), y se puede abrir en otra pestaña. No deja pasar el
 * clic a la fila, que si no navegaría dos veces.
 */
export function LinkFila({ href, children, etiqueta }: { href: string; children: ReactNode; etiqueta?: string }) {
  return (
    <Link href={href} aria-label={etiqueta} onClick={(e) => e.stopPropagation()} className={`rounded hover:underline ${CLASE_FOCO}`}>
      {children}
    </Link>
  );
}

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

/**
 * El botón de alta de una lista: «＋ Nuevo contrato». Con `href` navega; con
 * `onClick` abre un modal. `icono` cambia el «＋» cuando la acción tiene el
 * suyo en todo el módulo («🧾 Liquidar»).
 */
export function BotonNuevo({ href, onClick, icono = '＋', children }: { href?: string; onClick?: () => void; icono?: string; children: ReactNode }) {
  const boton = (
    <Button variant="primary" size="sm" onClick={onClick}>
      {icono} {children}
    </Button>
  );
  return href ? <Link href={href}>{boton}</Link> : boton;
}

/** Lo que se muestra en lugar de una lista vacía, o de una búsqueda sin resultados. */
export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/** Lo mismo, dentro de un `Bloque`: el bloque ya pone el borde y el fondo. */
export function VacioBloque({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4 text-sm text-muted">{children}</p>;
}

/** Un dato de una ficha, con su rótulo arriba. Va dentro de un `<dl>`; vacío, una raya. */
export function Dato({ etiqueta, children, className = '' }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children == null || children === false || children === '' ? '—' : children}</dd>
    </div>
  );
}

/**
 * Elegir una de pocas vistas («Abiertos · Todos», «De octubre · Para
 * controlar»), igual en todas las pantallas. Con `hrefDe`, cada opción es un
 * link (la vista vive en la dirección y se puede compartir); si no, un botón
 * apretado o no.
 */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  hrefDe,
}: {
  /** Qué se elige, para el lector de pantalla: «Qué reclamos». */
  etiqueta: string;
  opciones: readonly (readonly [T, ReactNode])[];
  valor: T;
  onCambio?: (v: T) => void;
  hrefDe?: (v: T) => string;
}) {
  const clase = (v: T) => `rounded-brand px-3 py-1 text-sm font-semibold ${CLASE_FOCO} ${valor === v ? 'bg-brand-red text-white' : 'text-muted hover:text-ink'}`;
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1 rounded-brand border border-line bg-white p-1">
      {opciones.map(([v, texto]) =>
        hrefDe ? (
          <Link key={v} href={hrefDe(v)} aria-current={valor === v ? 'page' : undefined} className={clase(v)}>
            {texto}
          </Link>
        ) : (
          <button key={v} type="button" aria-pressed={valor === v} onClick={() => onCambio?.(v)} className={clase(v)}>
            {texto}
          </button>
        ),
      )}
    </div>
  );
}

/** «Diciembre de 2026»: mayúscula solo al principio (`capitalize` daría «Diciembre De»). */
export const mesTitulo = (periodo: string) => mesLargo(`${periodo}-01`).replace(/^./, (l) => l.toUpperCase());

/** El período `n` meses antes o después: «2026-10» → «2026-11». */
export const correrPeriodo = (periodo: string, n: number) => sumarMesesIso(`${periodo}-01`, n).slice(0, 7);

/** El mes que se está mirando, con flechas al anterior y al siguiente. El mes viaja en la dirección (`?periodo=`). */
export function NavegadorMes({ periodo }: { periodo: string }) {
  const flecha = `rounded-brand px-2.5 py-1 text-lg text-muted hover:text-ink ${CLASE_FOCO}`;
  return (
    <div className="flex items-center gap-1 rounded-brand border border-line bg-white">
      <Link href={`?periodo=${correrPeriodo(periodo, -1)}`} aria-label="Mes anterior" className={flecha}>
        ‹
      </Link>
      <span className="min-w-[9.5rem] text-center text-sm font-bold text-ink">{mesTitulo(periodo)}</span>
      <Link href={`?periodo=${correrPeriodo(periodo, 1)}`} aria-label="Mes siguiente" className={flecha}>
        ›
      </Link>
    </div>
  );
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
  extra,
}: {
  /** De qué es la fila, para lectores de pantalla: «el contrato ALT-0003». */
  nombre: string;
  onEditar?: () => void;
  onBorrar?: () => void;
  anula?: boolean;
  /** En la tarjeta del teléfono van con texto; en la tabla, solo el ícono. */
  tarjeta?: boolean;
  /** Lo propio de la fila, antes del lápiz y la papelera: «📄 PDF». Va con `AccionFila`. */
  extra?: ReactNode;
}) {
  if (!onEditar && !onBorrar && !extra) return null;
  return (
    <div className={tarjeta ? 'mt-2 flex items-center justify-end gap-1 border-t border-line pt-2' : 'flex items-center gap-1'}>
      {extra}
      {onEditar && <AccionFila icono="✏️" texto="Editar" etiqueta={`Editar ${nombre}`} title="Editar" onClick={onEditar} tarjeta={tarjeta} />}
      {onBorrar && (
        <AccionFila
          icono={anula ? '🚫' : '🗑️'}
          texto={anula ? 'Anular' : 'Borrar'}
          etiqueta={`${anula ? 'Anular' : 'Borrar'} ${nombre}`}
          title={anula ? 'Anular, con un motivo' : 'Borrar'}
          onClick={onBorrar}
          tarjeta={tarjeta}
          peligro
        />
      )}
    </div>
  );
}

/**
 * Un botón de la fila: en la tarjeta del teléfono, ícono y texto; en la
 * tabla, solo el ícono, con el nombre entero para el lector de pantalla. No
 * deja pasar el clic a la fila, que se abre al tocarla.
 */
export function AccionFila({
  icono,
  texto,
  etiqueta,
  title,
  onClick,
  tarjeta = false,
  peligro = false,
}: {
  icono: string;
  texto: string;
  /** Lo que lee el lector de pantalla en la tabla: «Anular el recibo 000123». En la tarjeta se lee el texto, que ya está en su contexto. */
  etiqueta: string;
  title?: string;
  onClick: () => void;
  tarjeta?: boolean;
  /** Anular o borrar: el texto de la tarjeta va en rojo de urgencia, no en el color de la marca. */
  peligro?: boolean;
}) {
  const parar = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  if (tarjeta) {
    return (
      <button
        type="button"
        onClick={parar}
        className={`rounded px-2 py-1 text-xs font-semibold ${CLASE_FOCO} ${peligro ? 'text-danger hover:bg-danger/5' : 'text-ink hover:bg-surface'}`}
      >
        {icono} {texto}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={parar}
      aria-label={etiqueta}
      title={title ?? texto}
      className={`rounded px-1.5 py-0.5 text-base ${CLASE_FOCO} ${peligro ? 'hover:bg-danger/5' : 'hover:bg-surface'}`}
    >
      {icono}
    </button>
  );
}

/**
 * La pantalla de «listo» después de registrar un cobro o una liquidación,
 * igual en los dos: qué se registró, los botones (primero «Ver la cuenta») y
 * abajo el camino de vuelta a la lista.
 */
export function Confirmacion({ titulo, detalle, children, volver }: { titulo: ReactNode; detalle?: ReactNode; children: ReactNode; volver: { href: string; texto: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-brand border border-success/30 bg-white p-5 shadow-sm">
      <p role="status" className="flex items-start gap-2 text-lg font-extrabold text-ink">
        <span aria-hidden>✅</span>
        <span>{titulo}</span>
      </p>
      {detalle}
      <div className="flex flex-wrap gap-2">{children}</div>
      <Link href={volver.href} className={`w-fit rounded text-sm font-semibold text-muted hover:text-ink hover:underline ${CLASE_FOCO}`}>
        ← {volver.texto}
      </Link>
    </div>
  );
}

/** «Registró Lucía · 06/10/2026 14:32». */
export function Registrado({ por, en }: { por: string | null; en?: string | null }) {
  if (!por && !en) return null;
  const cuando = en ? fmtFechaHora(en) : null;
  return (
    <span className="text-xs text-muted">
      {por ? `Registró ${por}` : 'Registrado'}
      {cuando ? ` · ${cuando}` : ''}
    </span>
  );
}
