import Image from 'next/image';
import Link from 'next/link';
import { FormularioContacto } from '../components/formulario-contacto';
import { ANCHO, CapturaSegunPantalla, Encabezado, Kicker, Pie } from '../components/marco';

/*
 * Sitio comercial. El texto está acordado en docs/specs/sitio-comercial.md —
 * si hay que cambiar una frase, se cambia primero ahí.
 *
 * Para qué sirve este sitio: VERIFICAR, no captar. Los prospectos llegan
 * recomendados; el sitio confirma que esto es serio. Por eso está escrito para
 * explicar con calma y no para persuadir a un desconocido — un sitio que
 * "convence" a alguien que ya viene convencido suena a desesperado.
 */

/*
 * Acá los dos módulos van resumidos y cada uno enlaza a su página. El detalle
 * —el problema que resuelve, cómo funciona, quién ve qué— vive en /tasador y
 * /tablero. La portada tiene que dejar entender el conjunto en una lectura; el
 * que quiere profundizar en uno, entra.
 */
function Modulo({
  numero,
  nombre,
  ruta,
  titular,
  children,
  sale,
  imagen,
  telefono,
  alt,
}: {
  numero: string;
  nombre: string;
  ruta: string;
  titular: string;
  children: React.ReactNode;
  sale?: string;
  /** Una pantalla del módulo. */
  imagen?: string;
  /** La misma pantalla sacada desde un teléfono, si existe. */
  telefono?: string;
  alt?: string;
}) {
  return (
    <article className="grid gap-8 border-t border-line pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-extrabold tabular-nums text-plataforma">{numero}</span>
          <Kicker>{nombre}</Kicker>
        </div>
        <h3 className="mt-3 max-w-2xl text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
          <Link href={ruta} className="transition-colors hover:text-plataforma">
            {titular}
          </Link>
        </h3>
        <div className="mt-4 max-w-2xl space-y-3 text-[15px] leading-relaxed text-muted sm:text-base">
          {children}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {sale && (
            <p className="inline-flex flex-col gap-0.5 rounded-brand bg-surface px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Sale
              </span>
              <span className="text-[15px] font-bold text-ink">{sale}</span>
            </p>
          )}
          <Link href={ruta} className="text-[15px] font-bold text-plataforma hover:underline">
            Ver {nombre} →
          </Link>
        </div>
      </div>

      {imagen && (
        <Link
          href={ruta}
          className="block self-start transition-opacity hover:opacity-90 sm:overflow-hidden sm:rounded-brand sm:border sm:border-line sm:bg-surface"
        >
          {telefono ? (
            <CapturaSegunPantalla escritorio={imagen} telefono={telefono} alt={alt ?? ''} />
          ) : (
            <Image
              src={imagen}
              alt={alt ?? ''}
              width={2560}
              height={1600}
              className="h-auto w-full"
              sizes="(max-width: 1024px) 100vw, 420px"
            />
          )}
        </Link>
      )}
    </article>
  );
}

