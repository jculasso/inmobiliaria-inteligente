import { Aviso, Cifra, DocHeader, Seccion, Tarjeta } from '../../../components/admin/doc-ui';

export const metadata = { title: 'Inversión · Administración' };

/**
 * Plan de inversión en infraestructura, con los números medidos en producción.
 *
 * Es una página de decisión, no de documentación: está pensada para mirarla y
 * resolver qué se paga y en qué orden. Por eso cada punto dice qué problema
 * concreto resuelve y qué pasa si no se hace.
 *
 * Los datos son de mediciones reales, no estimaciones: están fechados abajo.
 */

const HOY = '26 de julio de 2026';

interface ItemInversion {
  prioridad: string;
  que: string;
  resuelve: string;
  precio: string;
  /** Aclaración de costo, cuando el número no cuenta toda la historia. */
  extra?: string;
}

/** Una sola fuente para la tabla de escritorio y las tarjetas del celular. */
const ITEMS: ItemInversion[] = [
  {
    prioridad: '1',
    que: 'Supabase Pro',
    resuelve: 'Backups diarios con 7 días de retención. La base deja de pausarse.',
    precio: 'US$ 25',
  },
  {
    prioridad: '2',
    que: 'Render pago',
    resuelve: 'Se acaba el arranque en frío. Se puede borrar el ping y su mantenimiento.',
    precio: 'US$ 7',
  },
  {
    prioridad: '3',
    que: 'Lightsail en San Pablo',
    resuelve:
      'La API al lado de la base: se termina la latencia entre continentes. Con dos nodos y balanceador, además sobrevive a que se caiga una máquina.',
    precio: 'US$ 24',
    extra: '+18 con balanceador',
  },
  {
    prioridad: '4',
    que: 'Vercel Pro',
    resuelve: 'El plan gratis es solo para uso no comercial. Necesario al facturar.',
    precio: 'US$ 20',
  },
  {
    prioridad: '—',
    que: 'Recuperación punto en el tiempo',
    resuelve:
      'Volver a cualquier momento exacto. Todavía no: cuadruplica el costo de la base. Se justifica cuando perder medio día de datos sea un problema contractual.',
    precio: 'US$ 100',
  },
];

