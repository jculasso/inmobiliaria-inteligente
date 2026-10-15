'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  NOMBRE_TIPO_CONTRATO,
  ReservaInputSchema,
  type AjusteContrato,
  type ContratoResumenDto,
  type IndiceAlquiler,
  type MonedaAlquiler,
  type PapelContrato,
  type PersonaDto,
  type PropiedadAlquilerDto,
  type ReservaDto,
  type ReservaInput,
  type TipoContrato,
} from '@vacker/types';
import { sumarDiasIso } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { actualizarReserva, crearReserva } from '../../lib/reservas-api';
import { escribirImporte, leerImporte, leerNumero } from '../../lib/importe';
import { hoyIso, nroDocumento } from '../../lib/format';
import { mensajeLegible } from '../../lib/mensaje-zod';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { InputImporte } from '../input-importe';
import { CLASE_FOCO, EncabezadoPagina, MensajeError, Panel } from './piezas';
import { NOMBRE_INDICE } from './nombres';
import { PersonaFormModal } from './persona-form-modal';

/** El papel de cada parte, dicho como en una reserva: el inquilino todavía es un interesado. */
const PAPEL: Record<PapelContrato, string> = {
  inquilino: 'Interesado',
  propietario: 'Propietario',
  garante: 'Garante',
};

/** La opción del desplegable que abre el alta de una persona, sin salir del formulario. */
const NUEVA = '__nueva__';

interface Parte {
  clave: string;
  personaId: string;
  papel: PapelContrato;
}

let secuencia = 0;
const nuevaClave = () => `r${++secuencia}`;

const unidad = (p: { direccion: string; unidad: string | null }) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');

/**
 * Alta y edición de una reserva (reglas 154 y 158; Florencia, Vacker,
 * 15/10/2026). El interesado se puede dar de alta acá mismo («＋ Dar de
 * alta…» en el desplegable). Los problemas se avisan con el MISMO schema que
 * valida la API (`ReservaInputSchema`).
 *
 * Al elegir la propiedad, si tuvo un contrato, se proponen sus propietarios.
 */
