'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  NOMBRE_TIPO_CONTRATO,
  PASOS_RESERVA,
  reservaAbierta,
  type CambioEstadoReserva,
  type ReservaDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarEstadoReserva, guardarGarantiasReserva } from '../../lib/reservas-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { finDeReserva } from '../../lib/reserva-a-contrato';
import { useRefrescar } from '../../lib/refrescar';
import { Campo, inputClass } from '../form-ui';
import { Garantias } from './garantias';
import { NOMBRE_INDICE } from './nombres';
import { Dato, EncabezadoPagina, MensajeError, Panel, Registrado } from './piezas';
import { EstadoReservaBadge, textoSena, VenceReserva } from './reservas-piezas';

const PAPEL = { inquilino: 'Interesado', propietario: 'Propietario', garante: 'Garante' } as const;

type Paso = CambioEstadoReserva['estado'];

/** Lo que dice cada paso al confirmarlo (regla 155). */
const PASO: Record<
  Paso,
  { boton: string; confirma: string; titulo: string; detalle: string; motivo?: true }
> = {
  en_estudio: {
    boton: '🔎 Empezar el estudio de garantías',
    confirma: 'Empezar',
    titulo: 'Empezar el estudio de garantías',
    detalle:
      'Cargá abajo cada garantía con su informe. Para aprobar la reserva, todas tienen que tener el informe hecho y al menos una, aprobada.',
  },
  aprobada: {
    boton: '✅ Aprobar',
    confirma: 'Aprobar',
    titulo: 'Aprobar la reserva',
    detalle:
      'Las garantías quedan como están y la reserva queda lista para convertirse en contrato.',
  },
  rechazada: {
    boton: 'Rechazar',
    confirma: 'Rechazar',
    titulo: 'Rechazar la reserva',
    detalle: 'Las garantías no se aprobaron. La propiedad queda libre para otra reserva.',
    motivo: true,
  },
  vencida: {
    boton: 'Dar por vencida',
    confirma: 'Dar por vencida',
    titulo: 'Dar la reserva por vencida',
    detalle: 'Pasó la fecha hasta la que valía. La propiedad queda libre para otra reserva.',
  },
  anulada: {
    boton: '🚫 Anular',
    confirma: 'Anular',
    titulo: 'Anular la reserva',
    detalle: 'La reserva queda a la vista, anulada, con el motivo. La propiedad queda libre.',
    motivo: true,
  },
};

/**
 * La ficha de una reserva (reglas 154 a 163): sus datos, los pasos que le
 * corresponden según su estado, el estudio de garantías, el Word y la línea
 * de tiempo. Cada paso queda en el historial con quién y cuándo.
 */
