'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sumarMesesIso } from '@vacker/domain';
import { BoletaItemSchema, cuotaSiguiente, NOMBRE_QUIEN_PAGA, type FilaPlanilla, type LoteBoletasResultado, type PlanillaBoletasDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cargarLoteBoletas } from '../../lib/alquileres-api';
import { fmtMoneda } from '../../lib/format';
import { inputClass } from '../form-ui';
import { Bloque } from './piezas';
import { escribirImporte, leerImporte } from '../../lib/importe';
import { InputImporte } from '../input-importe';

type Carga = { cuota: string; vencimiento: string; importe: string };
const VACIA: Carga = { cuota: '', vencimiento: '', importe: '' };
const num = (v: string) => leerImporte(v) ?? 0;
const llena = (c: Carga) => c.importe.trim() !== '' || c.vencimiento !== '';

/**
 * La planilla del mes: una fila por cada impuesto o servicio de cada
 * propiedad. «Copiar el mes anterior» completa lo vacío con lo del mes
 * pasado —vencimiento un mes después, la cuota siguiente— y se guarda todo
 * de una vez. Gexion: «carga múltiple y desde el período anterior».
 */
export function PlanillaBoletas({ planilla, mes }: { planilla: PlanillaBoletasDto; mes: string }) {
  const router = useRouter();
  const [carga, setCarga] = useState<Record<string, Carga>>({});
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LoteBoletasResultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const de = (id: string) => carga[id] ?? VACIA;
  const poner = (id: string, campo: keyof Carga, valor: string) => setCarga((c) => ({ ...c, [id]: { ...(c[id] ?? VACIA), [campo]: valor } }));
  const listas = Object.entries(carga).filter(([, c]) => llena(c));
  const total = listas.reduce((s, [, c]) => s + num(c.importe), 0);

  function copiarAnterior() {
    setCarga((actual) => {
      const nueva = { ...actual };
      for (const f of planilla.filas) {
        if (!f.anterior || llena(nueva[f.cuenta.id] ?? VACIA)) continue;
        // Si ya hay algo cargado este mes, no se propone de nuevo.
        if (f.cargadas.some((b) => b.estado !== 'anulada')) continue;
        const cuota = cuotaSiguiente(f.anterior.cuota);
        if (f.anterior.cuota && !cuota) continue; // era la última cuota
        nueva[f.cuenta.id] = {
          cuota: cuota ?? '',
          vencimiento: sumarMesesIso(f.anterior.vencimiento, 1),
          importe: escribirImporte(f.anterior.importe),
        };
      }
      return nueva;
    });
  }

  async function guardar() {
    const boletas = listas.map(([cuentaId, c]) => ({ cuentaId, cuota: c.cuota || null, vencimiento: c.vencimiento, importe: num(c.importe) }));
    for (const b of boletas) {
      const r = BoletaItemSchema.safeParse(b);
      if (!r.success) {
        const f = planilla.filas.find((x) => x.cuenta.id === b.cuentaId)!;
        setError(`${f.cuenta.servicio.nombre} de ${f.cuenta.propiedad.direccion}: ${b.vencimiento ? (r.error.issues[0]?.message ?? 'revisá los datos') : 'falta el vencimiento'}.`);
        return;
      }
    }
    setError(null);
    setEnviando(true);
    try {
      setResultado(await cargarLoteBoletas(await getAccessToken(), { periodo: planilla.periodo, boletas }));
      setCarga({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Bloque
      icono="📝"
      titulo={`Cargar boletas de ${mes}`}
      detalle={`${planilla.filas.length} cuentas`}
      acciones={
        <Button variant="secondary" size="sm" onClick={copiarAnterior} disabled={!planilla.filas.some((f) => f.anterior)}>
          📋 Copiar el mes anterior
        </Button>
      }
    >
      {planilla.filas.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">Todavía ninguna propiedad tiene impuestos o servicios asignados: hacelo abajo, en «Cuentas por propiedad».</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {planilla.filas.map((f) => (
              <FilaCarga key={f.cuenta.id} fila={f} carga={de(f.cuenta.id)} poner={(campo, valor) => poner(f.cuenta.id, campo, valor)} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3">
            {resultado && (
              <p role="status" className="mr-auto text-sm text-success">
                Se cargaron {resultado.creadas} {resultado.creadas === 1 ? 'boleta' : 'boletas'}
                {resultado.repetidas ? `; ${resultado.repetidas} ya estaban` : ''}
                {resultado.sinContrato ? `; ${resultado.sinContrato} sin contrato ese mes, solo para control` : ''}.
              </p>
            )}
            {error && (
              <p role="alert" className="mr-auto text-sm font-medium text-brand-red">
                {error}
              </p>
            )}
            <span className="text-sm text-muted tabular-nums">
              {listas.length} {listas.length === 1 ? 'boleta' : 'boletas'} · {fmtMoneda(total, 'ARS')}
            </span>
            <Button variant="primary" onClick={guardar} disabled={enviando || listas.length === 0}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </>
      )}
    </Bloque>
  );
}

function FilaCarga({ fila: f, carga, poner }: { fila: FilaPlanilla; carga: Carga; poner: (campo: keyof Carga, valor: string) => void }) {
  const c = f.cuenta;
  const vivas = f.cargadas.filter((b) => b.estado !== 'anulada');
  const etiqueta = `${c.servicio.nombre} de ${c.propiedad.direccion}`;
  return (
    <li className="grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_10rem_9rem] sm:items-center">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">
          {c.propiedad.direccion} <span className="font-normal text-muted">· {c.servicio.nombre}</span>
        </span>
        <span className="block text-xs text-muted">
          {c.numeroCuenta ? `Cuenta ${c.numeroCuenta} · ` : ''}la debe el {c.aCargoDe}, paga {NOMBRE_QUIEN_PAGA[c.paga].toLowerCase()}
          {c.contrato ? ` · ${c.contrato.codigo}` : ' · sin contrato'}
          {vivas.length > 0 && <span className="text-success"> · ya cargada: {vivas.map((b) => `${b.cuota ? `${b.cuota} ` : ''}${fmtMoneda(b.importe, 'ARS')}`).join(', ')}</span>}
        </span>
      </span>
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:contents">
        <input aria-label={`Cuota de ${etiqueta}`} className={`${inputClass} text-center`} placeholder="3/6" value={carga.cuota} onChange={(e) => poner('cuota', e.target.value)} />
        <input aria-label={`Vencimiento de ${etiqueta}`} type="date" className={inputClass} value={carga.vencimiento} onChange={(e) => poner('vencimiento', e.target.value)} />
        <InputImporte
          aria-label={`Importe de ${etiqueta}`}
          className="col-span-2 sm:col-span-1"
          placeholder={f.anterior ? escribirImporte(f.anterior.importe) : ''}
          value={carga.importe}
          onChange={(v) => poner('importe', v)}
        />
      </div>
    </li>
  );
}
