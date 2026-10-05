'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type ContratoResumenDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { Buscador, paraBuscar } from './buscador';
import { EstadoContratoBadge } from './estado-contrato';

const unidad = (c: ContratoResumenDto) => `${c.propiedad.direccion}${c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}`;
const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre).join(', ') || '—';

export function ContratosLista({ contratos, hoy }: { contratos: ContratoResumenDto[]; hoy: string }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const { visibles, hayMas } = recortarAlLimite(contratos);

  const filtrados = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((c) =>
      [c.codigo, unidad(c), ...c.inquilinos.map((x) => x.nombre), ...c.propietarios.map((x) => x.nombre)].some((t) => paraBuscar(t).includes(q)),
    );
  }, [visibles, busqueda]);

  const importe = (c: ContratoResumenDto) =>
    c.importeVigente == null ? <span className="text-xs font-bold text-warning">A indexar</span> : fmtMoneda(c.importeVigente, c.moneda);
  const indexacion = (c: ContratoResumenDto) =>
    c.proximaIndexacion == null ? '—' : (
      <span className={c.proximaIndexacion < hoy ? 'font-semibold text-brand-red' : ''}>
        {fmtFecha(c.proximaIndexacion)}
        {c.proximaIndexacion < hoy ? ' · vencida' : ''}
      </span>
    );
  const abrir = (c: ContratoResumenDto) => router.push(`/alquileres/contratos/${c.id}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por código, dirección o persona" />
        <Link href="/alquileres/contratos/nuevo">
          <Button variant="primary" size="sm">
            + Nuevo contrato
          </Button>
        </Link>
      </div>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran los primeros {LIMITE_LISTA} contratos.
        </p>
      )}

      {contratos.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">Todavía no hay contratos cargados.</p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">Ningún contrato coincide con «{busqueda}».</p>
      ) : (
        <>
          <ListaTarjetas etiqueta="Contratos">
            {filtrados.map((c) => (
              <Tarjeta key={c.id} onClick={() => abrir(c)} titulo={`Abrir el contrato ${c.codigo}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {c.codigo} · {unidad(c)}
                  </span>
                  <EstadoContratoBadge estado={c.estado} />
                </span>
                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Inquilino">{nombres(c.inquilinos)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Importe">{importe(c)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Fin">{fmtFecha(c.fin)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Indexación">{indexacion(c)}</CampoTarjeta>
                </CamposTarjeta>
              </Tarjeta>
            ))}
          </ListaTarjetas>
          <div className="hidden overflow-x-auto rounded-brand border border-line bg-white sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Propiedad</th>
                  <th className="px-4 py-2.5">Inquilino</th>
                  <th className="px-4 py-2.5">Vigencia</th>
                  <th className="px-4 py-2.5 text-right">Importe</th>
                  <th className="px-4 py-2.5">Próx. indexación</th>
                  <th className="px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrir(c)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-ink">{c.codigo}</td>
                    <td className="px-4 py-2.5 text-ink">{unidad(c)}</td>
                    <td className="px-4 py-2.5 text-muted">{nombres(c.inquilinos)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">
                      {fmtFecha(c.inicio)} – {fmtFecha(c.fin)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">{importe(c)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{indexacion(c)}</td>
                    <td className="px-4 py-2.5">
                      <EstadoContratoBadge estado={c.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
