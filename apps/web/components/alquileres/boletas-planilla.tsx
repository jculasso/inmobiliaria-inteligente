'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mesLargo, sumarMesesIso } from '@vacker/domain';
import {
  BoletaItemSchema,
  consecuenciaDeBoleta,
  cuotaSiguiente,
  partesDeCuota,
  textoCuota,
  unirCuota,
  type FilaPlanilla,
  type LoteBoletasResultado,
  type PlanillaBoletasDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cargarLoteBoletas } from '../../lib/alquileres-api';
import { cantidad, fmtMoneda } from '../../lib/format';
import { inputClass } from '../form-ui';
import { Bloque, CLASE_FOCO, VacioBloque } from './piezas';
import { escribirImporte, leerImporte } from '../../lib/importe';
import { InputImporte } from '../input-importe';
import { primerMensaje } from '../../lib/mensaje-zod';

/** Termina la oración con un punto, sin duplicar el que ya trae. */
const conPunto = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** La cuota va en dos campitos, «[3] de [6]» (regla 51); se guarda «3/6». */
type Carga = { n: string; de: string; vencimiento: string; importe: string };
const VACIA: Carga = { n: '', de: '', vencimiento: '', importe: '' };
const num = (v: string) => leerImporte(v) ?? 0;
const llena = (c: Carga) => c.importe.trim() !== '' || c.vencimiento !== '';
/** «10/11»: el día y el mes, que es lo que importa dentro del mes que se está cargando. */
const diaMes = (iso: string) => iso.slice(5, 10).split('-').reverse().join('/');

/** Los títulos de las columnas, en la computadora; en el teléfono cada campo lleva el suyo. */
const COLUMNAS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_9.5rem_10rem_10rem] sm:items-start sm:gap-3';

/**
 * «Cargar el mes»: una fila por cada impuesto o servicio de cada propiedad,
 * agrupadas por propiedad. «Completar con {mes anterior}» llena lo vacío con
 * lo del mes pasado —vencimiento un mes después, la cuota siguiente— y se
 * guarda todo de una vez. Gexion: «carga múltiple y desde el período anterior».
 */
