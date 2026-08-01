import Image from 'next/image';
import Link from 'next/link';

/*
 * Lo que comparten la portada y las páginas de módulo: el ancho, el
 * encabezado, el pie y el marco de las capturas.
 *
 * El menú no tiene botón de hamburguesa a propósito. Son cinco enlaces: en
 * teléfono entran en una fila que se desliza, y eso no necesita JavaScript ni
 * deja el menú abierto cuando el visitante vuelve atrás.
 */

export const ANCHO = 'mx-auto w-full max-w-[1120px] px-6 sm:px-8';

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted sm:text-xs">
      {children}
    </p>
  );
}

/** El orden es el del ciclo del negocio, no el de importancia. */
export const MODULOS = [
  { ruta: '/tasador', nombre: 'Tasador', numero: '01' },
  { ruta: '/protocolo', nombre: 'Protocolo 5 Semanas', numero: '02' },
  { ruta: '/tablero', nombre: 'Tablero Comercial', numero: '03' },
  { ruta: '/tareas', nombre: 'To Do List', numero: '04' },
] as const;

export function Encabezado() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <div className={`${ANCHO} flex h-16 items-center justify-between gap-4`}>
        {/* En teléfono las dos palabras se apilan: juntas miden ~175px y, al
            lado del botón, no entran en 375. Apiladas ocupan la mitad y el
            encabezado sigue siendo de una sola fila. */}
        <Link
          href="/"
          className="shrink-0 text-[13px] font-extrabold leading-[1.15] text-ink sm:text-[15px] sm:leading-none"
        >
          Inmobiliaria{' '}
          <span className="block text-brand-red sm:inline">Inteligente</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {MODULOS.map((m) => (
            <Link
              key={m.ruta}
              href={m.ruta}
              className="text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              {m.nombre}
            </Link>
          ))}
        </nav>

        <Link
          href="/#demostracion"
          className="shrink-0 rounded-brand bg-brand-red px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-red-dark sm:text-sm"
        >
          <span className="sm:hidden">Demostración</span>
          <span className="hidden sm:inline">Pedir una demostración</span>
        </Link>
      </div>

      {/* En pantallas chicas los módulos van abajo, en una fila que se desliza. */}
      <nav className="flex gap-5 overflow-x-auto border-t border-line px-6 py-2.5 lg:hidden">
        {MODULOS.map((m) => (
          <Link
            key={m.ruta}
            href={m.ruta}
            className="whitespace-nowrap text-[13px] font-semibold text-muted"
          >
            {m.nombre}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Pie() {
  return (
    <footer className="border-t border-line py-12">
      <div className={`${ANCHO} flex flex-wrap items-start justify-between gap-8`}>
        <div>
          <p className="text-sm font-bold text-ink">Inmobiliaria Inteligente</p>
          <p className="text-sm text-muted">Rosario, Argentina</p>
          <a
            href="mailto:contacto@inmobiliariainteligente.net"
            className="mt-3 inline-block text-sm font-semibold text-brand-red hover:underline"
          >
            contacto@inmobiliariainteligente.net
          </a>
        </div>
        <nav className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Módulos</p>
          {MODULOS.map((m) => (
            <Link key={m.ruta} href={m.ruta} className="text-sm text-muted hover:text-ink">
              {m.nombre}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/**
 * Una captura del sistema.
 *
 * `alt` no es decorativo: describe lo que se ve, porque es lo único que le
 * llega a quien navega con lector de pantalla y a quien tiene las imágenes
 * bloqueadas. `pie` es el texto visible debajo, y va escrito para el que mira
 * la captura sin leer el resto de la página.
 *
 * Las capturas salen de la inmobiliaria de demostración. NUNCA de Vacker: son
 * datos de un cliente real y no van en material comercial.
 */
export function Captura({
  src,
  ancho,
  alto,
  alt,
  pie,
  telefono,
}: {
  src: string;
  ancho: number;
  alto: number;
  alt: string;
  pie: string;
  /** Marca las capturas sacadas de un celular. Ver abajo por qué importa. */
  telefono?: boolean;
}) {
  /*
   * Una captura de celular NO puede ocupar el ancho del texto. Estirada a 670px
   * queda de 1451px de alto: el visitante se pasa cuatro pantallas rodando
   * sobre una sola imagen, y además una pantalla de teléfono agrandada al
   * triple no se lee como un teléfono. Se muestra a tamaño de teléfono, que es
   * justamente lo que se quiere demostrar.
   */
  const marco = telefono
    ? 'mx-auto w-full max-w-[280px] rounded-[28px] border-[6px] border-ink'
    : 'rounded-brand border border-line';

  return (
    <figure className="mt-8">
      <div className={`overflow-hidden bg-surface ${marco}`}>
        <Image
          src={src}
          width={ancho}
          height={alto}
          alt={alt}
          className="h-auto w-full"
          /*
           * Sin `sizes`, Next asume que la imagen puede llegar a ocupar toda la
           * ventana y genera una versión de 3840px de ancho para mostrarla a
           * 670. Eso es trabajo de servidor y megabytes de más por una imagen
           * que nadie va a ver a ese tamaño. Acá se le dice cuánto mide de
           * verdad: el ancho del texto en escritorio, la pantalla en teléfono.
           */
          sizes={telefono ? '280px' : '(max-width: 1024px) 100vw, 700px'}
        />
      </div>
      <figcaption
        className={`mt-3 text-[13px] leading-relaxed text-muted ${telefono ? 'mx-auto max-w-[420px] text-center' : ''}`}
      >
        {pie}
      </figcaption>
    </figure>
  );
}

/**
 * El lugar donde va una captura que todavía no sacamos.
 *
 * **En producción no renderiza nada.** Es a propósito: así el sitio se puede
 * publicar en cualquier momento sin que a un prospecto le aparezca un recuadro
 * gris diciendo "falta la captura". Trabajando en local sí se ve, con el
 * detalle de qué pantalla hay que sacar y desde dónde.
 *
 * Cuando la captura exista, este componente se reemplaza por `Captura` — el
 * `que` de acá es literalmente la instrucción para sacarla.
 */
export function CapturaPendiente({ archivo, que }: { archivo: string; que: string }) {
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div className="mt-8 rounded-brand border-2 border-dashed border-line bg-surface p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-warning">
        Captura pendiente · no se ve en producción
      </p>
      <p className="mt-2 font-mono text-[13px] font-bold text-ink">public/capturas/{archivo}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{que}</p>
    </div>
  );
}
