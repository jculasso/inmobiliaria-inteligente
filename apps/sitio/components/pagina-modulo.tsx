import Link from 'next/link';
import { FormularioContacto } from './formulario-contacto';
import { ANCHO, Encabezado, Kicker, MODULOS, Pie } from './marco';

/*
 * El molde de las cuatro páginas de módulo.
 *
 * Todas cuentan lo mismo y en el mismo orden, porque un prospecto que mira dos
 * no tiene que volver a aprender dónde está cada cosa: qué problema resuelve,
 * cómo funciona, quién ve qué, y qué sale del módulo — que es lo que el dueño
 * de la inmobiliaria termina teniendo en la mano.
 */

export function Bloque({
  kicker,
  titulo,
  children,
  fondo,
}: {
  kicker: string;
  titulo: string;
  children: React.ReactNode;
  fondo?: boolean;
}) {
  return (
    <section className={fondo ? 'border-y border-line bg-surface py-16 sm:py-20' : 'py-16 sm:py-20'}>
      <div className={ANCHO}>
        <Kicker>{kicker}</Kicker>
        <h2 className="mt-4 max-w-3xl text-balance text-2xl font-extrabold leading-tight sm:text-4xl">
          {titulo}
        </h2>
        <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted sm:text-base">
          {children}
        </div>
      </div>
    </section>
  );
}

/** Un paso de "cómo funciona". El número ordena; no es decoración. */
export function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-5 border-t border-line pt-6">
      <span className="mt-0.5 shrink-0 text-sm font-extrabold tabular-nums text-brand-red">
        {String(numero).padStart(2, '0')}
      </span>
      <div>
        <h3 className="text-lg font-extrabold text-ink">{titulo}</h3>
        <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted sm:text-base">
          {children}
        </div>
      </div>
    </li>
  );
}

/** Quién ve qué. Es la pregunta que hace todo dueño de inmobiliaria. */
export function Rol({ rol, ve }: { rol: string; ve: string }) {
  return (
    <div className="border-t border-line py-4">
      <p className="text-sm font-extrabold text-ink">{rol}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">{ve}</p>
    </div>
  );
}

export function PaginaModulo({
  ruta,
  titular,
  bajada,
  sale,
  children,
}: {
  ruta: (typeof MODULOS)[number]['ruta'];
  titular: string;
  bajada: string;
  /** Lo que el módulo produce y queda en la mano de alguien. */
  sale?: string;
  children: React.ReactNode;
}) {
  const actual = MODULOS.find((m) => m.ruta === ruta)!;
  const siguiente = MODULOS[(MODULOS.findIndex((m) => m.ruta === ruta) + 1) % MODULOS.length]!;

  return (
    <>
      <Encabezado />
      <main>
        <section className={`${ANCHO} pb-4 pt-14 sm:pt-20`}>
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-extrabold tabular-nums text-brand-red">
              {actual.numero}
            </span>
            <Kicker>{actual.nombre}</Kicker>
          </div>
          <h1 className="mt-4 max-w-4xl text-balance text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            {titular}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">{bajada}</p>
          {sale && (
            <p className="mt-8 inline-flex flex-col gap-0.5 rounded-brand bg-surface px-5 py-3.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Lo que sale del módulo
              </span>
              <span className="text-[15px] font-bold text-ink">{sale}</span>
            </p>
          )}
        </section>

        {children}

        <section className={`${ANCHO} py-16 sm:py-20`}>
          <Link
            href={siguiente.ruta}
            className="group block rounded-brand border border-line p-7 transition-colors hover:border-brand-red sm:p-9"
          >
            <Kicker>Sigue el ciclo</Kicker>
            <p className="mt-3 text-2xl font-extrabold text-ink group-hover:text-brand-red sm:text-3xl">
              {siguiente.nombre} →
            </p>
          </Link>
        </section>

        <section id="demostracion" className={`${ANCHO} pb-20`}>
          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16">
            <div>
              <Kicker>Una demostración</Kicker>
              <h2 className="mt-4 text-balance text-2xl font-extrabold leading-tight sm:text-4xl">
                Quince minutos alcanzan para ver si le sirve.
              </h2>
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
                Le mostramos el sistema funcionando y le decimos con franqueza si su caso encaja o
                no.
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
