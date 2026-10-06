'use client';

import { useMemo, useState } from 'react';
import type { CandidatoDto } from '@vacker/types';
import { fmtMoneda } from '../../lib/format';
import { inputClass } from '../form-ui';
import { paraBuscar } from './buscador';

const SIGLA = { inquilino: 'INQ', propietario: 'PROP' } as const;

const contratosDe = (c: CandidatoDto) =>
  c.contratos.map((k) => `${k.codigo} ${k.propiedad}`).join(' · ');
const pendienteDe = (c: CandidatoDto) =>
  c.pendiente.map((p) => fmtMoneda(p.importe, p.moneda)).join(' · ');

/**
 * A quién se le cobra o se le liquida (punto 6 de Javier, 6/10/2026). En vez de
 * un desplegable con todas las personas: un buscador por nombre, dirección o
 * número de contrato, con cada persona rotulada INQ o PROP, sus contratos y lo
 * que tiene pendiente; los que tienen algo pendiente, primero.
 *
 * `otros` es el papel que se suma a pedido: al cobrar, los propietarios («un
 * dueño que paga algo que no se le pudo descontar»).
 */
export function SelectorPersona({
  etiqueta,
  opciones,
  otros,
  textoOtros,
  pendienteRotulo,
  value,
  onChange,
}: {
  etiqueta: string;
  opciones: CandidatoDto[];
  otros?: CandidatoDto[];
  textoOtros?: string;
  /** «debe» o «para liquidar». */
  pendienteRotulo: string;
  value: string;
  onChange: (personaId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const elegidoEnOtros =
    !!otros?.some((o) => o.persona.id === value) && !opciones.some((o) => o.persona.id === value);
  const [conOtros, setConOtros] = useState(elegidoEnOtros);
  const [abierto, setAbierto] = useState(!value);

  const todas = useMemo(
    () => [...opciones, ...(conOtros ? (otros ?? []) : [])],
    [opciones, otros, conOtros],
  );
  const elegido =
    todas.find((o) => o.persona.id === value) ?? otros?.find((o) => o.persona.id === value) ?? null;
  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return todas;
    return todas.filter((o) =>
      [o.persona.nombre, ...o.contratos.map((k) => `${k.codigo} ${k.propiedad}`)].some((t) =>
        paraBuscar(t).includes(q),
      ),
    );
  }, [todas, busqueda]);

  if (elegido && !abierto) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {etiqueta}
        </span>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-brand border border-line bg-surface/40 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              <span className="mr-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
                {SIGLA[elegido.papel]}
              </span>
              {elegido.persona.nombre}
            </span>
            <span className="block truncate text-xs text-muted">{contratosDe(elegido)}</span>
          </span>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="text-xs font-semibold text-brand-red hover:underline"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[11px] font-bold uppercase tracking-wider text-muted"
        htmlFor="selector-persona"
      >
        {etiqueta}
      </label>
      <input
        id="selector-persona"
        type="search"
        className={inputClass}
        placeholder="Nombre, dirección o número de contrato…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        autoComplete="off"
      />
      {otros && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-red"
            checked={conOtros}
            onChange={(e) => setConOtros(e.target.checked)}
          />
          {textoOtros}
        </label>
      )}
      <ul
        role="listbox"
        aria-label={etiqueta}
        className="max-h-72 divide-y divide-line overflow-y-auto rounded-brand border border-line bg-white text-sm"
      >
        {filtradas.length === 0 ? (
          <li className="px-3 py-3 text-muted">Nadie coincide.</li>
        ) : (
          filtradas.map((o) => (
            <li
              key={`${o.papel}-${o.persona.id}`}
              role="option"
              aria-selected={o.persona.id === value}
            >
              <button
                type="button"
                onClick={() => {
                  onChange(o.persona.id);
                  setAbierto(false);
                  setBusqueda('');
                }}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-surface/60"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    <span className="mr-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
                      {SIGLA[o.papel]}
                    </span>
                    {o.persona.nombre}
                  </span>
                  <span className="block truncate text-xs text-muted">{contratosDe(o)}</span>
                </span>
                {o.pendiente.length > 0 && (
                  <span className="shrink-0 text-right text-xs">
                    <span className="block text-muted">{pendienteRotulo}</span>
                    <span className="block whitespace-nowrap font-bold tabular-nums text-ink">
                      {pendienteDe(o)}
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
