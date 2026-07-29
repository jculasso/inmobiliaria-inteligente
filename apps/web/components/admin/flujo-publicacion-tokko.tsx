import type { ReactNode } from 'react';

/**
 * Cómo una propiedad captada llega a los portales, y dónde entra el módulo
 * nuevo.
 *
 * La pregunta de la reunión es "¿esto reemplaza a Tokko?" — y la respuesta es
 * que no. El dibujo existe para mostrarlo de un vistazo: los pasos grises ya
 * funcionan y no se tocan, los rojos son lo que se construye.
 *
 * Todo es HTML, sin imágenes: se corrige un texto sin rehacer un dibujo.
 */

function Etapa({
  etiqueta,
  titulo,
  nuevo = false,
  children,
}: {
  etiqueta: string;
  titulo: string;
  nuevo?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex-1 rounded-brand border bg-white p-4 ${
        nuevo ? 'border-brand-red shadow-sm' : 'border-line'
      }`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
          nuevo ? 'bg-brand-red/10 text-brand-red' : 'bg-ink/5 text-muted'
        }`}
      >
        {nuevo ? `Nuevo · ${etiqueta}` : etiqueta}
      </span>
      <p className="mt-2 text-sm font-bold text-ink">{titulo}</p>
      <div className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Flecha() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center py-1 text-xl text-brand-red md:px-1 md:py-0"
    >
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </div>
  );
}

export function FlujoPublicacionTokko() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row md:items-stretch">
        <Etapa etiqueta="Ya funciona" titulo="1 · La propiedad se capta">
          <p>
            La tasación queda en <strong>Captada</strong> y arranca el protocolo. La propiedad ya está
            descrita en el sistema: medidas, ambientes, estado, fotos.
          </p>
        </Etapa>

        <Flecha />

        <Etapa etiqueta="Ficha de propiedad" titulo="2 · Se completa lo que falta" nuevo>
          <p>
            Nace <strong>precargada</strong> con todo lo que ya se cargó en la tasación. Solo hay que
            sumar lo que se escribe para publicar: descripción, expensas, disponibilidad y qué fotos
            salen.
          </p>
          <p className="font-semibold text-ink">Se hace una sola vez, acá.</p>
        </Etapa>

        <Flecha />

        <Etapa etiqueta="Publicación" titulo="3 · Tokko la toma sola" nuevo>
          <p>
            El sistema publica un listado que Tokko va a buscar por su cuenta. Nadie copia nada a mano.
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Estado: Publicada en Tokko
          </p>
        </Etapa>
      </div>

      <div className="flex flex-col md:flex-row md:items-stretch">
        <Etapa etiqueta="Ya funciona · Tokko" titulo="4 · Tokko publica en los portales">
          <p>
            Zonaprop, Argenprop, MercadoLibre. <strong>Esto no cambia</strong>: lo sigue haciendo Tokko,
            igual que hoy.
          </p>
        </Etapa>

        <Flecha />

        <Etapa etiqueta="Protocolo" titulo="5 · La acción se marca sola" nuevo>
          <p>
            <strong>Publicación en portales</strong>, de la semana 1, deja de marcarse a mano: queda
            registrada con su fecha cuando la publicación se confirma.
          </p>
        </Etapa>

        <Flecha />

        <Etapa etiqueta="Ya funciona" titulo="6 · Sigue el protocolo de 5 semanas">
          <p>Sin cambios. Las consultas, visitas y ofertas se registran como hasta ahora.</p>
        </Etapa>
      </div>

      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="rounded-brand border-2 border-success/40 bg-success/5 p-4">
          <p className="text-sm font-bold text-ink">Lo que se gana</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            La propiedad se carga <strong>una sola vez</strong>. Hoy se carga en el sistema al tasarla y
            se vuelve a cargar en Tokko para publicarla.
          </p>
        </div>
        <div className="rounded-brand border border-line bg-surface p-4">
          <p className="text-sm font-bold text-ink">Lo que NO cambia</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Tokko sigue siendo quien publica en los portales y quien maneja esa relación. Este módulo{' '}
            <strong>no lo reemplaza</strong>: le saca el trabajo de tipeo.
          </p>
        </div>
      </div>
    </div>
  );
}