export default function InversionPage() {
  return (
    <>
      <DocHeader
        titulo="Inversión en infraestructura"
        bajada="Qué conviene pagar, en qué orden y qué resuelve cada cosa. Los números son de mediciones en producción, no estimaciones."
      />

      <Seccion titulo="Dónde estamos hoy">
        <div className="grid gap-3 sm:grid-cols-3">
          <Tarjeta titulo="Base de datos">
            <p>Supabase, plan gratis, en San Pablo.</p>
            <p className="font-semibold text-brand-red">Sin backups automáticos.</p>
          </Tarjeta>
          <Tarjeta titulo="API">
            <p>Render, plan gratis, fuera de la región.</p>
            <p className="font-semibold text-brand-red">Se duerme por inactividad.</p>
          </Tarjeta>
          <Tarjeta titulo="Web">
            <p>Vercel, plan Hobby.</p>
            <p className="font-semibold text-brand-red">Solo uso no comercial.</p>
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion titulo="Los tres problemas, medidos">
        <Tarjeta titulo="1 · No hay forma de recuperar los datos">
          <p>
            El plan gratis de Supabase <strong>no incluye backups automáticos ni restauración</strong>. La
            documentación oficial recomienda exportar a mano con la línea de comandos.
          </p>
          <p>
            Es el único problema de esta lista que es <strong>irreversible</strong>. Un borrado accidental
            o una migración mal hecha no tienen vuelta atrás.
          </p>
        </Tarjeta>

        <Tarjeta titulo="2 · La API se duerme y tarda en despertar">
          <p>
            Render apaga el servicio tras <Cifra valor="15" unidad="min" /> sin uso, y el primer pedido
            después tarda entre <Cifra valor="30" unidad="s" /> y <Cifra valor="60" unidad="s" />.
          </p>
          <p>
            Hay un ping automático para evitarlo, pero <strong>no funciona como se esperaba</strong>: los
            cron de GitHub se postergan, y medido corre 4 o 5 veces por día en vez de cada 5 minutos. En
            la práctica, la primera persona de cada mañana espera.
          </p>
        </Tarjeta>

        <Tarjeta titulo="3 · La API y la base están en continentes distintos">
          <p>
            Cada consulta paga el viaje de ida y vuelta. Con varias consultas por pantalla, se acumula en
            todas las operaciones del día.
          </p>
          <p>Ninguna optimización de código compensa la distancia física.</p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Qué pagar, en orden">
        {/* En el celular la tabla de cuatro columnas se deslizaba de costado.
            Misma información apilada, con el precio destacado. */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {ITEMS.map((it) => (
            <li
              key={it.que}
              className={`rounded-brand border p-4 ${
                it.prioridad === '—' ? 'border-line bg-white' : 'border-brand-red/30 bg-brand-red/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                    {it.prioridad === '—' ? 'Todavía no' : `Prioridad ${it.prioridad}`}
                  </span>
                  <p className="text-sm font-bold text-ink">{it.que}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Cifra valor={it.precio} />
                  {it.extra && <span className="block text-[11px] text-muted">{it.extra}</span>}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{it.resuelve}</p>
            </li>
          ))}
          <li className="rounded-brand border-2 border-line bg-surface p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
              Las tres primeras
            </span>
            <p className="mt-1">
              <Cifra valor="US$ 56" unidad="/ mes" />
            </p>
          </li>
        </ul>

        <div className="hidden overflow-x-auto overscroll-x-contain rounded-brand border border-line bg-white sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                <th className="px-3 py-2.5">Prioridad</th>
                <th className="px-3 py-2.5">Qué</th>
                <th className="px-3 py-2.5">Qué resuelve</th>
                <th className="px-3 py-2.5 text-right">Por mes</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((it) => {
                const pendiente = it.prioridad === '—';
                return (
                  <tr key={it.que} className={`border-b border-line ${pendiente ? '' : 'bg-brand-red/5'}`}>
                    <td className={`px-3 py-3 font-extrabold ${pendiente ? 'text-muted' : 'text-brand-red'}`}>
                      {it.prioridad}
                    </td>
                    <td className={`px-3 py-3 font-semibold ${pendiente ? 'text-muted' : 'text-ink'}`}>{it.que}</td>
                    <td className="px-3 py-3 text-muted">{it.resuelve}</td>
                    <td className="px-3 py-3 text-right">
                      <Cifra valor={it.precio} />
                      {it.extra && <span className="block text-[11px] text-muted">{it.extra}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-surface">
              <tr className="border-t-2 border-line">
                <td className="px-3 py-3 text-[11px] font-extrabold uppercase tracking-wider text-ink" colSpan={3}>
                  Las tres primeras
                </td>
                <td className="px-3 py-3 text-right">
                  <Cifra valor="US$ 56" unidad="/ mes" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Aviso tono="ok" titulo="En perspectiva">
          <p>
            Cobrando <strong>US$ 150 por inmobiliaria</strong>, el primer cliente que pague cubre toda la
            infraestructura y los siguientes son margen. El salto siguiente —máquina más grande, más
            cómputo en la base— recién aparece pasadas varias decenas de inmobiliarias.
          </p>
        </Aviso>
      </Seccion>

      <Seccion titulo="Lo que no se arregla con dinero">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Dos cosas que no dependen de qué plan se pague, sino de horas de trabajo. Ninguna de las dos
          urge hoy.
        </p>

        <Aviso tono="ok" titulo="Paginación · lo grave ya está resuelto">
          <p>
            Las listas siguen mostrando hasta 500 registros. Lo peligroso no era el tope, era que{' '}
            <strong>no avisaba</strong>: alguien con más operaciones veía 500 y no se enteraba.
          </p>
          <p>
            Ahora la pantalla lo dice y explica cómo filtrar para ver el resto, así que{' '}
            <strong>dejó de ser un problema de datos incompletos</strong>. Falta poder recorrer todo sin
            filtrar — eso ya es comodidad, no integridad.
          </p>
        </Aviso>

        <Aviso tono="atencion" titulo="KPIs calculados en la base · pendiente, medio día de trabajo">
          <p>
            Hoy el tablero trae todas las operaciones del año y las suma en memoria, y varias pantallas
            repiten esa consulta.
          </p>
          <p>
            Con la base al lado duele menos, pero sigue siendo lo que más va a costar cuando crezca el
            volumen. <strong>No conviene tocarlo cerca de una salida a producción</strong>: es el cálculo
            del ranking, los objetivos y las comisiones, y si un número sale distinto nadie va a pensar
            que hubo un cambio técnico.
          </p>
        </Aviso>
      </Seccion>

      <Seccion titulo="Riesgo de no hacer nada">
        <Tarjeta>
          <p>
            <strong>El más grave no es la lentitud, es la ausencia de backups.</strong> Todo lo demás se
            resuelve pagando el mes que viene; los datos perdidos no vuelven.
          </p>
          <p>
            Además, el plan gratis de Render da 750 horas por mes para todo el espacio de trabajo. Si se
            agotan, <strong>suspende todos los servicios gratuitos hasta el mes siguiente</strong> — no los
            ralentiza, los apaga.
          </p>
        </Tarjeta>
      </Seccion>

      <p className="mt-8 text-xs text-muted">
        Precios de lista de Supabase, Render, Vercel y AWS Lightsail al {HOY}. Las mediciones de arranque
        en frío y de frecuencia del ping se tomaron en producción. Lightsail en San Pablo incluye la mitad
        del tráfico que en otras regiones, holgado igual para este volumen.
      </p>
    </>
  );
}
