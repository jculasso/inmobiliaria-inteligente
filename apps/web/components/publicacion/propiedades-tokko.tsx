'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PropiedadDto, ResultadoImportacion } from '@vacker/types';
import { Button, Card } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { importarPropiedades, vaciarPropiedades } from '../../lib/publicacion-api';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';

/** Precio con su moneda: Tokko devuelve USD y ARS mezclados. */
function precioDe(p: PropiedadDto): string {
  if (p.precio == null) return '—';
  if (p.moneda === 'USD') return fmtUSD(p.precio);
  return `${p.moneda ?? ''} ${p.precio.toLocaleString('es-AR')}`.trim();
}

/**
 * Traída de propiedades desde Tokko y su listado.
 *
 * Se empieza por 10 y no por las 387 a propósito: mismo circuito completo
 * —credencial, lectura, vinculación del agente, guardado, pantalla— con una
 * décima parte de lo que puede salir mal.
 */
export function PropiedadesTokko({ inicial }: { inicial: PropiedadDto[] }) {
  const router = useRouter();
  const [cuantas, setCuantas] = useState(10);
  const [trayendo, setTrayendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);

  async function traer() {
    setTrayendo(true);
    setError(null);
    try {
      setResultado(await importarPropiedades(await getAccessToken(), cuantas));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer las propiedades.');
    } finally {
      setTrayendo(false);
    }
  }

  async function vaciar() {
    await vaciarPropiedades(await getAccessToken());
    setResultado(null);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-ink">Propiedades de Tokko</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Trae las más recientes para verlas acá. Es <strong>solo lectura</strong>: no modifica nada en
          Tokko.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Cuántas</span>
          <select
            value={cuantas}
            onChange={(e) => setCuantas(Number(e.target.value))}
            className="h-10 rounded-brand border border-line px-2 text-sm text-ink outline-none focus:border-brand-red"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} más recientes
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" size="sm" onClick={traer} disabled={trayendo}>
          {trayendo ? 'Trayendo…' : 'Traer de Tokko'}
        </Button>
        {inicial.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmandoVaciar(true)}
            className="h-10 text-xs font-semibold text-brand-red hover:underline"
          >
            Vaciar la lista
          </button>
        )}
      </div>

      {resultado && (
        <div role="status" className="rounded-brand border border-line border-l-[3px] border-l-success bg-success/5 p-3 text-sm">
          <p className="text-ink">
            <strong>{resultado.leidas} propiedades leídas</strong> · {resultado.creadas} nuevas ·{' '}
            {resultado.actualizadas} actualizadas
          </p>
          {resultado.sinAgente > 0 && (
            // No es un error: es que el mail del agente en Tokko no coincide con
            // ninguno nuestro. Se dice acá para que se pueda resolver, no se esconde.
            <p className="mt-1 text-ink/80">
              {resultado.sinAgente} sin vendedor vinculado — el mail que figura en Tokko no coincide con
              ningún usuario del sistema.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {confirmandoVaciar && (
        <ConfirmarBorradoModal
          titulo="Vaciar la lista de propiedades"
          descripcion="Se borra la copia local. En Tokko no se toca nada: podés volver a traerlas cuando quieras."
          detalle={<DatoBorrado etiqueta="Propiedades a borrar">{inicial.length}</DatoBorrado>}
          onConfirm={vaciar}
          onClose={() => setConfirmandoVaciar(false)}
        />
      )}

      {inicial.length > 0 && (
        /* Grilla y no tabla: una propiedad se reconoce por la foto antes que
           por sus datos. Y grilla propia y no `ListaTarjetas`, que lleva
           `sm:hidden` porque es la vista de celular de las tablas — usarla acá
           hacía que la lista no se viera en pantalla ancha. */
        <ul
          aria-label="Propiedades"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {inicial.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-brand border border-line bg-white">
              {p.fotoPortada ? (
                /* <img> y no next/image: las fotos viven en el CDN de Tokko y
                   habría que declarar ese dominio como remoto. Para una
                   miniatura de listado no vale la pena atarse a eso. */
                <img src={p.fotoPortada} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-surface text-xs text-muted">
                  sin foto
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold text-ink" title={p.titulo ?? undefined}>
                    {p.titulo ?? '(sin título)'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{p.ubicacion ?? p.direccion ?? '—'}</p>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-base font-extrabold text-ink">{precioDe(p)}</span>
                  {p.operacion && (
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {p.operacion}
                    </span>
                  )}
                  {p.tipo && (
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {p.tipo}
                    </span>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2 text-xs">
                  <span className={p.agente ? 'text-muted' : 'font-semibold text-brand-red'}>
                    {p.agente ?? `sin vincular · ${p.agenteTokko ?? '?'}`}
                  </span>
                  <span className="text-muted">{p.fotos} fotos</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="truncate" title={p.referenceCode ?? undefined}>
                    {p.referenceCode ?? `Tokko ${p.tokkoId}`}
                  </span>
                  {p.publicUrl && (
                    <a
                      href={p.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-semibold text-brand-red hover:underline"
                    >
                      Ver ficha ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
