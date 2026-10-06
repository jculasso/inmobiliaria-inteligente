'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NOMBRE_TIPO_CONTRATO, type CambiarEstadoContrato, type ContratoDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { anularContrato, borrarContrato, cambiarEstadoContrato } from '../../lib/alquileres-api';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import { DatosContratoModal } from './datos-contrato-modal';
import { ExtenderModal } from './extender-modal';
import { fmtFecha, fmtFechaDe, fmtMoneda } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { EstadoContratoBadge } from './estado-contrato';
import { NOMBRE_INDICE, NOMBRE_PAPEL } from './nombres';
import { Dato, EncabezadoPagina, Panel, Registrado } from './piezas';
import { fmtPct, variacionEntre } from '../../lib/importe';

const fmtIndice = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 4 });

/** La ficha de un contrato, con las acciones que corresponden a su estado (reglas 2 y 3). */
export function ContratoFicha({ contrato }: { contrato: ContratoDto }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<null | 'vigente' | 'finalizado' | 'rescindido'>(null);
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<null | 'datos' | 'anular' | 'borrar' | 'extender'>(null);
  // Punto 3 de Javier: con qué valores del índice se calculó cada tramo.
  const conIndice = contrato.ajuste === 'indexado' && contrato.tramos.some((t) => t.indiceBase != null);
  const unidad = `${contrato.propiedad.direccion}${contrato.propiedad.unidad ? ` ${contrato.propiedad.unidad}` : ''}`;
  const nombresDe = (papel: string) => contrato.partes.filter((p) => p.papel === papel).map((p) => p.nombre).join(', ') || '—';
  const [enviando, setEnviando] = useState(false);
  const m = (n: number | null) => (n == null ? '—' : fmtMoneda(n, contrato.moneda));
  // Las columnas de los tramos en la computadora; en el teléfono, número y fechas a la izquierda e importe a la derecha.
  const columnas = conIndice ? 'sm:grid-cols-[3rem_6rem_6rem_1fr_9rem]' : 'sm:grid-cols-[3rem_6rem_6rem_1fr]';

  async function cambiar(cambio: CambiarEstadoContrato) {
    setError(null);
    setEnviando(true);
    try {
      await cambiarEstadoContrato(await getAccessToken(), contrato.id, cambio);
      setConfirmar(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setEnviando(false);
    }
  }

  const textos = {
    vigente: {
      titulo: 'Activar el contrato',
      detalle: 'Desde ahora el contrato genera sus alquileres cada mes y ya no se edita completo: cambia por indexación o rescisión.',
      boton: 'Activar',
    },
    finalizado: {
      titulo: 'Finalizar el contrato',
      detalle: 'El contrato deja de generar alquileres. Lo ya generado queda como está.',
      boton: 'Finalizar',
    },
    rescindido: {
      titulo: 'Rescindir el contrato',
      detalle: 'Desde el mes siguiente a la fecha no se generan alquileres, y los ya generados de esos meses que no se cobraron se anulan. Lo cobrado no se toca.',
      boton: 'Rescindir',
    },
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        volver={{ href: '/alquileres/contratos', texto: 'Contratos' }}
        titulo={
          <>
            Contrato {contrato.codigo} <EstadoContratoBadge estado={contrato.estado} />
          </>
        }
        detalle={
          <>
            <p className="text-sm text-muted">
              {contrato.propiedad.direccion}
              {contrato.propiedad.unidad ? ` ${contrato.propiedad.unidad}` : ''}
              {contrato.propiedad.ciudad ? ` · ${contrato.propiedad.ciudad}` : ''}
            </p>
            <Registrado por={contrato.registrado.por} en={contrato.registrado.en || null} />
          </>
        }
      >
        {contrato.estado === 'borrador' && (
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/alquileres/contratos/${contrato.id}/editar`}>
                ✏️ Editar
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAccion('borrar')}>
              🗑️ Borrar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setConfirmar('vigente')}>
              Activar contrato
            </Button>
          </>
        )}
        {contrato.estado === 'vigente' && (
          <>
            <Button variant="secondary" size="sm" onClick={() => setAccion('datos')}>
              ✏️ Editar datos
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAccion('extender')}>
              📆 Extender
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmar('finalizado')}>
              Finalizar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmar('rescindido')}>
              Rescindir
            </Button>
          </>
        )}
        {contrato.estado !== 'borrador' && contrato.estado !== 'anulado' && (
          <Button variant="secondary" size="sm" onClick={() => setAccion('anular')}>
            🚫 Anular
          </Button>
        )}
      </EncabezadoPagina>

      {contrato.anulado && (
        <p role="status" className="rounded-brand border border-line bg-ink/5 px-4 py-3 text-sm text-ink">
          <span className="font-bold">Contrato anulado</span> el {fmtFechaDe(contrato.anulado.en)}
          {contrato.anulado.por ? ` por ${contrato.anulado.por}` : ''}: {contrato.anulado.motivo}
        </p>
      )}

      <Panel icono="👥" titulo="Partes">
        <ul className="flex flex-col gap-1.5">
          {contrato.partes.map((p) => (
            <li key={`${p.papel}-${p.personaId}`} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="w-24 text-[11px] font-bold uppercase tracking-wide text-muted">{NOMBRE_PAPEL[p.papel]}</span>
              <span className="font-semibold text-ink">{p.nombre}</span>
              {p.papel === 'propietario' && p.porcentaje != null && p.porcentaje !== 100 && <span className="text-muted">{fmtPct(p.porcentaje)}</span>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel icono="📑" titulo="Condiciones">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dato etiqueta="Vigencia">
            {fmtFecha(contrato.inicio)} al {fmtFecha(contrato.fin)}
          </Dato>
          <Dato etiqueta="Tipo">{NOMBRE_TIPO_CONTRATO[contrato.tipo]}</Dato>
          <Dato etiqueta="Ajuste">
            {contrato.ajuste === 'indexado' && contrato.indice
              ? `${NOMBRE_INDICE[contrato.indice]} cada ${contrato.periodicidadMeses} meses`
              : 'Escalonado'}
          </Dato>
          <Dato etiqueta="Vencimientos">
            Inquilino el {contrato.diaVencimiento} · propietario el {contrato.diaPagoPropietario}
          </Dato>
          <Dato etiqueta="Honorarios">{fmtPct(contrato.honorariosPct)} + IVA</Dato>
          <Dato etiqueta="Gastos adm.">{fmtPct(contrato.gastosAdmPct)} + IVA</Dato>
          <Dato etiqueta="Punitorio diario">{fmtPct(contrato.punitorioDiarioPct)}</Dato>
          <Dato etiqueta="Pago garantizado">{contrato.pagoGarantizado ? 'Sí' : 'No'}</Dato>
          {contrato.depositoImporte != null && <Dato etiqueta="Depósito">{fmtMoneda(contrato.depositoImporte, contrato.depositoMoneda ?? contrato.moneda)}</Dato>}
          {contrato.depositoDevolucion && <Dato etiqueta="Devolución del depósito">{fmtFecha(contrato.depositoDevolucion)}</Dato>}
          {contrato.rescindidoEl && <Dato etiqueta="Rescindido el">{fmtFecha(contrato.rescindidoEl)}</Dato>}
        </dl>
        {contrato.obs && <p className="mt-3 whitespace-pre-line text-sm text-muted">{contrato.obs}</p>}
      </Panel>

      <Panel icono="📈" titulo="Tramos">
        {/* Una sola lista: en la computadora se lee como tabla; en el teléfono,
            cada tramo es un renglón con su importe a la derecha, sin desplazar
            de costado (antes era una tabla de 30rem en una pantalla de 22). */}
        <div className={`hidden gap-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted sm:grid ${columnas}`} aria-hidden>
          <span>N.º</span>
          <span>Desde</span>
          <span>Hasta</span>
          {conIndice && <span>Índice usado</span>}
          <span className="text-right">Importe mensual</span>
        </div>
        <ol className="text-sm">
          {contrato.tramos.map((t) => (
            <li key={t.numero} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-line py-2 sm:items-baseline ${columnas}`}>
              <span className="tabular-nums text-muted">
                <span className="sm:hidden">Tramo </span>
                {t.numero}
                <span className="text-ink sm:hidden">
                  {' · '}
                  {fmtFecha(t.desde)} al {fmtFecha(t.hasta)}
                </span>
              </span>
              <span className="hidden tabular-nums sm:block">{fmtFecha(t.desde)}</span>
              <span className="hidden tabular-nums sm:block">{fmtFecha(t.hasta)}</span>
              {conIndice && (
                <span className="col-span-2 row-start-2 text-xs tabular-nums text-muted sm:col-span-1 sm:row-start-auto">
                  {t.indiceBase != null && t.indiceRequerido != null ? (
                    <>
                      <span className="sm:hidden">Índice </span>
                      {fmtIndice(t.indiceBase)} → {fmtIndice(t.indiceRequerido)}{' '}
                      <span className="font-semibold text-ink">({variacionEntre(t.indiceBase, t.indiceRequerido)})</span>
                      {t.importePropuesto != null && t.importe != null && Math.abs(t.importePropuesto - t.importe) > 0.5 && (
                        <span className="block">Propuesto {m(t.importePropuesto)}, se confirmó otro importe</span>
                      )}
                    </>
                  ) : (
                    <span className="hidden sm:inline">—</span>
                  )}
                </span>
              )}
              <span className="col-start-2 row-start-1 text-right font-semibold tabular-nums text-ink sm:col-start-auto sm:row-start-auto">
                {t.importe == null ? <span className="text-xs font-bold text-warning">A indexar</span> : m(t.importe)}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {accion === 'extender' && (
        <ExtenderModal
          contrato={contrato}
          onClose={() => setAccion(null)}
          onDone={() => {
            setAccion(null);
            router.refresh();
          }}
        />
      )}
      {accion === 'datos' && (
        <DatosContratoModal
          contratoId={contrato.id}
          onClose={() => setAccion(null)}
          onSaved={() => {
            setAccion(null);
            router.refresh();
          }}
        />
      )}
      {accion === 'anular' && (
        <AnularModal
          titulo={`Anular el contrato ${contrato.codigo}`}
          detalle="Tiene historia: no se borra, queda anulado y tachado, con el motivo y quién lo anuló. Sus conceptos pendientes se anulan. Si ya tiene cobros o liquidaciones, primero hay que anular esos."
          anular={async (motivo) => anularContrato(await getAccessToken(), contrato.id, motivo)}
          onClose={() => setAccion(null)}
          onDone={() => {
            setAccion(null);
            router.refresh();
          }}
        />
      )}
      {accion === 'borrar' && (
        <ConfirmarBorradoModal
          titulo={`Borrar el contrato ${contrato.codigo}`}
          descripcion="Está en borrador: todavía no generó nada. El historial guarda que existió y quién lo borró."
          detalle={
            <>
              <DatoBorrado etiqueta="Propiedad">{unidad}</DatoBorrado>
              <DatoBorrado etiqueta="Inquilino">{nombresDe('inquilino')}</DatoBorrado>
              <DatoBorrado etiqueta="Propietario">{nombresDe('propietario')}</DatoBorrado>
            </>
          }
          onConfirm={async () => {
            await borrarContrato(await getAccessToken(), contrato.id);
            router.push('/alquileres/contratos');
            router.refresh();
          }}
          onClose={() => setAccion(null)}
        />
      )}
      {confirmar && (
        <Modal
          title={textos[confirmar].titulo}
          onClose={() => {
            // Que la próxima acción no abra con el error de esta.
            setConfirmar(null);
            setError(null);
          }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-ink">{textos[confirmar].detalle}</p>
            {confirmar === 'rescindido' && (
              <Campo label="Fecha de rescisión" requerido>
                <input type="date" className={inputClass} value={fecha} min={contrato.inicio} max={contrato.fin} onChange={(e) => setFecha(e.target.value)} />
              </Campo>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={enviando || (confirmar === 'rescindido' && !fecha)}
                onClick={() => cambiar(confirmar === 'rescindido' ? { estado: 'rescindido', fecha } : { estado: confirmar })}
              >
                {enviando ? 'Guardando…' : textos[confirmar].boton}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
