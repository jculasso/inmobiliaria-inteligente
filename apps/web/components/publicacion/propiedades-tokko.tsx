'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PropiedadDto, ResultadoImportacion } from '@vacker/types';
import { Button, Card } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { importarPropiedades } from '../../lib/publicacion-api';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';

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

      {inicial.length > 0 && (
        <ListaTarjetas etiqueta="Propiedades">
          {inicial.map((p) => (
            <Tarjeta key={p.id}>
              <div className="flex items-start gap-3">
                {p.fotoPortada && (
                  /* <img> y no next/image: las fotos viven en el CDN de Tokko y
                     habría que declarar ese dominio como remoto. Para una miniatura
                     de listado no vale la pena atarse a esa configuración. */
                  <img
                    src={p.fotoPortada}
                    alt=""
                    className="h-16 w-20 shrink-0 rounded-brand border border-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{p.titulo ?? '(sin título)'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{p.ubicacion ?? p.direccion ?? '—'}</p>
                </div>
              </div>
              <CamposTarjeta>
                <CampoTarjeta etiqueta="Tipo">{p.tipo ?? '—'}</CampoTarjeta>
                <CampoTarjeta etiqueta="Operación">{p.operacion ?? '—'}</CampoTarjeta>
                <CampoTarjeta etiqueta="Precio">{precioDe(p)}</CampoTarjeta>
                <CampoTarjeta etiqueta="Fotos">{p.fotos}</CampoTarjeta>
                <CampoTarjeta etiqueta="Captó">
                  {p.agente ?? (
                    <span className="text-brand-red">sin vincular · {p.agenteTokko ?? '?'}</span>
                  )}
                </CampoTarjeta>
                <CampoTarjeta etiqueta="ID Tokko">{p.tokkoId}</CampoTarjeta>
              </CamposTarjeta>
            </Tarjeta>
          ))}
        </ListaTarjetas>
      )}
    </Card>
  );
}
