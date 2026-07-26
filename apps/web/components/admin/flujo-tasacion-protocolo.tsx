import type { ReactNode } from 'react';

/**
 * Cómo una tasación se convierte en una propiedad en comercialización.
 *
 * Es la pregunta que aparece sola en toda reunión de onboarding —"¿y esto con
 * lo otro cómo se conecta?"— y en texto no se entiende: son dos módulos, cuatro
 * estados y una bifurcación.
 *
 * En pantalla ancha se lee de izquierda a derecha; en el celular se apila y las
 * flechas apuntan hacia abajo. Sin imágenes: todo es HTML, así que se puede
 * corregir un texto sin rehacer un dibujo.
 */

function Etapa({
  modulo,
  titulo,
  children,
  destacada = false,
}: {
  modulo: 'Tasador' | 'Protocolo';
  titulo: string;
  children: ReactNode;
  destacada?: boolean;
}) {
  const esTasador = modulo === 'Tasador';
  return (
    <div
      className={`flex-1 rounded-brand border bg-white p-4 ${
        destacada ? 'border-brand-red shadow-sm' : 'border-line'
      }`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
          esTasador ? 'bg-brand-red/10 text-brand-red' : 'bg-success/10 text-success'
        }`}
      >
        {modulo}
      </span>
      <p className="mt-2 text-sm font-bold text-ink">{titulo}</p>
      <div className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Flecha: hacia abajo cuando está apilado, hacia la derecha desde `md:`. */
function Flecha() {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center py-1 text-xl text-brand-red md:py-0 md:px-1">
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </div>
  );
}

export function FlujoTasacionProtocolo() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col md:flex-row md:items-stretch">
        <Etapa modulo="Tasador" titulo="1 · Se carga la tasación">
          <p>Datos de la propiedad, comparables y el rango de valores.</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Estado: En proceso</p>
        </Etapa>

        <Flecha />

        <Etapa modulo="Tasador" titulo="2 · Se le presenta al propietario">
          <p>Se genera el informe con la marca de la inmobiliaria y se le deja al cliente.</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Estado: Presentada</p>
        </Etapa>

        <Flecha />

        <Etapa modulo="Tasador" titulo="3 · El propietario decide" destacada>
          <p>Acá se bifurca el camino, y es el momento que más importa registrar bien.</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Estado: Captada o No captada
          </p>
        </Etapa>
      </div>

      {/* La bifurcación */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-brand border border-line bg-surface p-4">
          <p className="text-sm font-bold text-ink">Si NO se capta</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Se anota el motivo —precio, competencia, se arrepintió— y ahí termina. Queda en el reporte del
            Tasador para saber por qué se pierden captaciones, que es la información más valiosa del
            módulo.
          </p>
        </div>

        <div className="rounded-brand border-2 border-success/40 bg-success/5 p-4">
          <p className="text-sm font-bold text-ink">Si se capta</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Se registra la <strong>exclusividad</strong> —exclusiva por X días, o no exclusiva— y la
            propiedad queda lista para arrancar el protocolo.
          </p>
        </div>
      </div>

      <div className="flex justify-center py-1 md:justify-end md:pr-[25%]">
        <span aria-hidden className="text-xl text-success">
          ↓
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-stretch">
        <Etapa modulo="Protocolo" titulo="4 · Se inicia el protocolo" destacada>
          <p>
            Desde <strong>Captadas</strong>, la tasación aparece lista para iniciar. Se confirma el precio
            de publicación y la fecha de inicio.
          </p>
          <p>
            El vencimiento se calcula solo, a partir de la exclusividad que se pactó en la tasación.
          </p>
        </Etapa>

        <Flecha />

        <Etapa modulo="Protocolo" titulo="5 · Cinco semanas de trabajo">
          <p>
            Cada semana trae sus acciones. Se marcan a medida que se hacen y el avance se calcula solo.
          </p>
          <p>Si algo se atrasa, aparece como alerta en el tablero del módulo.</p>
        </Etapa>

        <Flecha />

        <Etapa modulo="Protocolo" titulo="6 · Informe y cierre">
          <p>
            Sale el informe para el propietario con lo que se hizo. Al terminar, la propiedad se archiva
            indicando si se vendió, se retiró, venció o se cerró por otro motivo.
          </p>
        </Etapa>
      </div>

      <div className="mt-2 rounded-brand border border-line border-l-[3px] border-l-brand-red bg-white p-4">
        <p className="text-sm font-bold text-ink">Dos cosas que conviene aclarar en la reunión</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          <strong>La tasación no desaparece al iniciar el protocolo.</strong> Queda en Captada y sigue
          contando en las métricas del Tasador. Son dos fichas distintas de la misma propiedad, no una que
          reemplaza a la otra.
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          <strong>Sin tasación captada no hay protocolo.</strong> El protocolo no se crea de la nada: sale
          siempre de una captación. Por eso cargar bien el estado de la tasación no es burocracia — es lo
          que habilita el paso siguiente.
        </p>
      </div>
    </div>
  );
}
