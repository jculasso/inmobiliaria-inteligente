import Image from 'next/image';
import { FormularioContacto } from '../components/formulario-contacto';

/*
 * Sitio comercial. El texto está acordado en docs/specs/sitio-comercial.md —
 * si hay que cambiar una frase, se cambia primero ahí.
 *
 * Para qué sirve este sitio: VERIFICAR, no captar. Los prospectos llegan
 * recomendados; el sitio confirma que esto es serio. Por eso está escrito para
 * explicar con calma y no para persuadir a un desconocido — un sitio que
 * "convence" a alguien que ya viene convencido suena a desesperado.
 */

const ANCHO = 'mx-auto w-full max-w-[1120px] px-6 sm:px-8';

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted sm:text-xs">
      {children}
    </p>
  );
}

function Modulo({
  numero,
  nombre,
  titular,
  children,
  sale,
}: {
  numero: string;
  nombre: string;
  titular: string;
  children: React.ReactNode;
  sale?: string;
}) {
  return (
    <article className="border-t border-line pt-8">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-extrabold tabular-nums text-brand-red">{numero}</span>
        <Kicker>{nombre}</Kicker>
      </div>
      <h3 className="mt-3 max-w-2xl text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
        {titular}
      </h3>
      <div className="mt-4 max-w-2xl space-y-3 text-[15px] leading-relaxed text-muted sm:text-base">
        {children}
      </div>
      {sale && (
        <p className="mt-5 inline-flex flex-col gap-0.5 rounded-brand bg-surface px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Sale</span>
          <span className="text-[15px] font-bold text-ink">{sale}</span>
        </p>
      )}
    </article>
  );
}

export default function Home() {
  return (
    <main>
      {/* ─────────── portada ─────────── */}
      <section className={`${ANCHO} pb-16 pt-16 sm:pb-24 sm:pt-24`}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-5 w-5" aria-hidden>
            <rect width="100" height="100" rx="22" fill="#C1121F" />
            <path
              d="M22 50 L50 27 L78 50"
              fill="none"
              stroke="#fff"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-red">
            Inmobiliaria Inteligente
          </span>
        </div>

        <h1 className="mt-10 max-w-4xl text-balance text-[2.15rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
          Su CRM guarda las propiedades.
          <br className="hidden sm:block" />{' '}
          <span className="text-brand-red">Nosotros le decimos cómo va su negocio.</span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
          Inmobiliaria Inteligente es la capa de conducción que se apoya sobre el sistema que ya
          usa. No lo reemplaza: le agrega lo que le falta — saber, cada semana, qué se está
          haciendo y qué no.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="#demostracion"
            className="rounded-brand bg-brand-red px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-brand-red-dark"
          >
            Pedir una demostración
          </a>
          <p className="text-sm text-muted">
            Desarrollado junto a una inmobiliaria en operación.
            <br className="hidden sm:block" /> En uso en{' '}
            <strong className="font-semibold text-ink">Vacker Negocios Inmobiliarios</strong>.
          </p>
        </div>
      </section>

      {/* ─────────── el problema ─────────── */}
      <section className="border-y border-line bg-surface py-16 sm:py-24">
        <div className={ANCHO}>
          <Kicker>El problema</Kicker>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            Usted sabe cuánto vendió. No sabe qué se está dejando de hacer.
          </h2>
          <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted sm:text-base">
            <p>
              El CRM le muestra las propiedades cargadas y los contactos. Pero no le dice que una
              captación lleva 43 días sin movimiento, que una autorización vence el martes, o que
              la propiedad que su vendedor marcó como publicada nunca llegó a los portales.
            </p>
            <p className="font-semibold text-ink">
              Eso se descubre tarde: cuando el propietario llama enojado, o cuando la autorización
              ya venció.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── el ciclo ─────────── */}
      <section className={`${ANCHO} py-16 sm:py-24`}>
        <Kicker>Cómo funciona</Kicker>
        <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
          Del primer contacto con el propietario hasta la operación cerrada.
        </h2>

        {/* El diagrama usa el lenguaje visual del producto — la tira de cinco
            semanas es la misma que se ve en el sistema. */}
        <figure className="mt-10 overflow-x-auto rounded-brand border border-line bg-surface p-3 sm:p-5">
          <Image
            src="/flujo.svg"
            alt="El ciclo de una propiedad: se tasa, se capta y empieza el protocolo de cinco semanas, y al venderse entra al tablero. El lunes la dirección recibe por correo qué necesita atención."
            width={1240}
            height={640}
            className="mx-auto h-auto w-full min-w-[760px] max-w-[1100px]"
            priority
          />
        </figure>

        <div className="mt-14 space-y-12">
          <Modulo
            numero="01"
            nombre="Tasador"
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
              tasación pasa al Protocolo sin volver a cargar nada.
            </p>
          </Modulo>

          <Modulo
            numero="02"
            nombre="Protocolo 5 Semanas"
            titular="Lo que distingue a una inmobiliaria que trabaja de una que espera."
            sale="Informe de gestión — con esto se renueva la autorización"
          >
            <p>
              Captada la propiedad, arranca un procedimiento de cinco semanas con 29 acciones
              concretas: documentación, fotos, publicación, difusión, seguimiento, ajuste de precio,
              informe al propietario.
            </p>
            <p>
              Cada semana muestra qué se hizo y qué quedó pendiente. El sistema avisa cuando algo
              vence, cuando una autorización está por caer, cuando una propiedad lleva demasiado
              tiempo sin movimiento.
            </p>
            <p className="font-semibold text-ink">
              Ese informe es la herramienta más subestimada del negocio: es con lo que se renueva
              una autorización sin bajar el precio.
            </p>
          </Modulo>

          <Modulo
            numero="03"
            nombre="Tablero Comercial"
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
          </Modulo>

          <Modulo
            numero="04"
            nombre="To Do List"
            titular="Lo que hay que hacer, donde ya lo está mirando."
          >
            <p>
              Las tareas del equipo, sincronizadas con el calendario que ya usan. Sin pedirle a
              nadie que aprenda una aplicación más.
            </p>
          </Modulo>
        </div>
      </section>

      {/* ─────────── el reporte de los lunes ─────────── */}
      <section className="bg-brand-red py-16 text-white sm:py-24">
        <div className={ANCHO}>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 sm:text-xs">
            Transversal a todo el ciclo
          </p>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            El lunes a la mañana, sin entrar a ningún lado.
          </h2>
          <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-white/85 sm:text-base">
            <p>
              La dirección recibe por correo el estado de todas las propiedades en
              comercialización, agrupadas por vendedor: qué necesita atención, qué autorizaciones
              están por vencer, qué está listo para cerrar.
            </p>
            <p className="font-semibold text-white">
              Si no hay nada urgente, el correo son cuatro líneas. Si hay algo que decidir, está
              arriba de todo.
            </p>
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
          <div className="border-t-2 border-brand-red pt-6">
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

          <div className="border-t-2 border-brand-red pt-6">
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

      {/* ─────────── pie ─────────── */}
      <footer className="border-t border-line py-10">
        <div className={`${ANCHO} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <p className="text-sm font-bold text-ink">Inmobiliaria Inteligente</p>
            <p className="text-sm text-muted">Rosario, Argentina</p>
          </div>
          <a
            href="mailto:contacto@inmobiliariainteligente.net"
            className="text-sm font-semibold text-brand-red hover:underline"
          >
            contacto@inmobiliariainteligente.net
          </a>
        </div>
      </footer>
    </main>
  );
}
