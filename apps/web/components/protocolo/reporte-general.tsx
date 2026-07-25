'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MOTIVO_ARCHIVO_LABEL,
  TOTAL_SEMANAS,
  type CandidataDto,
  type ProtocoloResumenDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { desarchivarProtocolo } from '../../lib/protocolo-api';
import { useRouter } from 'next/navigation';
import { BarraAvance, Pill, porcentaje } from './protocolo-ui';
import { ArchivarModal } from './archivar-modal';

type Grupo = 'captadas' | 'activas' | 'archivadas';

/**
 * Vista de todo el ciclo: captadas sin iniciar, en comercialización y
 * archivadas. Desde acá se archiva una propiedad (fecha + motivo).
 */
export function ReporteGeneral({
  captadas,
  activas: activasIniciales,
  archivadas: archivadasIniciales,
  puedeReabrir,
}: {
  captadas: CandidataDto[];
  activas: ProtocoloResumenDto[];
  archivadas: ProtocoloResumenDto[];
  puedeReabrir: boolean;
}) {
  const [grupo, setGrupo] = useState<Grupo>('activas');
  const [archivando, setArchivando] = useState<ProtocoloResumenDto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  // Copia local para mover la fila de solapa al instante. El server refresca
  // después y vuelve a mandar la verdad; sin esto la propiedad se quedaba en
  // "En comercialización" hasta que terminara el round-trip.
  const [activas, setActivas] = useState(activasIniciales);
  const [archivadas, setArchivadas] = useState(archivadasIniciales);
  useEffect(() => {
    setActivas(activasIniciales);
    setArchivadas(archivadasIniciales);
  }, [activasIniciales, archivadasIniciales]);

  /** Mueve la propiedad de una solapa a la otra sin esperar al server. */
  function moverLocal(p: ProtocoloResumenDto, a: 'archivada' | 'activa') {
    const movida = { ...p, estado: a };
    if (a === 'archivada') {
      setActivas((prev) => prev.filter((x) => x.id !== p.id));
      setArchivadas((prev) => [movida, ...prev]);
    } else {
      setArchivadas((prev) => prev.filter((x) => x.id !== p.id));
      setActivas((prev) => [movida, ...prev]);
    }
  }

  const solapas: { key: Grupo; label: string; cantidad: number }[] = [
    { key: 'captadas', label: 'Captadas', cantidad: captadas.length },
    { key: 'activas', label: 'En comercialización', cantidad: activas.length },
    { key: 'archivadas', label: 'Archivadas', cantidad: archivadas.length },
  ];

  async function reabrir(p: ProtocoloResumenDto) {
    moverLocal(p, 'activa');
    setGuardando(true);
    try {
      await desarchivarProtocolo(await getAccessToken(), p.id);
    } finally {
      setGuardando(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {solapas.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setGrupo(s.key)}
            className={`shrink-0 rounded-brand border px-3.5 py-2 text-sm font-bold transition-colors ${
              grupo === s.key
                ? 'border-ink bg-ink text-white'
                : 'border-line text-muted hover:bg-surface'
            }`}
          >
            {s.label} · {s.cantidad}
          </button>
        ))}
      </div>

      {grupo === 'captadas' && (
        <Tabla
          vacio="No hay captaciones pendientes de iniciar."
          columnas={['Propiedad', 'Propietario', 'Responsable', 'Valor', '']}
          filas={captadas.map((c) => ({
            id: c.tasacionId,
            celdas: [
              <Celda key="p" titulo={c.direccion} sub={`${c.tipoPropiedad} · ${c.ciudad ?? '—'}`} />,
              c.cliente,
              c.agente.nombre,
              c.valorRecomendado != null ? fmtUSD(c.valorRecomendado) : '—',
              <Link key="a" href="/protocolo/captadas" className="font-semibold text-brand-red hover:underline">
                Iniciar
              </Link>,
            ],
          }))}
        />
      )}

      {grupo === 'activas' && (
        <Tabla
          vacio="Todavía no hay propiedades en comercialización."
          columnas={['Propiedad', 'Semana', 'Avance', 'Precio', 'Responsable', '']}
          filas={activas.map((p) => ({
            id: p.id,
            celdas: [
              <Celda
                key="p"
                titulo={p.propiedad.direccion}
                sub={`${p.diasPublicada} días · desde ${p.fechaInicio}`}
              />,
              `${p.semanaActual} de ${TOTAL_SEMANAS}`,
              <div key="av" className="flex min-w-[90px] items-center gap-2">
                <BarraAvance valor={p.avance} />
                <span className="shrink-0 text-xs font-bold text-ink">{porcentaje(p.avance)}</span>
              </div>,
              p.precioPublicado != null ? fmtUSD(p.precioPublicado) : '—',
              p.agente.nombre,
              <div key="acc" className="flex items-center gap-2.5">
                <Link href={`/protocolo/${p.id}`} className="font-semibold text-brand-red hover:underline">
                  Abrir
                </Link>
                <Button variant="secondary" size="sm" onClick={() => setArchivando(p)}>
                  Archivar
                </Button>
              </div>,
            ],
          }))}
        />
      )}

      {grupo === 'archivadas' && (
        <Tabla
          vacio="Todavía no se archivó ninguna propiedad."
          columnas={['Propiedad', 'Motivo', 'Fecha', 'Días', 'Responsable', '']}
          filas={archivadas.map((p) => ({
            id: p.id,
            celdas: [
              <Celda key="p" titulo={p.propiedad.direccion} sub={p.propiedad.tipoPropiedad} />,
              <Pill key="m" tono={p.motivoArchivo === 'vendida' ? 'verde' : 'neutro'}>
                {p.motivoArchivo ? MOTIVO_ARCHIVO_LABEL[p.motivoArchivo] : '—'}
              </Pill>,
              p.archivadoEn ?? '—',
              String(p.diasPublicada),
              p.agente.nombre,
              <div key="acc" className="flex items-center gap-2.5">
                <Link href={`/protocolo/${p.id}`} className="font-semibold text-brand-red hover:underline">
                  Ver
                </Link>
                {puedeReabrir && (
                  <button
                    type="button"
                    onClick={() => void reabrir(p)}
                    className="text-sm font-semibold text-muted hover:text-ink hover:underline"
                  >
                    Reabrir
                  </button>
                )}
              </div>,
            ],
          }))}
        />
      )}

      {archivando && (
        <ArchivarModal
          protocolo={archivando}
          onArchivada={(motivo, fecha) => {
            moverLocal({ ...archivando, motivoArchivo: motivo, archivadoEn: fecha }, 'archivada');
            setArchivando(null);
          }}
          onGuardando={setGuardando}
          onClose={() => setArchivando(null)}
        />
      )}

      {guardando && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/90 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Guardando…
        </div>
      )}
    </div>
  );
}

function Celda({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <span className="block">
      <span className="block font-semibold text-ink">{titulo}</span>
      <span className="block text-xs text-muted">{sub}</span>
    </span>
  );
}

function Tabla({
  columnas,
  filas,
  vacio,
}: {
  columnas: string[];
  filas: { id: string; celdas: React.ReactNode[] }[];
  vacio: string;
}) {
  if (filas.length === 0) {
    return (
      <div className="rounded-brand border border-dashed border-line bg-white px-6 py-10 text-center text-sm text-muted">
        {vacio}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-brand border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface text-left">
            {columnas.map((c, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-line last:border-0">
              {f.celdas.map((celda, i) => (
                <td key={i} className="px-4 py-2.5 align-middle">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
