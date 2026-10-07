'use client';

import { useState } from 'react';
import {
  MARCADORES_PLANTILLA,
  PLANTILLA_MAX_BYTES,
  type PlantillaDto,
  type TipoContrato,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  borrarPlantilla,
  descargarEjemploPlantilla,
  descargarPlantilla,
  editarPlantilla,
  reemplazarArchivoPlantilla,
  subirPlantilla,
} from '../../lib/alquileres-api';
import type { ArchivoDescargado } from '../../lib/api-client';
import { descargarArchivo } from '../../lib/descargar-archivo';
import { fmtFechaDe } from '../../lib/format';
import { useRefrescar } from '../../lib/refrescar';
import { Campo, inputClass } from '../form-ui';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { CLASE_FOCO, EncabezadoPagina, Insignia, MensajeError, Panel } from './piezas';

/** Para qué contratos sirve una plantilla, dicho igual en la lista, en el formulario y al borrarla. */
const PARA: Record<TipoContrato | '', string> = {
  '': 'Particulares y comerciales',
  vivienda: 'Particulares',
  comercial: 'Comerciales',
};

const ACEPTA = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CLASE_ACCION = `rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-60 ${CLASE_FOCO}`;

/** Lo que se puede revisar antes de mandar el archivo; los marcadores los revisa la API. */
function problemaDelArchivo(f: File | null): string | null {
  if (!f) return 'Elegí el archivo de Word.';
  if (!/\.docx$/i.test(f.name))
    return /\.doc$/i.test(f.name)
      ? 'Los .doc viejos no sirven: abrilo en Word y guardalo como .docx.'
      : 'La plantilla tiene que ser un archivo de Word (.docx).';
  if (f.size > PLANTILLA_MAX_BYTES) return 'La plantilla pesa más de 5 MB.';
  return null;
}

/**
 * Las plantillas de contrato de la inmobiliaria (entrega 15, rehecha el
 * 7/10/2026): cada una es un Word con marcadores `{así}` que se completan con
 * los datos del contrato. Se suben, se reemplazan y se descargan; el Word
 * completo de un contrato se baja desde su ficha.
 */