export function ReservaForm({
  personas: personasIniciales,
  propiedades,
  contratos,
  reserva,
}: {
  personas: PersonaDto[];
  propiedades: PropiedadAlquilerDto[];
  /** Para proponer los propietarios de la propiedad elegida. */
  contratos: ContratoResumenDto[];
  reserva?: ReservaDto;
}) {
  const router = useRouter();
  const hoy = hoyIso();
  const [personas, setPersonas] = useState(personasIniciales);
  const [propiedadId, setPropiedadId] = useState(reserva?.propiedad.id ?? '');
  const [partes, setPartes] = useState<Parte[]>(
    reserva?.partes.map((p) => ({
      clave: nuevaClave(),
      personaId: p.personaId,
      papel: p.papel,
    })) ?? [{ clave: nuevaClave(), personaId: '', papel: 'inquilino' }],
  );
  const [fecha, setFecha] = useState(reserva?.fecha ?? hoy);
  const [vence, setVence] = useState(reserva?.vence ?? sumarDiasIso(hoy, 7));
  const [senaImporte, setSenaImporte] = useState(escribirImporte(reserva?.sena?.importe));
  const [senaMoneda, setSenaMoneda] = useState<MonedaAlquiler>(reserva?.sena?.moneda ?? 'ARS');
  // Regla 169: con el recibo hecho, la seña ya no se cambia acá (se anula el recibo).
  const senaConRecibo = reserva?.sena?.recibo ?? null;
  const [tipo, setTipo] = useState<TipoContrato>(reserva?.tipo ?? 'vivienda');
  const [moneda, setMoneda] = useState<MonedaAlquiler>(reserva?.moneda ?? 'ARS');
  const [alquiler, setAlquiler] = useState(escribirImporte(reserva?.alquilerInicial));
  const [inicio, setInicio] = useState(reserva?.inicio ?? '');
  const [duracion, setDuracion] = useState(String(reserva?.duracionMeses ?? ''));
  const [ajuste, setAjuste] = useState<AjusteContrato>(reserva?.ajuste ?? 'indexado');
  const [indice, setIndice] = useState<IndiceAlquiler | ''>(reserva?.indice ?? '');
  const [periodicidad, setPeriodicidad] = useState(String(reserva?.periodicidadMeses ?? ''));
  const [deposito, setDeposito] = useState(escribirImporte(reserva?.depositoImporte));
  const [depositoMoneda, setDepositoMoneda] = useState<MonedaAlquiler>(
    reserva?.depositoMoneda ?? 'ARS',
  );
  const [obs, setObs] = useState(reserva?.obs ?? '');
  const [altaPara, setAltaPara] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const dto: ReservaInput = useMemo(
    () => ({
      propiedadId,
      fecha,
      vence,
      partes: partes
        .filter((p) => p.personaId)
        .map((p) => ({ personaId: p.personaId, papel: p.papel })),
      senaImporte: leerImporte(senaImporte),
      senaMoneda,
      tipo,
      moneda,
      alquilerInicial: leerImporte(alquiler),
      inicio: inicio || null,
      duracionMeses: leerNumero(duracion),
      ajuste,
      indice: ajuste === 'indexado' ? indice || null : null,
      periodicidadMeses: leerNumero(periodicidad),
      depositoImporte: leerImporte(deposito),
      depositoMoneda,
      obs: obs || null,
    }),
    [
      propiedadId,
      fecha,
      vence,
      partes,
      senaImporte,
      senaMoneda,
      tipo,
      moneda,
      alquiler,
      inicio,
      duracion,
      ajuste,
      indice,
      periodicidad,
      deposito,
      depositoMoneda,
      obs,
    ],
  );

  const problemas = useMemo(() => {
    const r = ReservaInputSchema.safeParse(dto);
    if (r.success) return [];
    return [
      ...new Set(
        r.error.issues.map((i) =>
          i.path[0] === 'propiedadId' ? 'Elegí la propiedad.' : mensajeLegible(i.message),
        ),
      ),
    ];
  }, [dto]);

  /** Regla 154: al elegir la propiedad, los propietarios de su último contrato, si no hay ninguno cargado. */
  function elegirPropiedad(id: string) {
    setPropiedadId(id);
    if (partes.some((p) => p.papel === 'propietario' && p.personaId)) return;
    const ultimo = contratos
      .filter((c) => c.propiedad.id === id && c.estado !== 'anulado')
      .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
    if (!ultimo?.propietarios.length) return;
    setPartes((ps) => [
      ...ps.filter((p) => p.papel !== 'propietario'),
      ...ultimo.propietarios.map((x) => ({
        clave: nuevaClave(),
        personaId: x.id,
        papel: 'propietario' as const,
      })),
    ]);
  }

  const setParte = (clave: string, cambio: Partial<Parte>) =>
    setPartes((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)));

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const token = await getAccessToken();
      const guardada = reserva
        ? await actualizarReserva(token, reserva.id, dto)
        : await crearReserva(token, dto);
      router.push(`/alquileres/reservas/${guardada.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la reserva.');
      setGuardando(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <EncabezadoPagina
        titulo={reserva ? `Editar la reserva ${reserva.numero}` : 'Nueva reserva'}
        volver={
          reserva
            ? { href: `/alquileres/reservas/${reserva.id}`, texto: `Reserva ${reserva.numero}` }
            : { href: '/alquileres/reservas', texto: 'Reservas' }
        }
      />

      <Panel icono="🏠" titulo="Propiedad y personas">
        <div className="flex flex-col gap-3">
          <Campo label="Propiedad" requerido>
            <select
              className={inputClass}
              value={propiedadId}
              onChange={(e) => elegirPropiedad(e.target.value)}
            >
              <option value="">Elegí la propiedad…</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {unidad(p)}
                  {p.ciudad ? ` · ${p.ciudad}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          {partes.map((p) => (
            <div
              key={p.clave}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-brand border border-line p-2 sm:grid-cols-[9rem_1fr_auto] sm:border-0 sm:p-0"
            >
              <select
                className={inputClass}
                aria-label="Papel"
                value={p.papel}
                onChange={(e) => setParte(p.clave, { papel: e.target.value as PapelContrato })}
              >
                {(['inquilino', 'propietario', 'garante'] as const).map((v) => (
                  <option key={v} value={v}>
                    {PAPEL[v]}
                  </option>
                ))}
              </select>
              <select
                className={`${inputClass} col-span-2 sm:col-span-1`}
                aria-label={`Persona (${PAPEL[p.papel].toLowerCase()})`}
                value={p.personaId}
                onChange={(e) =>
                  e.target.value === NUEVA
                    ? setAltaPara(p.clave)
                    : setParte(p.clave, { personaId: e.target.value })
                }
              >
                <option value="">Elegí la persona…</option>
                <option value={NUEVA}>＋ Dar de alta una persona nueva…</option>
                {personas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPartes((ps) => ps.filter((x) => x.clave !== p.clave))}
                className={`col-start-2 row-start-1 min-h-11 rounded px-2 text-sm text-muted hover:text-danger sm:col-start-auto sm:row-start-auto ${CLASE_FOCO}`}
                aria-label={`Quitar ${PAPEL[p.papel].toLowerCase()}`}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(['inquilino', 'propietario', 'garante'] as const).map((papel) => (
              <Button
                key={papel}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPartes((ps) => [...ps, { clave: nuevaClave(), personaId: '', papel }])
                }
              >
                ＋ {PAPEL[papel]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted">
            El interesado es el futuro inquilino. Los garantes son los que se proponen: el estudio
            de garantías se carga después, en la ficha de la reserva.
          </p>
        </div>
      </Panel>

      <Panel icono="🔖" titulo="Reserva y seña">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Fecha de la reserva" requerido>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          <Campo
            label="Vale hasta"
            requerido
            hint="Pasada esta fecha, la reserva se da por vencida."
          >
            <input
              type="date"
              className={inputClass}
              value={vence}
              onChange={(e) => setVence(e.target.value)}
            />
          </Campo>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo label="Seña" hint="Florencia: un mes de alquiler, igual al depósito.">
              <InputImporte
                moneda={senaMoneda}
                value={senaImporte}
                onChange={setSenaImporte}
                disabled={!!senaConRecibo}
              />
            </Campo>
            <Campo label="En">
              <select
                className={inputClass}
                aria-label="Moneda de la seña"
                disabled={!!senaConRecibo}
                value={senaMoneda}
                onChange={(e) => setSenaMoneda(e.target.value as MonedaAlquiler)}
              >
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </Campo>
          </div>
          {senaConRecibo ? (
            <p className="self-end text-xs text-muted">
              Ya se cobró: recibo {nroDocumento(senaConRecibo.numero)}. Para cambiarla, anulá ese
              recibo en Cobros.
            </p>
          ) : (
            <p className="self-end text-xs text-muted">
              Se cobra desde la ficha de la reserva: sale el recibo a nombre del interesado.
            </p>
          )}
        </div>
      </Panel>

      <Panel icono="📋" titulo="Condiciones propuestas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Tipo">
            <select
              className={inputClass}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoContrato)}
            >
              <option value="vivienda">{NOMBRE_TIPO_CONTRATO.vivienda}</option>
              <option value="comercial">{NOMBRE_TIPO_CONTRATO.comercial}</option>
            </select>
          </Campo>
          <Campo label="Moneda del alquiler">
            <select
              className={inputClass}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}
            >
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </Campo>
          <Campo label="Alquiler inicial">
            <InputImporte moneda={moneda} value={alquiler} onChange={setAlquiler} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Inicio">
              <input
                type="date"
                className={inputClass}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </Campo>
            <Campo label="Meses">
              <input
                className={inputClass}
                inputMode="numeric"
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
              />
            </Campo>
          </div>
          <Campo label="Ajuste">
            <select
              className={inputClass}
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value as AjusteContrato)}
            >
              <option value="indexado">Por índice</option>
              <option value="escalonado">Escalonado (montos fijos)</option>
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            {ajuste === 'indexado' ? (
              <Campo label="Índice">
                <select
                  className={inputClass}
                  value={indice}
                  onChange={(e) => setIndice(e.target.value as IndiceAlquiler | '')}
                >
                  <option value="">A definir</option>
                  {(['ICL', 'IPC', 'CCP'] as const).map((v) => (
                    <option key={v} value={v}>
                      {NOMBRE_INDICE[v]}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : (
              <span />
            )}
            <Campo label={ajuste === 'indexado' ? 'Cada (meses)' : 'Tramos de (meses)'}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value)}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo label="Depósito en garantía">
              <InputImporte moneda={depositoMoneda} value={deposito} onChange={setDeposito} />
            </Campo>
            <Campo label="En">
              <select
                className={inputClass}
                aria-label="Moneda del depósito"
                value={depositoMoneda}
                onChange={(e) => setDepositoMoneda(e.target.value as MonedaAlquiler)}
              >
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo label="Observaciones">
              <textarea
                className={textareaClass}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </Campo>
          </div>
        </div>
      </Panel>

      {problemas.length > 0 && (
        <ul
          className="flex flex-col gap-1 rounded-brand border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink"
          aria-label="Lo que falta"
        >
          {problemas.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}
      <MensajeError>{error}</MensajeError>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={guardar}
          disabled={problemas.length > 0 || guardando}
        >
          {guardando ? 'Guardando…' : reserva ? 'Guardar cambios' : 'Registrar la reserva'}
        </Button>
      </div>

      {altaPara && (
        <PersonaFormModal
          onClose={() => setAltaPara(null)}
          onSaved={(nueva) => {
            setPersonas((ps) =>
              [...ps, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
            );
            setParte(altaPara, { personaId: nueva.id });
            setAltaPara(null);
          }}
        />
      )}
    </div>
  );
}
