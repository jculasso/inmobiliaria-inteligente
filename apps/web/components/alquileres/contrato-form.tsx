'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ContratoInputSchema,
  NOMBRE_TIPO_CONTRATO,
  type AjusteContrato,
  type ContratoDto,
  type IndiceAlquiler,
  type MonedaAlquiler,
  type PapelContrato,
  type PersonaDto,
  type PropiedadAlquilerDto,
  type TipoContrato,
} from '@vacker/types';
import { generarTramos, validarPartes, validarTramos } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { actualizarContrato, crearContrato } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';
import { InputImporte, InputPorcentajeTexto } from '../input-importe';
import { escribirImporte, leerImporte, leerNumero } from '../../lib/importe';
import { CLASE_FOCO, EncabezadoPagina } from './piezas';
import { NOMBRE_INDICE, NOMBRE_PAPEL } from './nombres';

interface Parte {
  clave: string;
  personaId: string;
  papel: PapelContrato;
  porcentaje: string;
}

interface Tramo {
  numero: number;
  desde: string;
  hasta: string;
  importe: string;
}

const PASOS = ['Partes', 'Condiciones', 'Tramos'] as const;

let secuencia = 0;
const nuevaClave = () => `p${++secuencia}`;

/** Porcentajes y cantidades: `''` → null; punto o coma, decimal. */
const num = leerNumero;

/**
 * Alta y edición (en borrador) de un contrato, en tres pasos.
 *
 * Los problemas se muestran mientras se carga, con las MISMAS funciones que
 * valida la API (`validarTramos`, `validarPartes` de @vacker/domain y el
 * schema de @vacker/types): lo que esta pantalla da por bueno es lo que la API
 * acepta, y lo que rechaza lo rechaza con el mismo mensaje.
 */