export function PlantillasVista({ plantillas }: { plantillas: PlantillaDto[] }) {
  const [modal, setModal] = useState<
    { modo: 'subir' } | { modo: 'editar' | 'reemplazar'; plantilla: PlantillaDto } | null
  >(null);
  const [aBorrar, setABorrar] = useState<PlantillaDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  const { refrescar } = useRefrescar();

  async function bajar(clave: string, pedir: (token: string) => Promise<ArchivoDescargado>) {
    setError(null);
    setBajando(clave);
    try {
      const { blob, nombre } = await pedir(await getAccessToken());
      descargarArchivo(blob, nombre);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar.');
    } finally {
      setBajando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Plantillas de contrato"
        volver={{ href: '/alquileres/configuracion', texto: 'Configuración' }}
      >
        <Button variant="primary" size="sm" onClick={() => setModal({ modo: 'subir' })}>
          ＋ Subir plantilla (Word)
        </Button>
      </EncabezadoPagina>

      <Panel icono="📝" titulo="Plantillas">
        {plantillas.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no hay plantillas. Descargá el ejemplo de abajo, adaptalo con tu contrato y
            subilo.
          </p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {plantillas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {p.nombre}
                    <span className="font-normal text-muted"> · {PARA[p.tipoContrato ?? '']}</span>
                  </p>
                  {p.formato === 'word' ? (
                    <p className="truncate text-xs text-muted">
                      📄 {p.nombreArchivo} · {fmtFechaDe(p.actualizada)}
                    </p>
                  ) : (
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Insignia tono="aviso">Texto</Insignia>
                      Plantilla de texto anterior: subí la versión en Word.
                    </p>
                  )}
                </div>
                <span className="flex flex-wrap gap-1">
                  {p.formato === 'word' && (
                    <button
                      type="button"
                      disabled={bajando === p.id}
                      onClick={() => bajar(p.id, (t) => descargarPlantilla(t, p.id))}
                      className={CLASE_ACCION}
                    >
                      {bajando === p.id ? 'Descargando…' : '⬇️ Descargar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal({ modo: 'reemplazar', plantilla: p })}
                    className={CLASE_ACCION}
                  >
                    {p.formato === 'word' ? '🔁 Reemplazar archivo' : '🔁 Subir el Word'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ modo: 'editar', plantilla: p })}
                    className={CLASE_ACCION}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setABorrar(p)}
                    className={`rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5 ${CLASE_FOCO}`}
                  >
                    🗑️ Borrar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <MensajeError className="mt-2">{error}</MensajeError>
      </Panel>

      <Panel icono="💡" titulo="Cómo se arma una plantilla">
        <div className="flex flex-col gap-3 text-sm text-ink">
          <p>
            Escribí tu contrato en Word y, donde va un dato, poné su nombre entre llaves. Al
            descargar el contrato, cada marcador se reemplaza por el dato de ese contrato.
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              <code className="rounded bg-surface px-1.5 py-0.5">{'{contrato.codigo}'}</code> — un
              dato: el número de contrato.
            </li>
            <li>
              <code className="rounded bg-surface px-1.5 py-0.5">{'{#deposito}…{/deposito}'}</code>{' '}
              — lo de adentro aparece solo si hay depósito. Con{' '}
              <code className="rounded bg-surface px-1.5 py-0.5">{'{^deposito}'}</code>, solo si no
              hay.
            </li>
            <li>
              <code className="rounded bg-surface px-1.5 py-0.5">
                {'{#tramos}Del {desde} al {hasta}: {importe}{/tramos}'}
              </code>{' '}
              — se repite una vez por tramo. Si la apertura y el cierre van solos en su párrafo, se
              repite el párrafo entero.
            </li>
          </ul>
          <p className="text-muted">
            Al subir la plantilla se revisan todos los marcadores: si alguno está mal escrito, te
            decimos cuál.
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={bajando === 'ejemplo'}
              onClick={() => bajar('ejemplo', descargarEjemploPlantilla)}
            >
              {bajando === 'ejemplo'
                ? 'Descargando…'
                : '⬇️ Descargar el ejemplo con todos los marcadores'}
            </Button>
          </div>
          <details className="rounded-brand border border-line">
            <summary className={`cursor-pointer px-3 py-2 font-semibold ${CLASE_FOCO}`}>
              Todos los marcadores
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {MARCADORES_PLANTILLA.map((m) => (
                <li key={m.nombre} className="flex flex-col gap-0.5 px-3 py-2">
                  <code className="text-xs font-semibold text-ink">
                    {m.tipo === 'texto' ? `{${m.nombre}}` : `{#${m.nombre}}…{/${m.nombre}}`}
                  </code>
                  <span className="text-xs text-muted">
                    {m.descripcion}
                    {m.campos && ` · adentro: ${m.campos.map((c) => `{${c.nombre}}`).join(', ')}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Panel>

      {modal && (
        <PlantillaModal
          modo={modal.modo}
          plantilla={modal.modo === 'subir' ? null : modal.plantilla}
          onClose={() => setModal(null)}
        />
      )}

      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar la plantilla «${aBorrar.nombre}»`}
          descripcion="Se borra también su Word. Los contratos ya descargados con ella no cambian."
          detalle={
            <>
              <DatoBorrado etiqueta="Para">{PARA[aBorrar.tipoContrato ?? '']}</DatoBorrado>
              {aBorrar.nombreArchivo && (
                <DatoBorrado etiqueta="Archivo">{aBorrar.nombreArchivo}</DatoBorrado>
              )}
            </>
          }
          onConfirm={async () => {
            await borrarPlantilla(await getAccessToken(), aBorrar.id);
            await refrescar();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}

/** Subir una plantilla, reemplazar su Word, o cambiarle el nombre y para qué contratos sirve. */
function PlantillaModal({
  modo,
  plantilla: p,
  onClose,
}: {
  modo: 'subir' | 'editar' | 'reemplazar';
  plantilla: PlantillaDto | null;
  onClose: () => void;
}) {
  const { refrescar, refrescando } = useRefrescar();
  const [nombre, setNombre] = useState(p?.nombre ?? 'Contrato de locación');
  const [tipo, setTipo] = useState<TipoContrato | ''>(p?.tipoContrato ?? '');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const conDatos = modo !== 'reemplazar';
  const conArchivo = modo !== 'editar';

  async function guardar() {
    setError(null);
    const problema = conArchivo ? problemaDelArchivo(archivo) : null;
    if (problema) return setError(problema);
    if (conDatos && !nombre.trim()) return setError('Ponele un nombre.');
    setGuardando(true);
    try {
      const token = await getAccessToken();
      const meta = { nombre, tipoContrato: tipo || null };
      if (modo === 'subir') await subirPlantilla(token, meta, archivo!);
      else if (modo === 'reemplazar') await reemplazarArchivoPlantilla(token, p!.id, archivo!);
      else await editarPlantilla(token, p!.id, meta);
      // Se cierra con la lista nueva ya a la vista.
      await refrescar();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const titulo =
    modo === 'subir'
      ? 'Subir plantilla (Word)'
      : modo === 'reemplazar'
        ? `Reemplazar el Word de «${p!.nombre}»`
        : `Editar «${p!.nombre}»`;

  return (
    <Modal
      title={titulo}
      subtitle={
        conArchivo
          ? 'Un .docx de hasta 5 MB, con los marcadores entre llaves: {contrato.codigo}.'
          : undefined
      }
      onClose={onClose}
      cerrable={!guardando}
      conCambios={archivo != null}
    >
      <div className="flex flex-col gap-3">
        {conDatos && (
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <Campo label="Nombre" requerido>
              <input
                className={inputClass}
                value={nombre}
                maxLength={80}
                onChange={(e) => setNombre(e.target.value)}
              />
            </Campo>
            <Campo label="Para contratos">
              <select
                className={inputClass}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoContrato | '')}
              >
                {(['', 'vivienda', 'comercial'] as const).map((v) => (
                  <option key={v} value={v}>
                    {PARA[v]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
        {conArchivo && (
          <Campo label="Archivo de Word (.docx)" requerido>
            <input
              type="file"
              accept={ACEPTA}
              className={`${inputClass} h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ink`}
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </Campo>
        )}
        <MensajeError className="whitespace-pre-line">{error}</MensajeError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {refrescando
              ? 'Actualizando…'
              : guardando
                ? conArchivo
                  ? 'Revisando…'
                  : 'Guardando…'
                : conArchivo
                  ? 'Subir'
                  : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