export function ReservaFicha({ reserva: r, hoy }: { reserva: ReservaDto; hoy: string }) {
  const { refrescar } = useRefrescar();
  const [paso, setPaso] = useState<Paso | null>(null);
  const abierta = reservaAbierta(r.estado);
  // «Dar por vencida» solo cuando ya venció (regla 158); antes, se anula.
  const pasos = PASOS_RESERVA[r.estado].filter(
    (p): p is Paso => p !== 'convertida' && (p !== 'vencida' || hoy > r.vence),
  );
  const unidad = [r.propiedad.direccion, r.propiedad.unidad].filter(Boolean).join(' ');
  const fin = finDeReserva(r.inicio, r.duracionMeses);
  const m = (n: number | null, moneda = r.moneda) => (n == null ? '—' : fmtMoneda(n, moneda));

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        volver={{ href: '/alquileres/reservas', texto: 'Reservas' }}
        titulo={
          <>
            Reserva {r.numero} <EstadoReservaBadge estado={r.estado} />
          </>
        }
        detalle={
          <>
            <p className="text-sm text-muted">
              {unidad}
              {r.propiedad.ciudad ? ` · ${r.propiedad.ciudad}` : ''}
            </p>
            <Registrado por={r.registrado.por} en={r.registrado.en || null} />
          </>
        }
      >
        {abierta && (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/alquileres/reservas/${r.id}/editar`}>✏️ Editar</Link>
          </Button>
        )}
        {pasos.map((p) => (
          <Button
            key={p}
            variant={p === 'aprobada' || p === 'en_estudio' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPaso(p)}
          >
            {PASO[p].boton}
          </Button>
        ))}
        {r.estado === 'aprobada' && (
          <Button asChild variant="primary" size="sm">
            <Link href={`/alquileres/reservas/${r.id}/convertir`}>📄 Convertir en contrato</Link>
          </Button>
        )}
      </EncabezadoPagina>

      {r.contrato && (
        <p
          role="status"
          className="rounded-brand border border-success/30 bg-success/5 px-4 py-3 text-sm text-ink"
        >
          Se convirtió en el contrato{' '}
          <Link
            href={`/alquileres/contratos/${r.contrato.id}`}
            className="font-bold text-brand-red hover:underline"
          >
            {r.contrato.codigo}
          </Link>
          .
        </p>
      )}
      {r.motivo && (r.estado === 'rechazada' || r.estado === 'anulada') && (
        <p
          role="status"
          className="rounded-brand border border-line bg-ink/5 px-4 py-3 text-sm text-ink"
        >
          <span className="font-bold">{r.estado === 'rechazada' ? 'Rechazada' : 'Anulada'}:</span>{' '}
          {r.motivo}
        </p>
      )}

      <Panel icono="👥" titulo="Personas">
        <ul className="flex flex-col gap-1.5">
          {r.partes.map((p) => (
            <li
              key={`${p.papel}-${p.personaId}`}
              className="flex flex-wrap items-baseline gap-2 text-sm"
            >
              <span className="w-24 text-[11px] font-bold uppercase tracking-wide text-muted">
                {PAPEL[p.papel]}
              </span>
              <Link
                href={`/alquileres/personas/${p.personaId}`}
                className="font-semibold text-ink hover:underline"
              >
                {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icono="🔖" titulo="Reserva y seña">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Fecha">{fmtFecha(r.fecha)}</Dato>
          <Dato etiqueta="Vale hasta">
            <VenceReserva vence={r.vence} estado={r.estado} hoy={hoy} />
          </Dato>
          <div className="col-span-2">
            <Dato etiqueta="Seña">{textoSena(r.sena)}</Dato>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          La seña se registra acá y no genera cobros ni liquidaciones.
        </p>
      </Panel>

      <Panel icono="📋" titulo="Condiciones propuestas">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Tipo">{NOMBRE_TIPO_CONTRATO[r.tipo]}</Dato>
          <Dato etiqueta="Alquiler inicial">{m(r.alquilerInicial)}</Dato>
          <Dato etiqueta="Vigencia">
            {r.inicio ? `${fmtFecha(r.inicio)}${fin ? ` al ${fmtFecha(fin)}` : ''}` : 'A definir'}
            {r.duracionMeses ? ` (${r.duracionMeses} meses)` : ''}
          </Dato>
          <Dato etiqueta="Ajuste">
            {r.ajuste === 'escalonado'
              ? 'Escalonado'
              : r.indice
                ? `${NOMBRE_INDICE[r.indice]}${r.periodicidadMeses ? ` cada ${r.periodicidadMeses === 1 ? 'mes' : `${r.periodicidadMeses} meses`}` : ''}`
                : 'Por índice, a definir'}
          </Dato>
          <Dato etiqueta="Depósito">{m(r.depositoImporte, r.depositoMoneda ?? r.moneda)}</Dato>
        </dl>
        {r.obs && <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.obs}</p>}
      </Panel>

      <Garantias
        titulo="Estudio de garantías"
        vacio={
          r.estado === 'reservada'
            ? 'Todavía no se cargaron garantías. Se cargan al empezar el estudio.'
            : 'Sin garantías cargadas.'
        }
        garantias={r.garantias}
        garantes={r.partes
          .filter((p) => p.papel === 'garante')
          .map((p) => ({ personaId: p.personaId, nombre: p.nombre }))}
        editable={r.estado === 'reservada' || r.estado === 'en_estudio'}
        guardar={(token, garantias) => guardarGarantiasReserva(token, r.id, garantias)}
      />

      {paso && (
        <PasoModal
          reservaId={r.id}
          paso={paso}
          onClose={() => setPaso(null)}
          onDone={async () => {
            await refrescar();
            setPaso(null);
          }}
        />
      )}
    </div>
  );
}

/** Confirmar un paso; rechazar y anular piden el motivo (regla 155). */
function PasoModal({
  reservaId,
  paso,
  onClose,
  onDone,
}: {
  reservaId: string;
  paso: Paso;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const textos = PASO[paso];

  async function confirmar() {
    setError(null);
    setEnviando(true);
    try {
      const cambio = (
        textos.motivo ? { estado: paso, motivo } : { estado: paso }
      ) as CambioEstadoReserva;
      await cambiarEstadoReserva(await getAccessToken(), reservaId, cambio);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={textos.titulo} onClose={onClose} cerrable={!enviando}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{textos.detalle}</p>
        {textos.motivo && (
          <Campo label="Motivo" requerido hint="Queda en la línea de tiempo, con quién lo hizo.">
            <input
              className={inputClass}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
            />
          </Campo>
        )}
        <MensajeError>{error}</MensajeError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={enviando || (!!textos.motivo && motivo.trim().length < 3)}
          >
            {enviando ? 'Guardando…' : textos.confirma}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
