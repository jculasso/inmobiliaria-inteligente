'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DIAS_ANTICIPACION_INDEXACION,
  type BandejaIndexacionDto,
  type DiferenciasFinalesDto,
  type EstadoIndiceDto,
  type IndexacionDto,
} from '@vacker/types';
import { mesLargo } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { confirmarIndexacion, previsualizarDiferencias } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { EncabezadoPagina, Insignia, TituloSeccion, Vacio } from './piezas';
import { NOMBRE_INDICE } from './nombres';
import { leerImporte, variacionEntre } from '../../lib/importe';
import { InputImporte } from '../input-importe';

/** «IPC de julio de 2026» o «ICL del 01/07/2026»: el valor que se usó, nombrado como lo lee una persona. */
function valorDe(indice: 'ICL' | 'IPC' | 'CCP', fecha: string | null): string {
  if (!fecha) return '';
  return indice === 'ICL' ? `ICL del ${fmtFecha(fecha)}` : `IPC de ${mesLargo(fecha)}`;
}

const fmtIndice = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('es-AR', { maximumFractionDigits: 4 });

function EstadoIndices({ indices }: { indices: EstadoIndiceDto[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="py-1 font-bold uppercase tracking-wider">📈 Índices cargados</span>
        {indices.map((i) => (
          <span key={i.indice} className="rounded-full border border-line bg-white px-2.5 py-1">
            <span className="font-bold text-ink">{i.indice}</span>{' '}
            {i.ultimaFecha == null
              ? 'sin valores'
              : i.indice === 'ICL'
                ? `hasta el ${fmtFecha(i.ultimaFecha)}`
                : `hasta ${mesLargo(i.ultimaFecha)}`}
          </span>
        ))}
      </div>
      {indices
        .filter((i) => i.alerta)
        .map((i) => (
          <p
            key={i.indice}
            role="alert"
            className="rounded-brand border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink"
          >
            {i.alerta}
          </p>
        ))}
    </div>
  );
}

/** «octubre de 2026», «octubre y noviembre de 2026»… los meses cobrados como parcial. */
function meses(periodos: string[]): string {
  const nombres = periodos.map((p) => mesLargo(`${p}-01`));
  return nombres.length <= 1
    ? (nombres[0] ?? '')
    : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/**
 * Regla 137: lo que va a generar la confirmación, en una frase. Negativo
 * (un importe menor que el anterior, regla 134): al inquilino se le devuelve
 * y el propietario devuelve.
 */
export function textoDiferencias(d: DiferenciasFinalesDto): string {
  const plata = (n: number) => fmtMoneda(Math.abs(n), d.moneda);
  const inquilino =
    d.inquilino >= 0
      ? `inquilino ${plata(d.inquilino)}`
      : `inquilino ${plata(d.inquilino)} a su favor`;
  const propietario =
    d.propietarios >= 0
      ? `propietario ${plata(d.propietarios)}`
      : `propietario devuelve ${plata(d.propietarios)}`;
  return `Se van a generar las diferencias de ${meses(d.periodos)}: ${inquilino}, ${propietario}. Vencen el ${fmtFecha(d.vencimiento)}.`;
}

function Tramo({ t, onConfirmado }: { t: IndexacionDto; onConfirmado: (mensaje: string) => void }) {
  const [importe, setImporte] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** La vista previa de la liquidación final, antes de confirmar (regla 137). */
  const [vista, setVista] = useState<{ manual: number | null; d: DiferenciasFinalesDto } | null>(
    null,
  );
  const unidad = `${t.contrato.direccion}${t.contrato.unidad ? ` ${t.contrato.unidad}` : ''}`;

  /**
   * Primero la vista previa: si el tramo tiene meses cobrados como parcial,
   * se muestra qué diferencias se van a generar y se confirma en un segundo
   * paso. Si no tiene, se confirma directo, como siempre.
   */
  async function confirmar() {
    setError(null);
    const manual = t.estado === 'manual' ? (leerImporte(importe) ?? Number.NaN) : null;
    if (t.estado === 'manual' && !(manual! > 0)) {
      setError('Cargá el importe del tramo.');
      return;
    }
    setEnviando(true);
    try {
      const token = await getAccessToken();
      const { diferencias } = await previsualizarDiferencias(token, t.tramoId, manual);
      if (diferencias && diferencias.conceptos > 0) {
        setVista({ manual, d: diferencias });
        setEnviando(false);
        return;
      }
      await confirmarDe(token, manual);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar.');
      setEnviando(false);
    }
  }

  async function confirmarDe(token: string, manual: number | null) {
    const r = await confirmarIndexacion(token, t.tramoId, manual);
    onConfirmado(
      `Contrato ${t.contrato.codigo}: el tramo ${r.numero} quedó en ${fmtMoneda(r.importe)}.${
        r.diferencias && r.diferencias.conceptos > 0
          ? ` Se generó la liquidación final de ${meses(r.diferencias.periodos)}.`
          : ''
      }`,
    );
  }

  async function confirmarConDiferencias() {
    if (!vista) return;
    setError(null);
    setEnviando(true);
    try {
      await confirmarDe(await getAccessToken(), vista.manual);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar.');
      setEnviando(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-brand border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
          <Link href={`/alquileres/contratos/${t.contrato.id}`} className="hover:underline">
            {t.contrato.codigo} · {unidad}
          </Link>
          {t.vencida && <Insignia tono="peligro">Vencida</Insignia>}
        </p>
        <p className="text-xs text-muted">
          {t.inquilinos.join(', ') || 'Sin inquilino'} · Tramo {t.numero}, desde el{' '}
          {fmtFecha(t.desde)} · {NOMBRE_INDICE[t.indice]}
        </p>
        {t.estado === 'lista' && (
          <>
            <p className="mt-2 text-sm tabular-nums text-ink">
              <span className="text-muted">{fmtMoneda(t.importeAnterior)}</span> →{' '}
              <span className="font-bold">{fmtMoneda(t.importePropuesto)}</span>{' '}
              <span className="text-xs font-semibold text-muted">
                {variacionEntre(t.importeAnterior, t.importePropuesto!)}
              </span>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {valorDe(t.indice, t.fechaBase)}: {fmtIndice(t.valorBase)} →{' '}
              {valorDe(t.indice, t.fechaRequerida)}: {fmtIndice(t.valorRequerido)}
            </p>
          </>
        )}
        {t.estado === 'pendiente_indice' && (
          <p className="mt-2 text-sm text-ink">
            Falta {t.falta.join(' y ')}.{' '}
            {t.indice === 'IPC' ? 'El INDEC lo publica a mediados del mes siguiente.' : ''}
          </p>
        )}
        {t.estado === 'manual' && (
          <p className="mt-2 text-sm text-ink">
            Tramo anterior: <span className="tabular-nums">{fmtMoneda(t.importeAnterior)}</span>.
            Casa Propia no tiene fuente automática: el importe se carga a mano.
          </p>
        )}
        {(t.estado === 'pendiente_indice' || t.estado === 'manual') && (
          // Regla 130: mientras tanto el mes no queda sin cobrar.
          <p className="mt-1 text-xs text-muted">
            Mientras tanto, cada mes se cobra como liquidación parcial con el importe anterior (
            <span className="whitespace-nowrap tabular-nums">{fmtMoneda(t.importeAnterior)}</span>
            ); al confirmar se genera la diferencia.
          </p>
        )}
        {vista && (
          <div className="mt-3 rounded-brand border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink">
            <p>{textoDiferencias(vista.d)}</p>
            <p className="mt-1 text-xs text-muted">
              Los meses ya cobrados como liquidación parcial no se tocan: la diferencia va como
              liquidación final, en el mismo mes.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={confirmarConDiferencias}
                disabled={enviando}
              >
                {enviando ? 'Confirmando…' : 'Confirmar y generar las diferencias'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setVista(null)}
                disabled={enviando}
              >
                Volver
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      {t.estado !== 'pendiente_indice' && !vista && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          {t.estado === 'manual' && (
            <InputImporte
              aria-label={`Importe del tramo ${t.numero} del contrato ${t.contrato.codigo}`}
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
              value={importe}
              onChange={setImporte}
            />
          )}
          <Button
            variant="primary"
            size="md"
            onClick={confirmar}
            disabled={enviando}
            className={t.estado === 'manual' ? 'shrink-0' : 'w-full sm:w-auto'}
          >
            {enviando
              ? 'Confirmando…'
              : t.estado === 'lista'
                ? `Confirmar ${fmtMoneda(t.importePropuesto)}`
                : 'Confirmar'}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * La bandeja «a indexar» (reglas 5 a 8). El sistema propone; nada cambia hasta
 * que alguien confirma (regla 6). Los que esperan un índice que todavía no se
 * publicó van aparte: no son indexaciones vencidas (regla 7).
 */
export function BandejaIndexacion({ bandeja }: { bandeja: BandejaIndexacionDto }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const listas = bandeja.tramos.filter((t) => t.estado !== 'pendiente_indice');
  const esperando = bandeja.tramos.filter((t) => t.estado === 'pendiente_indice');

  function confirmado(mensaje: string) {
    setAviso(mensaje);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="A indexar" />
      <EstadoIndices indices={bandeja.indices} />
      {aviso && (
        <p
          role="status"
          className="rounded-brand border border-success/30 bg-success/5 px-3 py-2 text-sm text-ink"
        >
          {aviso}
        </p>
      )}

      {bandeja.tramos.length === 0 ? (
        <Vacio>
          No hay tramos para indexar en los próximos {DIAS_ANTICIPACION_INDEXACION} días.
        </Vacio>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <TituloSeccion icono="✅" detalle={String(listas.length)}>
              Para confirmar
            </TituloSeccion>
            {listas.length === 0 ? (
              <p className="text-sm text-muted">
                Ninguno: los tramos que vienen esperan un índice.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {listas.map((t) => (
                  <Tramo key={t.tramoId} t={t} onConfirmado={confirmado} />
                ))}
              </ul>
            )}
          </section>
          {esperando.length > 0 && (
            <section className="flex flex-col gap-2">
              <TituloSeccion icono="⏳" detalle={String(esperando.length)}>
                Esperando el índice
              </TituloSeccion>
              <ul className="flex flex-col gap-2">
                {esperando.map((t) => (
                  <Tramo key={t.tramoId} t={t} onConfirmado={confirmado} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
