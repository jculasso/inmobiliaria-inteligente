'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  NOMBRE_TIPO_CONTRATO,
  PASOS_RESERVA,
  reservaAbierta,
  retieneLaSena,
  type CambioEstadoReserva,
  type MedioCobro,
  type PersonaDto,
  type ReservaDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { enviarReciboPorMail, generarRecibo } from '../../lib/alquileres-api';
import {
  cambiarEstadoReserva,
  cobrarSenaReserva,
  guardarGarantiasReserva,
} from '../../lib/reservas-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda, hoyIso, nroDocumento } from '../../lib/format';
import { finDeReserva } from '../../lib/reserva-a-contrato';
import { useRefrescar } from '../../lib/refrescar';
import { Campo, inputClass } from '../form-ui';
import { EnviarMailModal } from './enviar-mail-modal';
import { Garantias } from './garantias';
import { MEDIOS_COBRO, NOMBRE_MEDIO } from './medios';
import { NOMBRE_INDICE } from './nombres';
import { Dato, EncabezadoPagina, MensajeError, Panel, Registrado } from './piezas';
import { EstadoReservaBadge, textoSena, VenceReserva } from './reservas-piezas';

const PAPEL = { inquilino: 'Interesado', propietario: 'Propietario', garante: 'Garante' } as const;

type Paso = CambioEstadoReserva['estado'];