export function ContratoForm({
  personas,
  propiedades,
  contrato,
}: {
  personas: PersonaDto[];
  propiedades: PropiedadAlquilerDto[];
  contrato?: ContratoDto;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);

  const [codigo, setCodigo] = useState(contrato?.codigo ?? '');
  const [propiedadId, setPropiedadId] = useState(contrato?.propiedad.id ?? '');
  const [partes, setPartes] = useState<Parte[]>(
    contrato?.partes.map((p) => ({ clave: nuevaClave(), personaId: p.personaId, papel: p.papel, porcentaje: p.porcentaje == null ? '' : String(p.porcentaje) })) ?? [
      { clave: nuevaClave(), personaId: '', papel: 'propietario', porcentaje: '' },
      { clave: nuevaClave(), personaId: '', papel: 'inquilino', porcentaje: '' },
    ],
  );

  const [tipo, setTipo] = useState<TipoContrato>(contrato?.tipo ?? 'vivienda');
  const [moneda, setMoneda] = useState<MonedaAlquiler>(contrato?.moneda ?? 'ARS');
  const [inicio, setInicio] = useState(contrato?.inicio ?? '');
  const [fin, setFin] = useState(contrato?.fin ?? '');
  const [fechaFirma, setFechaFirma] = useState(contrato?.fechaFirma ?? '');
  const [diaVencimiento, setDiaVencimiento] = useState(String(contrato?.diaVencimiento ?? 5));
  const [diaPagoPropietario, setDiaPagoPropietario] = useState(String(contrato?.diaPagoPropietario ?? 10));
  const [ajuste, setAjuste] = useState<AjusteContrato>(contrato?.ajuste ?? 'indexado');
  const [indice, setIndice] = useState<IndiceAlquiler | ''>(contrato?.indice ?? 'ICL');
  const [periodicidad, setPeriodicidad] = useState(String(contrato?.periodicidadMeses ?? 4));
  const [honorariosPct, setHonorariosPct] = useState(String(contrato?.honorariosPct ?? 8));
  const [gastosAdmPct, setGastosAdmPct] = useState(String(contrato?.gastosAdmPct ?? 2));
  const [ivaPct, setIvaPct] = useState(String(contrato?.ivaPct ?? 0));
  const [punitorioDiarioPct, setPunitorioDiarioPct] = useState(String(contrato?.punitorioDiarioPct ?? 0));
  const [pagoGarantizado, setPagoGarantizado] = useState(contrato?.pagoGarantizado ?? false);
  const [depositoImporte, setDepositoImporte] = useState(escribirImporte(contrato?.depositoImporte));
  const [depositoDevolucion, setDepositoDevolucion] = useState(contrato?.depositoDevolucion ?? '');
  const [obs, setObs] = useState(contrato?.obs ?? '');

  const [tramos, setTramos] = useState<Tramo[]>(
    contrato?.tramos.map((t) => ({ numero: t.numero, desde: t.desde, hasta: t.hasta, importe: escribirImporte(t.importe) })) ?? [],
  );

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /** Lo que se le manda a la API, armado una sola vez. */
  const dto = useMemo(
    () => ({
      codigo: codigo || null,
      propiedadId,
      tipo,
      moneda,
      inicio,
      fin,
      fechaFirma: fechaFirma || null,
      diaVencimiento: Number(diaVencimiento),
      diaPagoPropietario: Number(diaPagoPropietario),
      ajuste,
      indice: ajuste === 'indexado' ? indice || null : null,
      periodicidadMeses: ajuste === 'indexado' ? num(periodicidad) : null,
      honorariosPct: num(honorariosPct) ?? 0,
      gastosAdmPct: num(gastosAdmPct) ?? 0,
      ivaPct: num(ivaPct) ?? 0,
      punitorioDiarioPct: num(punitorioDiarioPct) ?? 0,
      pagoGarantizado,
      depositoImporte: leerImporte(depositoImporte),
      depositoMoneda: leerImporte(depositoImporte) != null ? moneda : null,
      depositoDevolucion: depositoDevolucion || null,
      obs: obs || null,
      partes: partes.filter((p) => p.personaId).map((p) => ({ personaId: p.personaId, papel: p.papel, porcentaje: p.papel === 'propietario' ? num(p.porcentaje) : null })),
      tramos: tramos.map((t) => ({ numero: t.numero, desde: t.desde, hasta: t.hasta, importe: leerImporte(t.importe) })),
    }),
    [codigo, propiedadId, tipo, moneda, inicio, fin, fechaFirma, diaVencimiento, diaPagoPropietario, ajuste, indice, periodicidad, honorariosPct, gastosAdmPct, ivaPct, punitorioDiarioPct, pagoGarantizado, depositoImporte, depositoDevolucion, obs, partes, tramos],
  );

  /** Los problemas de cada paso, para avisar antes de guardar. */
  const problemas = useMemo(() => {
    const deSchema = ContratoInputSchema.safeParse(dto);
    const mensajes = deSchema.success ? [] : deSchema.error.issues.map((i) => ({ campo: String(i.path[0] ?? ''), mensaje: i.message }));
    const enPaso = (campos: string[]) => mensajes.filter((m) => campos.includes(m.campo)).map((m) => m.mensaje);
    return [
      [...(propiedadId ? [] : ['Elegí la propiedad.']), ...validarPartes(dto.partes)],
      [...(inicio && fin ? [] : ['Completá el inicio y el fin.']), ...enPaso(['fin', 'indice', 'periodicidadMeses', 'depositoImporte', 'diaVencimiento', 'diaPagoPropietario', 'honorariosPct', 'gastosAdmPct', 'ivaPct', 'punitorioDiarioPct'])],
      // Sin fechas no hay tramos que validar, pero el paso tampoco está completo.
      inicio && fin ? [...validarTramos(inicio, fin, dto.tramos), ...enPaso(['tramos'])] : ['Completá el inicio y el fin en Condiciones.'],
    ];
  }, [dto, propiedadId, inicio, fin]);

  const listo = problemas.every((p) => p.length === 0);

  function generar() {
    const meses = num(periodicidad);
    if (!inicio || !fin || !meses || meses < 1) return;
    const importeInicial = tramos[0]?.importe ?? '';
    setTramos(generarTramos(inicio, fin, meses).map((t, i) => ({ ...t, importe: i === 0 ? importeInicial : ajuste === 'escalonado' ? (tramos[i]?.importe ?? '') : '' })));
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const accessToken = await getAccessToken();
      const guardado = contrato ? await actualizarContrato(accessToken, contrato.id, dto) : await crearContrato(accessToken, dto);
      router.push(`/alquileres/contratos/${guardado.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el contrato.');
      setGuardando(false);
    }
  }

  const setParte = (clave: string, cambio: Partial<Parte>) => setPartes((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)));
  const setTramo = (i: number, cambio: Partial<Tramo>) => setTramos((ts) => ts.map((t, j) => (j === i ? { ...t, ...cambio } : t)));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <EncabezadoPagina
        titulo={contrato ? `Editar el contrato ${contrato.codigo}` : 'Nuevo contrato'}
        volver={contrato ? { href: `/alquileres/contratos/${contrato.id}`, texto: `Contrato ${contrato.codigo}` } : { href: '/alquileres/contratos', texto: 'Contratos' }}
      />
      <ol className="flex gap-2" aria-label="Pasos del alta">
        {PASOS.map((nombre, i) => (
          // `min-w-0`: en el teléfono los tres pasos comparten el ancho en vez de empujar el último afuera.
          <li key={nombre} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setPaso(i)}
              aria-current={paso === i ? 'step' : undefined}
              className={`w-full truncate rounded-brand border px-2 py-2 text-left text-xs font-semibold sm:px-3 sm:text-sm ${CLASE_FOCO} ${
                paso === i ? 'border-brand-red bg-brand-red text-white' : 'border-line bg-white text-muted hover:text-ink'
              }`}
            >
              <span className="mr-1.5 tabular-nums">{i + 1}.</span>
              {nombre}
              {problemas[i]!.length === 0 && (
                <span className={`ml-1.5 ${paso === i ? 'text-white' : 'text-success'}`}>
                  <span aria-hidden>✓</span>
                  {/* El lector de pantalla no lee un `aria-label` en un span: el texto, escondido a la vista, sí. */}
                  <span className="sr-only"> (completo)</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>

      <section className="rounded-brand border border-line bg-white p-5 shadow-sm">
        {paso === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <Campo label="Propiedad" requerido>
                <select className={inputClass} value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
                  <option value="">Elegí la propiedad…</option>
                  {propiedades.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.direccion}
                      {p.unidad ? ` ${p.unidad}` : ''}
                      {p.ciudad ? ` · ${p.ciudad}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Código" hint="Vacío: el siguiente número.">
                <input className={inputClass} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </Campo>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                <span aria-hidden>👥</span> Partes
              </p>
              {partes.map((p) => (
                // En el teléfono cada parte es una tarjeta: apiladas sin borde,
                // el ✕ de una quedaba solo en un renglón y se leía como de la siguiente.
                <div
                  key={p.clave}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-brand border border-line p-2 sm:grid-cols-[9rem_1fr_6rem_auto] sm:border-0 sm:p-0"
                >
                  <select
                    className={inputClass}
                    aria-label="Papel"
                    value={p.papel}
                    onChange={(e) => setParte(p.clave, { papel: e.target.value as PapelContrato })}
                  >
                    {Object.entries(NOMBRE_PAPEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    className={`${inputClass} col-span-2 sm:col-span-1`}
                    aria-label={`Persona (${NOMBRE_PAPEL[p.papel].toLowerCase()})`}
                    value={p.personaId}
                    onChange={(e) => setParte(p.clave, { personaId: e.target.value })}
                  >
                    <option value="">Elegí la persona…</option>
                    {personas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  {p.papel === 'propietario' ? (
                    <InputPorcentajeTexto
                      className="col-span-2 sm:col-span-1"
                      aria-label="Porcentaje"
                      value={p.porcentaje}
                      onChange={(porcentaje) => setParte(p.clave, { porcentaje })}
                    />
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  <button
                    type="button"
                    onClick={() => setPartes((ps) => ps.filter((x) => x.clave !== p.clave))}
                    className={`col-start-2 row-start-1 min-h-11 rounded px-2 text-sm text-muted hover:text-danger sm:col-start-auto sm:row-start-auto ${CLASE_FOCO}`}
                    aria-label={`Quitar ${NOMBRE_PAPEL[p.papel].toLowerCase()}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {(['propietario', 'inquilino', 'garante'] as const).map((papel) => (
                  <Button
                    key={papel}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPartes((ps) => [...ps, { clave: nuevaClave(), personaId: '', papel, porcentaje: '' }])}
                  >
                    ＋ {NOMBRE_PAPEL[papel]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted">
                ¿No está la persona? Cargala en{' '}
                <Link href="/alquileres/personas" className="font-semibold text-brand-red hover:underline">
                  Personas
                </Link>
                . Con un solo propietario no hace falta el porcentaje: es dueño del 100%.
              </p>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tipo">
              <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoContrato)}>
                <option value="vivienda">{NOMBRE_TIPO_CONTRATO.vivienda}</option>
                <option value="comercial">{NOMBRE_TIPO_CONTRATO.comercial}</option>
              </select>
            </Campo>
            <Campo label="Moneda">
              <select className={inputClass} value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaAlquiler)}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </Campo>
            <Campo label="Inicio" requerido>
              <input type="date" className={inputClass} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo label="Fin" requerido>
              <input type="date" className={inputClass} value={fin} onChange={(e) => setFin(e.target.value)} />
            </Campo>
            <Campo label="Fecha de firma">
              <input type="date" className={inputClass} value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Vence el día" hint="Inquilino.">
                <input className={inputClass} inputMode="numeric" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} />
              </Campo>
              <Campo label="Se paga el día" hint="Propietario.">
                <input className={inputClass} inputMode="numeric" value={diaPagoPropietario} onChange={(e) => setDiaPagoPropietario(e.target.value)} />
              </Campo>
            </div>
            <Campo label="Ajuste">
              <select className={inputClass} value={ajuste} onChange={(e) => setAjuste(e.target.value as AjusteContrato)}>
                <option value="indexado">Por índice</option>
                <option value="escalonado">Escalonado (montos fijos)</option>
              </select>
            </Campo>
            {ajuste === 'indexado' ? (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Índice">
                  <select className={inputClass} value={indice} onChange={(e) => setIndice(e.target.value as IndiceAlquiler)}>
                    {(['ICL', 'IPC', 'CCP'] as const).map((v) => (
                      <option key={v} value={v}>
                        {NOMBRE_INDICE[v]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Cada (meses)">
                  <input className={inputClass} inputMode="numeric" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)} />
                </Campo>
              </div>
            ) : (
              <span />
            )}
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
              <Campo label="Honorarios" hint="Propietario. Sin IVA.">
                <InputPorcentajeTexto value={honorariosPct} onChange={setHonorariosPct} />
              </Campo>
              <Campo label="Gastos adm." hint="Inquilino. Sin IVA.">
                <InputPorcentajeTexto value={gastosAdmPct} onChange={setGastosAdmPct} />
              </Campo>
              <Campo label="IVA alquiler">
                <InputPorcentajeTexto value={ivaPct} onChange={setIvaPct} />
              </Campo>
              <Campo label="Punitorio diario">
                <InputPorcentajeTexto value={punitorioDiarioPct} onChange={setPunitorioDiarioPct} />
              </Campo>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink sm:col-span-2">
              <input type="checkbox" checked={pagoGarantizado} onChange={(e) => setPagoGarantizado(e.target.checked)} className="h-5 w-5" />
              Pago garantizado: al propietario se le paga aunque el inquilino no haya pagado.
            </label>
            <Campo label="Depósito en garantía">
              <InputImporte moneda={moneda} value={depositoImporte} onChange={setDepositoImporte} />
            </Campo>
            <Campo label="Devolución del depósito">
              <input type="date" className={inputClass} value={depositoDevolucion} onChange={(e) => setDepositoDevolucion(e.target.value)} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Observaciones">
                <textarea className={textareaClass} value={obs} onChange={(e) => setObs(e.target.value)} />
              </Campo>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              {ajuste === 'escalonado' && (
                <Campo label="Tramos de (meses)">
                  <input className={`${inputClass} w-24`} inputMode="numeric" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)} />
                </Campo>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={generar} disabled={!inicio || !fin}>
                {tramos.length ? 'Volver a generar los tramos' : 'Generar los tramos'}
              </Button>
              <p className="text-xs text-muted">
                {ajuste === 'indexado'
                  ? 'Completá el importe del primer tramo: los demás se indexan.'
                  : 'Completá el importe de cada tramo.'}
              </p>
            </div>
            {tramos.length > 0 && (
              // Una sola lista: en la computadora, una fila por tramo bajo sus
              // columnas; en el teléfono, cada tramo es una tarjetita con las
              // fechas lado a lado y el importe abajo, sin desplazar de costado.
              <div>
                <div className="hidden grid-cols-[3rem_1fr_1fr_1fr] gap-2 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted sm:grid" aria-hidden>
                  <span>N.º</span>
                  <span>Desde</span>
                  <span>Hasta</span>
                  <span>Importe mensual</span>
                </div>
                <ol className="flex flex-col gap-2 sm:gap-0">
                  {tramos.map((t, i) => (
                    <li
                      key={t.numero}
                      className="grid grid-cols-2 gap-2 rounded-brand border border-line p-2 sm:grid-cols-[3rem_1fr_1fr_1fr] sm:items-center sm:rounded-none sm:border-0 sm:border-t sm:px-0 sm:py-1.5"
                    >
                      <span className="col-span-2 text-xs font-bold tabular-nums text-muted sm:col-span-1 sm:text-sm sm:font-normal">
                        <span className="sm:hidden">Tramo </span>
                        {t.numero}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span aria-hidden className="text-[10px] font-bold uppercase tracking-wider text-muted sm:hidden">
                          Desde
                        </span>
                        <input type="date" aria-label={`Desde, tramo ${t.numero}`} className={inputClass} value={t.desde} onChange={(e) => setTramo(i, { desde: e.target.value })} />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span aria-hidden className="text-[10px] font-bold uppercase tracking-wider text-muted sm:hidden">
                          Hasta
                        </span>
                        <input type="date" aria-label={`Hasta, tramo ${t.numero}`} className={inputClass} value={t.hasta} onChange={(e) => setTramo(i, { hasta: e.target.value })} />
                      </span>
                      <InputImporte
                        className="col-span-2 sm:col-span-1"
                        aria-label={`Importe, tramo ${t.numero}`}
                        moneda={moneda}
                        placeholder={ajuste === 'indexado' && i > 0 ? 'Se indexa' : ''}
                        value={t.importe}
                        onChange={(importe) => setTramo(i, { importe })}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {problemas[paso]!.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1 rounded-brand border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink" aria-label="Lo que falta">
            {problemas[paso]!.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => (paso === 0 ? router.back() : setPaso(paso - 1))}>
          {paso === 0 ? 'Cancelar' : '← Anterior'}
        </Button>
        {paso < PASOS.length - 1 ? (
          <Button type="button" variant="primary" onClick={() => setPaso(paso + 1)}>
            Siguiente →
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={guardar} disabled={!listo || guardando}>
            {guardando ? 'Guardando…' : contrato ? 'Guardar cambios' : 'Guardar en borrador'}
          </Button>
        )}
      </div>
    </div>
  );
}