export function PlanillaBoletas({ planilla, mes }: { planilla: PlanillaBoletasDto; mes: string }) {
  const router = useRouter();
  const [carga, setCarga] = useState<Record<string, Carga>>({});
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LoteBoletasResultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mesAnterior = mesLargo(sumarMesesIso(`${planilla.periodo}-01`, -1)).split(' ')[0]!;
  const de = (id: string) => carga[id] ?? VACIA;
  const poner = (id: string, campo: keyof Carga, valor: string) => {
    // Lo que se escribe después de guardar es otra tanda: el aviso anterior ya no corresponde.
    setResultado(null);
    setCarga((c) => ({ ...c, [id]: { ...(c[id] ?? VACIA), [campo]: valor } }));
  };
  const listas = Object.entries(carga).filter(([, c]) => llena(c));
  const total = listas.reduce((s, [, c]) => s + num(c.importe), 0);
  const fila = (id: string) => planilla.filas.find((x) => x.cuenta.id === id)!;

  function completarConAnterior() {
    setResultado(null);
    setCarga((actual) => {
      const nueva = { ...actual };
      for (const f of planilla.filas) {
        if (!f.anterior || llena(nueva[f.cuenta.id] ?? VACIA)) continue;
        // Si ya hay algo cargado este mes, no se propone de nuevo.
        if (f.cargadas.some((b) => b.estado !== 'anulada')) continue;
        const cuota = cuotaSiguiente(f.anterior.cuota);
        if (f.anterior.cuota && !cuota) continue; // era la última cuota
        nueva[f.cuenta.id] = {
          ...partesDeCuota(cuota),
          vencimiento: sumarMesesIso(f.anterior.vencimiento, 1),
          importe: escribirImporte(f.anterior.importe),
        };
      }
      return nueva;
    });
  }

  async function guardar() {
    const boletas = [];
    for (const [cuentaId, c] of listas) {
      const { cuenta } = fila(cuentaId);
      const quien = `${cuenta.servicio.nombre} de ${cuenta.propiedad.direccion}`;
      const cuota = unirCuota(c.n, c.de);
      if (cuota === false) {
        setError(`${quien}: la cuota va con los dos números, por ejemplo «3 de 6».`);
        return;
      }
      const b = { cuentaId, cuota, vencimiento: c.vencimiento, importe: num(c.importe) };
      const r = BoletaItemSchema.safeParse(b);
      if (!r.success) {
        // El mensaje del schema ya trae su punto: agregarle otro decía «..» (prueba en producción, 6/10/2026).
        const motivo = b.vencimiento
          ? primerMensaje(r.error, 'revisá los datos')
          : 'falta el vencimiento';
        setError(conPunto(`${quien}: ${motivo}`));
        return;
      }
      boletas.push(b);
    }
    setError(null);
    setEnviando(true);
    try {
      setResultado(
        await cargarLoteBoletas(await getAccessToken(), { periodo: planilla.periodo, boletas }),
      );
      setCarga({});
      setAbiertas(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  // Agrupadas por propiedad, en el orden en que vienen (por dirección).
  const porPropiedad = new Map<string, FilaPlanilla[]>();
  for (const f of planilla.filas)
    porPropiedad.set(f.cuenta.propiedad.id, [
      ...(porPropiedad.get(f.cuenta.propiedad.id) ?? []),
      f,
    ]);

  return (
    <Bloque
      icono="📝"
      titulo={`Boletas de ${mes}`}
      detalle={cantidad(planilla.filas.length, 'impuesto o servicio', 'impuestos y servicios')}
      acciones={
        <Button
          variant="secondary"
          size="sm"
          onClick={completarConAnterior}
          disabled={!planilla.filas.some((f) => f.anterior)}
        >
          📋 Completar con {mesAnterior}
        </Button>
      }
    >
      {planilla.filas.length === 0 ? (
        <VacioBloque>
          Todavía ninguna propiedad tiene impuestos o servicios asignados.{' '}
          <Link
            href={`?periodo=${planilla.periodo}&ver=propiedades`}
            className={`rounded font-semibold text-brand-red hover:underline ${CLASE_FOCO}`}
          >
            Asignalos en «Qué tiene cada propiedad»
          </Link>
        </VacioBloque>
      ) : (
        <>
          <div role="table" aria-label={`Boletas de ${mes}`} className="text-sm">
            <div
              role="row"
              className={`hidden border-b border-line px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-muted ${COLUMNAS}`}
            >
              <span role="columnheader">Impuesto</span>
              <span role="columnheader">Cuota</span>
              <span role="columnheader">Vence</span>
              <span role="columnheader">Importe</span>
            </div>
            {[...porPropiedad.values()].map((filas) => {
              const { propiedad, contrato } = filas[0]!.cuenta;
              return (
                <div
                  role="rowgroup"
                  key={propiedad.id}
                  className="border-b border-line last:border-0"
                >
                  <div role="row" className="bg-surface/60 px-4 py-1.5">
                    <span role="rowheader" className="font-semibold text-ink">
                      {propiedad.direccion}
                      <span className="font-normal text-muted">
                        {' '}
                        · {contrato ? contrato.codigo : 'sin contrato este mes'}
                      </span>
                    </span>
                  </div>
                  {filas.map((f) => (
                    <FilaCarga
                      key={f.cuenta.id}
                      fila={f}
                      mesAnterior={mesAnterior}
                      carga={de(f.cuenta.id)}
                      abierta={abiertas.has(f.cuenta.id)}
                      abrir={() => setAbiertas((a) => new Set(a).add(f.cuenta.id))}
                      poner={(campo, valor) => poner(f.cuenta.id, campo, valor)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {/* Regla 52: después de guardar, el aviso solo; nunca al lado de un «0 boletas» que lo contradiga. */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3">
            {error && (
              <p role="alert" className="mr-auto text-sm font-medium text-danger">
                {error}
              </p>
            )}
            {listas.length > 0 ? (
              <>
                <span className="text-sm text-muted tabular-nums">
                  {cantidad(listas.length, 'boleta')} para guardar · {fmtMoneda(total, 'ARS')}
                </span>
                <Button variant="primary" onClick={guardar} disabled={enviando}>
                  {enviando ? 'Guardando…' : `Guardar ${cantidad(listas.length, 'boleta')}`}
                </Button>
              </>
            ) : resultado ? (
              <p role="status" className="mr-auto text-sm font-semibold text-success">
                ✓ Se {resultado.creadas === 1 ? 'guardó' : 'guardaron'}{' '}
                {cantidad(resultado.creadas, 'boleta')}
                {resultado.repetidas
                  ? `; ${resultado.repetidas === 1 ? 'otra ya estaba cargada' : `${resultado.repetidas} ya estaban cargadas`}`
                  : ''}
                {resultado.sinContrato
                  ? `; ${resultado.sinContrato} sin contrato ese mes, solo para control`
                  : ''}
                . Están en «Para pagar».
              </p>
            ) : (
              <span className="text-sm text-muted">
                Completá el vencimiento y el importe de las boletas que llegaron.
              </span>
            )}
          </div>
        </>
      )}
    </Bloque>
  );
}

function FilaCarga({
  fila: f,
  mesAnterior,
  carga,
  abierta,
  abrir,
  poner,
}: {
  fila: FilaPlanilla;
  mesAnterior: string;
  carga: Carga;
  abierta: boolean;
  abrir: () => void;
  poner: (campo: keyof Carga, valor: string) => void;
}) {
  const c = f.cuenta;
  const vivas = f.cargadas.filter((b) => b.estado !== 'anulada');
  const etiqueta = `${c.servicio.nombre} de ${c.propiedad.direccion}`;
  const conCampos = vivas.length === 0 || abierta || llena(carga);
  const rotulo =
    'mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-muted sm:hidden';
  return (
    <div role="row" className={`grid gap-2 px-4 py-2.5 ${COLUMNAS}`}>
      <div role="cell" className="min-w-0">
        <span className="font-semibold text-ink">{c.servicio.nombre}</span>
        {c.numeroCuenta && <span className="text-xs text-muted"> · N° {c.numeroCuenta}</span>}
        <span className="block text-xs text-muted">
          {consecuenciaDeBoleta(c.aCargoDe, c.paga, c.contrato != null)}
        </span>
        <span className="block text-xs text-muted">
          {f.anterior
            ? `En ${mesAnterior}: ${fmtMoneda(f.anterior.importe, 'ARS')}${f.anterior.cuota ? ` (${textoCuota(f.anterior.cuota)})` : ''}`
            : `Sin boleta en ${mesAnterior}`}
        </span>
        {vivas.map((b) => (
          <span key={b.id} className="block text-xs font-semibold text-success">
            ✓ Ya cargada{b.cuota ? ` (${textoCuota(b.cuota)})` : ''}: {fmtMoneda(b.importe, 'ARS')},
            vence {diaMes(b.vencimiento)}
          </span>
        ))}
      </div>
      {conCampos ? (
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <div role="cell">
            <span className={rotulo}>Cuota</span>
            <span className="flex items-center gap-1.5 text-muted">
              <input
                aria-label={`Cuota de ${etiqueta}`}
                inputMode="numeric"
                className={`${inputClass} w-14 text-center`}
                placeholder="—"
                value={carga.n}
                onChange={(e) => poner('n', e.target.value)}
              />
              de
              <input
                aria-label={`Total de cuotas de ${etiqueta}`}
                inputMode="numeric"
                className={`${inputClass} w-14 text-center`}
                placeholder="—"
                value={carga.de}
                onChange={(e) => poner('de', e.target.value)}
              />
            </span>
          </div>
          <div role="cell">
            <span className={rotulo}>Vence</span>
            <input
              aria-label={`Vencimiento de ${etiqueta}`}
              type="date"
              className={inputClass}
              value={carga.vencimiento}
              onChange={(e) => poner('vencimiento', e.target.value)}
            />
          </div>
          <div role="cell" className="col-span-2 sm:col-span-1">
            <span className={rotulo}>Importe</span>
            <InputImporte
              aria-label={`Importe de ${etiqueta}`}
              placeholder={f.anterior ? escribirImporte(f.anterior.importe) : ''}
              value={carga.importe}
              onChange={(v) => poner('importe', v)}
            />
          </div>
        </div>
      ) : (
        <div role="cell" className="sm:col-span-3 sm:self-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={abrir}
            aria-label={`Cargar otra boleta de ${etiqueta}`}
          >
            ＋ Cargar otra boleta
          </Button>
        </div>
      )}
    </div>
  );
}
