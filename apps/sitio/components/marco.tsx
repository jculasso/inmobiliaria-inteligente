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

/*
 * El fondo del encabezado es BLANCO SÓLIDO, no `bg-white/90 backdrop-blur`.
 *
 * Con la versión translúcida, en Safari el desenfoque no se aplica y lo que
 * pasa por debajo se ve a través del encabezado: las capturas del producto
 * atravesaban el menú y quedaba texto sobre texto. En un teléfono era lo
 * primero que se veía al bajar. Un encabezado fijo tiene que tapar.
 */
export function Encabezado() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
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

      {/*
        En pantallas chicas los módulos van abajo, en una fila que se desliza.
        El degradado del borde derecho no es decorativo: sin él, el último
        nombre queda cortado contra el borde —"Tablero Comercia"— y se lee como
        un error de maquetación en vez de como algo que continúa. El degradado
        deja ver que hay más y no tapa ningún enlace.
      */}
      <div className="relative lg:hidden">
        <nav className="flex gap-5 overflow-x-auto border-t border-line px-6 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MODULOS.map((m) => (
            <Link
              key={m.ruta}
              href={m.ruta}
              className="whitespace-nowrap text-[13px] font-semibold text-muted"
            >
              {m.nombre}
            </Link>
          ))}
          {/* Un respiro al final, para que el último nombre no termine debajo
              del degradado cuando se llega al extremo. */}
          <span aria-hidden className="w-4 shrink-0" />
        </nav>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent"
        />
      </div>
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
          {/*
            Acá había una dirección de correo que todavía no existe. Una
            dirección que rebota es peor que ninguna: el que escribe cree que
            preguntó y nunca le contestan, y se va pensando que no le dimos
            bola. El formulario, en cambio, entrega. Cuando la casilla exista,
            vuelve.
          */}
          <Link
            href="/#demostracion"
            className="mt-3 inline-block text-sm font-semibold text-brand-red hover:underline"
          >
            Pedir una demostración →
          </Link>
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
  recorte,
}: {
  src: string;
  ancho: number;
  alto: number;
  alt: string;
  pie: string;
  /** Marca las capturas sacadas de un celular. Ver abajo por qué importa. */
  telefono?: boolean;
  /**
   * Un recorte de la parte que importa, para mostrar en pantallas chicas.
   *
   * Una página A4 completa metida en 375px es una mancha gris: no se lee ni el
   * titular, que suele ser todo el argumento. Con el recorte se ve la parte
   * que hace falta ver, y en pantalla grande sigue apareciendo la hoja entera.
   */
  recorte?: { src: string; ancho: number; alto: number };
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

  if (recorte) {
    return (
      <figure className="mt-8">
        <div className="overflow-hidden rounded-brand border border-line bg-white sm:hidden">
          <Image
            src={recorte.src}
            width={recorte.ancho}
            height={recorte.alto}
            alt={alt}
            className="h-auto w-full"
            sizes="100vw"
          />
        </div>
        <div className="hidden overflow-hidden rounded-brand border border-line bg-surface sm:block">
          <Image
            src={src}
            width={ancho}
            height={alto}
            alt={alt}
            className="h-auto w-full"
            sizes="(max-width: 1024px) 100vw, 700px"
          />
        </div>
        <figcaption className="mt-3 text-[13px] leading-relaxed text-muted">{pie}</figcaption>
      </figure>
    );
  }

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
 * Una captura del producto que cambia según el ancho de la pantalla.
 *
 * Una captura de escritorio —1280px de ancho— metida en un teléfono de 375
 * queda al 29% de su tamaño: no se lee una sola palabra y el resultado es una
 * mancha gris que hace parecer rota la página. Justo en el dispositivo desde
 * el que la va a abrir la mayoría.
 *
 * Así que en teléfono se muestra la captura sacada DESDE un teléfono, dentro
 * de un marco, y en pantallas grandes la de escritorio. Es la misma pantalla
 * del producto; lo que cambia es desde dónde se la fotografió.
 */
export function CapturaSegunPantalla({
  escritorio,
  telefono,
  alt,
  prioridad,
}: {
  escritorio: string;
  telefono: string;
  alt: string;
  prioridad?: boolean;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[22px] border-[5px] border-ink bg-white shadow-[0_18px_40px_-24px_rgba(29,29,31,0.55)] sm:hidden">
        <Image
          src={telefono}
          alt={alt}
          width={750}
          height={1624}
          className="h-auto w-full"
          sizes="260px"
          priority={prioridad}
        />
      </div>
      <div className="hidden overflow-hidden rounded-brand border border-line bg-surface shadow-[0_24px_60px_-32px_rgba(29,29,31,0.45)] sm:block">
        <Image
          src={escritorio}
          alt={alt}
          width={2560}
          height={1600}
          className="h-auto w-full"
          sizes="(max-width: 1120px) 100vw, 1050px"
          priority={prioridad}
        />
      </div>
    </>
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