export default function Home() {
  return (
    <>
      <Encabezado />
      <main>
        {/* ─────────── portada ─────────── */}
        <section className={`${ANCHO} pb-16 pt-16 sm:pb-24 sm:pt-24`}>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="h-5 w-5" aria-hidden>
              <rect width="100" height="100" rx="22" fill="#173F6B" />
              <path
                d="M22 50 L50 27 L78 50"
                fill="none"
                stroke="#fff"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-plataforma">
              Inmobiliaria Inteligente
            </span>
          </div>

          <h1 className="mt-10 max-w-4xl text-balance text-[2.15rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Su CRM guarda las propiedades.
            <br className="hidden sm:block" />{' '}
            <span className="text-plataforma">Nosotros le decimos cómo va su negocio.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
            Inmobiliaria Inteligente es la capa de conducción que se apoya sobre el sistema que ya
            usa. No lo reemplaza: le agrega lo que le falta — el número que dice cómo viene el
            año, y el informe con el que se gana una captación.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#demostracion"
              className="rounded-brand bg-plataforma px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-plataforma-dark"
            >
              Pedir una demostración
            </a>
            <p className="text-sm text-muted">
              Desarrollado junto a una inmobiliaria en operación.
              <br className="hidden sm:block" /> En uso en{' '}
              <strong className="font-semibold text-ink">Vacker Negocios Inmobiliarios</strong>.
            </p>
          </div>

          {/*
            La pantalla va acá arriba y no más abajo. El titular promete decirle
            cómo va su negocio; una captura donde se leen los números de verdad
            lo demuestra en un segundo, y ahorra los dos párrafos que harían
            falta para explicarlo.
          */}
          <div className="mt-14">
            <CapturaSegunPantalla
              escritorio="/capturas/tablero-kpis.png"
              telefono="/capturas/tablero-telefono.png"
              alt="Tablero Comercial: el volumen del mes y el acumulado del año, con operaciones, ticket promedio, puntas, comisión y lo que queda pendiente de cobro."
              prioridad
            />
          </div>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-muted sm:text-left">
            El mes y el año, en la misma pantalla. Sin pedirle el número a nadie.
          </p>
        </section>

        {/* ─────────── el problema ─────────── */}
        <section className="border-y border-line bg-surface py-16 sm:py-24">
          <div className={ANCHO}>
            <Kicker>El problema</Kicker>
            <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              Usted sabe cuánto vendió. No sabe cuánto le dejó, ni quién.
            </h2>
            <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted sm:text-base">
              <p>
                El CRM le muestra las propiedades cargadas y los contactos. Pero no le dice cuánto
                deja cada operación, cómo viene el trimestre contra el del año pasado, ni cuál de
                sus vendedores está tasando mucho y captando poco.
              </p>
              <p className="font-semibold text-ink">
                Esas respuestas hoy salen de una planilla que alguien actualiza a mano, o de la
                memoria de la última reunión.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────── el ciclo ─────────── */}
        <section className={`${ANCHO} py-16 sm:py-24`}>
          <Kicker>Cómo funciona</Kicker>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            Dos módulos: el que origina el negocio y el que lo mide.
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
            El negocio empieza cuando se capta una propiedad, y se capta con una tasación bien
            hecha. Termina cuando la operación se firma y hay que saber cuánto dejó, y a quién.
          </p>

          <div className="mt-12 space-y-12">
            <Modulo
              numero="01"
              nombre="Tasador"
              imagen="/capturas/tasador-wizard.png"
              telefono="/capturas/tasador-telefono.png"
              alt="Paso de comparables del Tasador: seis propiedades similares con su precio por metro cuadrado y un resumen automático de confianza."
              ruta="/tasador"
              titular="Llegue a la reunión con un informe, no con una carpeta."
              sale="Informe para el propietario"
            >
              <p>
                El vendedor carga la propiedad, elige comparables del mercado y el sistema calcula un
                rango de valores fundamentado.
              </p>
              <p>
                La diferencia no es el número: es llegar con un documento profesional cuando el de al
                lado llega con una estimación de memoria. Y cuando la captación se concreta, la
                propiedad queda cargada: los datos, las fotos y el valor ya están, y la operación
                entra al tablero sin escribir nada dos veces.
              </p>
            </Modulo>

            <Modulo
              numero="02"
              nombre="Tablero Comercial"
              imagen="/capturas/tablero-kpis.png"
              telefono="/capturas/tablero-telefono.png"
              alt="Tablero Comercial con el volumen del mes y el acumulado del año, operaciones, ticket promedio, puntas y comisión."
              ruta="/tablero"
              titular="Cuánto se vendió, quién lo vendió y cuánto se cobra."
            >
              <p>
                Ventas y alquileres cargados una sola vez, con las dos puntas, las comisiones
                calculadas y los objetivos de cada vendedor.
              </p>
              <p>
                Cada persona ve lo suyo; el team leader, lo de su equipo; la dirección, todo. No hay
                planilla paralela ni versiones distintas del mismo número.
              </p>
              <p>
                La facturación bruta —anual, trimestral y mensual— de la inmobiliaria y de cada
                vendedor, el ticket promedio, las operaciones y la cantidad de puntas. Y lo que
                todavía está pendiente de cobro.
              </p>
            </Modulo>
          </div>
        </section>

        {/* ─────────── en cualquier dispositivo ─────────── */}
        <section className="border-y border-line bg-surface py-16 sm:py-24">
          <div className={ANCHO}>
            <Kicker>En cualquier dispositivo</Kicker>
            <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              El vendedor no vuelve a la oficina para cargar nada.
            </h2>
            <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted sm:text-base">
              <p>
                Es la misma aplicación y se acomoda a la pantalla que haya adelante. En la visita,
                el vendedor carga la tasación desde el teléfono con las fotos que acaba de sacar. Y
                mira cómo viene contra su objetivo sin pedirle el dato a nadie. La dirección abre el
                tablero desde donde esté.
              </p>
              <p className="font-semibold text-ink">
                Se instala en el teléfono como una aplicación más, con su ícono en la pantalla de
                inicio. Sin pasar por App Store ni por Google Play.
              </p>
            </div>

            {/*
              Los tres a escala: el ancho de cada marco es proporcional al ancho
              real de la pantalla que representa (1280 · 820 · 375). Dibujarlos
              todos del mismo tamaño se leería como tres capturas sueltas; así
              se lee como un solo sistema en tres tamaños.
            */}
            <div className="mt-12 grid gap-6 sm:flex sm:items-end sm:justify-center sm:gap-6">
              <div className="overflow-hidden rounded-brand border border-line bg-white shadow-[0_20px_50px_-30px_rgba(29,29,31,0.5)] sm:w-[62%]">
                <Image
                  src="/capturas/tasador-wizard.png"
                  alt="El Tasador en una computadora, en el paso de comparables, con el resumen automático de confianza."
                  width={2560}
                  height={1600}
                  className="h-auto w-full"
                  sizes="(max-width: 640px) 100vw, 650px"
                />
              </div>

              {/* `sm:contents` disuelve esta fila en pantallas grandes y deja a
                  los dos teléfonos como hermanos del monitor. */}
              <div className="flex items-end justify-center gap-5 sm:contents">
                <div className="overflow-hidden rounded-[18px] border-[5px] border-ink bg-white shadow-[0_20px_50px_-26px_rgba(29,29,31,0.6)] sm:w-[14%]">
                  <Image
                    src="/capturas/tablero-telefono.png"
                    alt="El Tablero Comercial en un teléfono: la dirección mira los números desde donde esté."
                    width={750}
                    height={1624}
                    className="h-auto w-full"
                    sizes="(max-width: 640px) 34vw, 150px"
                  />
                </div>
                <div className="overflow-hidden rounded-[18px] border-[5px] border-ink bg-white shadow-[0_20px_50px_-26px_rgba(29,29,31,0.6)] sm:w-[14%]">
                  <Image
                    src="/capturas/tasador-telefono.png"
                    alt="El Tasador en un teléfono, en el paso de comparables: el vendedor carga la tasación en la misma visita."
                    width={750}
                    height={1624}
                    className="h-auto w-full"
                    sizes="(max-width: 640px) 34vw, 150px"
                  />
                </div>
              </div>
            </div>

            <dl className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
              {[
                ['Computadora', 'La dirección y la administración: cargar operaciones, revisar la cartera, sacar informes.'],
                ['Tablet', 'La reunión con el propietario, con el informe de tasación en pantalla en vez de en papel.'],
                ['Teléfono', 'El vendedor en la calle: tasar en la visita y ver cómo viene contra su objetivo.'],
              ].map(([donde, para]) => (
                <div key={donde}>
                  <dt className="text-[15px] font-extrabold text-ink">{donde}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{para}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ─────────── el reporte de los lunes ─────────── */}
        <section className="bg-plataforma py-16 text-white sm:py-24">
          <div className={`${ANCHO} grid gap-12 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-center lg:gap-16`}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 sm:text-xs">
                Lo que se lleva el propietario
              </p>
              <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
                La captación se gana antes de hablar de precio.
              </h2>
              <div className="mt-7 space-y-4 text-[15px] leading-relaxed text-white/85 sm:text-base">
                <p>
                  Terminada la visita, el sistema arma el informe: la propiedad con sus fotos, los
                  comparables del mercado que respaldan el número, el rango de valores y la
                  estrategia comercial propuesta.
                </p>
                <p className="font-semibold text-white">
                  El de al lado llega con una cifra de memoria. Su vendedor deja un documento con el
                  nombre de la inmobiliaria arriba.
                </p>
              </div>
              <Link
                href="/tasador"
                className="mt-8 inline-block text-[15px] font-bold text-white underline underline-offset-4"
              >
                Ver el Tasador →
              </Link>
            </div>

            {/* El documento, no un ícono de hoja: lo que se promete es algo
                concreto, y acá se ve de verdad. */}
            <div className="overflow-hidden rounded-brand bg-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
              <Image
                src="/capturas/tasador-informe.png"
                alt="Informe de tasación en PDF: la propiedad con sus fotos, los comparables del mercado y el rango de valores propuesto."
                width={989}
                height={1400}
                className="h-auto w-full"
                sizes="(max-width: 1024px) 100vw, 380px"
              />
            </div>
          </div>
        </section>

        {/* ─────────── quiénes lo hacen ─────────── */}
        <section className={`${ANCHO} py-16 sm:py-24`}>
          <Kicker>Quiénes lo hacen</Kicker>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            Dos directores de sistemas que trabajan juntos desde hace treinta años.
          </h2>
          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
            Se conocieron en Minetti y Cía. a principios de los noventa. Los dos pasaron por Cargill.
            Después cada uno siguió su camino — uno hacia el comercio electrónico en México, el otro
            hacia la dirección de sistemas de una operación industrial de miles de clientes. Vuelven
            a trabajar juntos en este producto.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-12">
            <div className="border-t-2 border-plataforma pt-6">
              <h3 className="text-xl font-extrabold">Javier Culasso</h3>
              <p className="mt-2 text-[15px] font-bold leading-snug text-ink">
                CIO del Año de Argentina, 1999
              </p>
              <p className="text-sm text-muted">
                Distinción de la revista Information Technology y PriceWaterhouseCoopers Argentina.
              </p>
              <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-muted">
                <li>
                  Cofundador de Entrepids, donde lideró más de 150 implementaciones de comercio
                  electrónico, CRM y administración de fuerza de ventas.
                </li>
                <li>
                  Proyectos para El Palacio de Hierro, Best Buy México, Chedraui, HEB, Arcor, Henkel
                  y BIC, entre otros.
                </li>
                <li>
                  Antes, director de sistemas en Minetti y Cía., Cargill – Granja del Sol y Colorín.
                </li>
              </ul>
            </div>

            <div className="border-t-2 border-plataforma pt-6">
              <h3 className="text-xl font-extrabold">Bernardo Falconi</h3>
              <p className="mt-2 text-[15px] font-bold leading-snug text-ink">
                Veintiún años en Cargill
              </p>
              <p className="text-sm text-muted">Gerente de sistemas del negocio de harinas.</p>
              <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-muted">
                <li>
                  Siete plantas, tres mil clientes, quinientos usuarios y un presupuesto anual de dos
                  millones de dólares.
                </li>
                <li>
                  Lideró la integración de sistemas de la unión con Molinos Río de la Plata, y el
                  proyecto Año 2000 de todo el negocio.
                </li>
                <li>
                  Responsable de control interno, auditorías y planes de continuidad y recuperación
                  ante desastres.
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-12 max-w-3xl border-l-2 border-line pl-5 text-[15px] leading-relaxed text-muted sm:text-base">
            Uno viene del lado comercial: vender, medir, convertir. El otro, del lado de la operación
            que no se puede caer: continuidad, control, datos que no se pierden.{' '}
            <strong className="font-semibold text-ink">
              Un sistema para una inmobiliaria necesita las dos cosas.
            </strong>
          </p>
        </section>

        {/* ─────────── sus datos son suyos ─────────── */}
        <section className="border-y border-line bg-surface py-16 sm:py-24">
          <div className={ANCHO}>
            <Kicker>Sus datos</Kicker>
            <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              Puede llevárselos cuando quiera.
            </h2>
            <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted sm:text-base">
              <p>
                Cada inmobiliaria trabaja aislada de las demás: el aislamiento no depende de la
                aplicación, está garantizado en la base de datos y verificado automáticamente en cada
                cambio del sistema.
              </p>
              <p className="font-semibold text-ink">
                Y sus datos se exportan en planillas cuando lo pida, con un botón y sin trámite. Si
                algún día decide irse, se va con todo.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────── cierre ─────────── */}
        <section id="demostracion" className={`${ANCHO} py-16 sm:py-24`}>
          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16">
            <div>
              <Kicker>Una demostración</Kicker>
              <h2 className="mt-4 text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
                Quince minutos alcanzan para ver si le sirve.
              </h2>
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
                Le mostramos el sistema funcionando con datos reales de una inmobiliaria en
                operación, y le decimos con franqueza si su caso encaja o no.
              </p>
            </div>
            <FormularioContacto />
          </div>
        </section>

      </main>
      <Pie />
    </>
  );
}