/** Lo que dice cada paso al confirmarlo (regla 155). Todos son a mano (regla 173). */
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
  no_se_presento: {
    boton: 'No se presentó a firmar',
    confirma: 'Cerrar la reserva',
    titulo: 'El interesado no se presentó a firmar',
    detalle: 'La reserva se cierra y la propiedad queda libre para otra reserva.',
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
 * La ficha de una reserva (reglas 154 a 173): sus datos, la seña con su
 * recibo, los pasos que le corresponden según su estado —siempre a mano—, el
 * estudio de garantías, el Word y la línea de tiempo. Cada paso queda en el
 * historial con quién y cuándo.
 */
export function ReservaFicha({
  reserva: r,
  hoy,
  personas = [],
}: {
  reserva: ReservaDto;
  hoy: string;
  /** Para elegir a quién se le entrega la seña retenida si la reserva no tiene propietario (regla 171). */
  personas?: PersonaDto[];
}) {
  const { refrescar } = useRefrescar();
  const [paso, setPaso] = useState<Paso | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const abierta = reservaAbierta(r.estado);
  const interesado = r.partes.find((p) => p.papel === 'inquilino');
  // «Dar por vencida» solo cuando ya venció (regla 158); antes, se anula.
  const pasos = PASOS_RESERVA[r.estado].filter(
    (p): p is Paso => p !== 'convertida' && (p !== 'vencida' || hoy > r.vence),
  );
  const unidad = [r.propiedad.direccion, r.propiedad.unidad].filter(Boolean).join(' ');
  const fin = finDeReserva(r.inicio, r.duracionMeses);
  const m = (n: number | null, moneda = r.moneda) => (n == null ? '—' : fmtMoneda(n, moneda));
  const recibo = r.sena?.recibo ?? null;

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
      {r.senaRetenida != null && r.sena && (
        <p
          role="status"
          className="rounded-brand border border-line bg-ink/5 px-4 py-3 text-sm text-ink"
        >
          <span className="font-bold">Seña retenida:</span>{' '}
          {fmtMoneda(r.senaRetenida, r.sena.moneda)} se le entrega al propietario en su próxima
          liquidación.
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
        {/* Regla 169: la seña la guarda la inmobiliaria y el interesado recibe su recibo. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.sena && !r.sena.recibida && abierta && (
            <Button variant="primary" size="sm" onClick={() => setCobrando(true)}>
              💵 Cobrar la seña
            </Button>
          )}
          {recibo && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), recibo.id), {
                    titulo: `Recibo ${nroDocumento(recibo.numero)}`,
                    onError: setErrorPdf,
                  })
                }
              >
                🧾 Recibo {nroDocumento(recibo.numero)}
              </Button>
              {interesado && (
                <Button variant="secondary" size="sm" onClick={() => setMandando(true)}>
                  ✉️ Mandar por mail
                </Button>
              )}
            </>
          )}
        </div>
        <MensajeError className="mt-2">{errorPdf}</MensajeError>
        <p className="mt-3 text-xs text-muted">
          Al convertir la reserva en contrato, la seña pasa a ser el depósito. Si la reserva se
          rechaza, vence o el interesado no se presenta a firmar, se le entrega al propietario.
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

      {cobrando && r.sena && (
        <CobrarSenaModal
          reserva={r}
          onClose={() => setCobrando(false)}
          onDone={async () => {
            await refrescar();
            setCobrando(false);
          }}
        />
      )}
      {mandando && recibo && interesado && (
        <EnviarMailModal
          titulo={`Enviar el recibo ${nroDocumento(recibo.numero)} por mail`}
          personaId={interesado.personaId}
          enviar={async (para) => enviarReciboPorMail(await getAccessToken(), recibo.id, para)}
          onClose={() => setMandando(false)}
        />
      )}
      {paso && (
        <PasoModal
          reserva={r}
          personas={personas}
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

/**
 * Confirmar un paso; rechazar y anular piden el motivo (regla 155). Si el
 * paso retiene la seña cobrada, lo dice; y si la reserva no tiene
 * propietario, pide a quién se le entrega (regla 171).
 */
function PasoModal({
  reserva: r,
  personas,
  paso,
  onClose,
  onDone,
}: {
  reserva: ReservaDto;
  personas: PersonaDto[];
  paso: Paso;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [propietarioId, setPropietarioId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const textos = PASO[paso];
  const retiene = retieneLaSena(paso) && !!r.sena?.recibida;
  const propietarios = r.partes.filter((p) => p.papel === 'propietario');
  const pideDueno = retiene && propietarios.length === 0;

  async function confirmar() {
    setError(null);
    setEnviando(true);
    try {
      const cambio = {
        estado: paso,
        ...(textos.motivo || (paso === 'no_se_presento' && motivo.trim()) ? { motivo } : {}),
        ...(pideDueno ? { propietarioId } : {}),
      } as CambioEstadoReserva;
      await cambiarEstadoReserva(await getAccessToken(), r.id, cambio);
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
        {retiene && r.sena && (
          <p className="rounded-brand border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink">
            La seña de {fmtMoneda(r.sena.importe, r.sena.moneda)} se retiene y se le entrega{' '}
            {propietarios.length
              ? `a ${propietarios.map((p) => p.nombre).join(' y ')}`
              : 'al propietario'}{' '}
            en su próxima liquidación.
          </p>
        )}
        {pideDueno && (
          <Campo label="Propietario" requerido hint="La reserva no tiene propietario cargado.">
            <select
              className={inputClass}
              value={propietarioId}
              onChange={(e) => setPropietarioId(e.target.value)}
            >
              <option value="">Elegí a quién se le entrega la seña…</option>
              {personas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {(textos.motivo || paso === 'no_se_presento') && (
          <Campo
            label={textos.motivo ? 'Motivo' : 'Observación'}
            requerido={!!textos.motivo}
            hint="Queda en la línea de tiempo, con quién lo hizo."
          >
            <input
              className={inputClass}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus={!!textos.motivo}
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
            disabled={
              enviando ||
              (!!textos.motivo && motivo.trim().length < 3) ||
              (pideDueno && !propietarioId)
            }
          >
            {enviando ? 'Guardando…' : textos.confirma}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Regla 169: cobrar la seña. Da el recibo de Cobros —con número, PDF y
 * «Mandar por mail»— a nombre del interesado.
 */
function CobrarSenaModal({
  reserva: r,
  onClose,
  onDone,
}: {
  reserva: ReservaDto;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const interesados = r.partes.filter((p) => p.papel === 'inquilino');
  const [fecha, setFecha] = useState(hoyIso());
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [personaId, setPersonaId] = useState(interesados[0]?.personaId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cobrar() {
    setError(null);
    setEnviando(true);
    try {
      await cobrarSenaReserva(await getAccessToken(), r.id, { fecha, medio, personaId });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cobrar la seña.');
      setEnviando(false);
    }
  }

  return (
    <Modal
      title={`Cobrar la seña de ${fmtMoneda(r.sena!.importe, r.sena!.moneda)}`}
      subtitle="Sale el recibo a nombre del interesado y queda en su cuenta corriente."
      onClose={onClose}
      cerrable={!enviando}
    >
      <div className="flex flex-col gap-3">
        {interesados.length > 1 && (
          <Campo label="La paga">
            <select
              className={inputClass}
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              {interesados.map((p) => (
                <option key={p.personaId} value={p.personaId}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Fecha" requerido>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          <Campo label="Medio">
            <select
              className={inputClass}
              value={medio}
              onChange={(e) => setMedio(e.target.value as MedioCobro)}
            >
              {MEDIOS_COBRO.map((x) => (
                <option key={x} value={x}>
                  {NOMBRE_MEDIO[x]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <MensajeError>{error}</MensajeError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={cobrar} disabled={enviando || !fecha}>
            {enviando ? 'Cobrando…' : 'Cobrar y hacer el recibo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
