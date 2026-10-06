'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  VARIABLES_PLANTILLA,
  type ContratoResumenDto,
  type PlantillaDto,
  type TipoContrato,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { borrarPlantilla, guardarPlantilla, vistaPreviaPlantilla } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { Campo, inputClass } from '../form-ui';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { CLASE_FOCO, EncabezadoPagina, Panel } from './piezas';

/** Para qué contratos sirve una plantilla, dicho igual en la lista, en el formulario y al borrarla. */
const PARA: Record<TipoContrato | '', string> = {
  '': 'Particulares y comerciales',
  vivienda: 'Particulares',
  comercial: 'Comerciales',
};

/**
 * Las plantillas de contrato de la inmobiliaria (entrega 15). Texto con
 * variables {{así}} que se completan con los datos de cada contrato; «# » es
 * el título y «## » cada cláusula.
 */
export function PlantillasVista({
  plantillas,
  modelo,
  contratos,
}: {
  plantillas: PlantillaDto[];
  modelo: string;
  contratos: ContratoResumenDto[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<PlantillaDto | 'nueva' | null>(
    plantillas.length === 0 ? 'nueva' : null,
  );
  const [nombre, setNombre] = useState(plantillas.length === 0 ? 'Contrato de locación' : '');
  const [tipo, setTipo] = useState<TipoContrato | ''>('');
  const [cuerpo, setCuerpo] = useState(plantillas.length === 0 ? modelo : '');
  const [contratoId, setContratoId] = useState(
    contratos.find((c) => c.estado !== 'anulado')?.id ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<PlantillaDto | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const editar = (p: PlantillaDto | 'nueva') => {
    setEditando(p);
    setNombre(p === 'nueva' ? 'Contrato de locación' : p.nombre);
    setTipo(p === 'nueva' ? '' : (p.tipoContrato ?? ''));
    setCuerpo(p === 'nueva' ? modelo : p.cuerpo);
    setError(null);
  };

  /** Inserta la variable donde está el cursor. */
  const insertar = (v: string) => {
    const t = area.current;
    const texto = `{{${v}}}`;
    if (!t) return setCuerpo((c) => c + texto);
    const [a, b] = [t.selectionStart, t.selectionEnd];
    setCuerpo((c) => c.slice(0, a) + texto + c.slice(b));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(a + texto.length, a + texto.length);
    });
  };

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await guardarPlantilla(
        await getAccessToken(),
        editando === 'nueva' || !editando ? null : editando.id,
        { nombre, tipoContrato: tipo || null, cuerpo },
      );
      setEditando(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Plantillas de contrato"
        volver={{ href: '/alquileres/configuracion', texto: 'Configuración' }}
      >
        {!editando && (
          <Button variant="primary" size="sm" onClick={() => editar('nueva')}>
            ＋ Nueva plantilla
          </Button>
        )}
      </EncabezadoPagina>

      {!editando && (
        <Panel icono="📝" titulo="Plantillas">
          {plantillas.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay plantillas.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {plantillas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold text-ink">
                    {p.nombre}
                    <span className="font-normal text-muted"> · {PARA[p.tipoContrato ?? '']}</span>
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => editar(p)}
                      className={`rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface ${CLASE_FOCO}`}
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
        </Panel>
      )}

      {editando && (
        <Panel
          icono="📝"
          titulo={editando === 'nueva' ? 'Nueva plantilla' : `Editar «${editando.nombre}»`}
        >
          <div className="flex flex-col gap-3">
            {editando === 'nueva' && (
              <p className="text-sm text-muted">
                Arranca con un modelo de contrato de locación. Es un punto de partida: revisalo con
                el abogado de la inmobiliaria.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
              <Campo label="Nombre" requerido>
                <input
                  className={inputClass}
                  value={nombre}
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
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                Variables · tocá una para insertarla
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES_PLANTILLA.map(([v, desc]) => (
                  <button
                    key={v}
                    type="button"
                    title={desc}
                    onClick={() => insertar(v)}
                    className={`rounded-full border border-line bg-white px-2 py-0.5 text-xs text-ink hover:border-brand-red ${CLASE_FOCO}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <Campo
              label="Texto del contrato"
              hint="«# » para el título, «## » para cada cláusula, una línea en blanco entre párrafos."
            >
              <textarea
                ref={area}
                className={`${inputClass} h-[28rem] font-mono text-sm leading-relaxed`}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
              />
            </Campo>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-wrap items-end gap-2">
                <Campo label="Ver con los datos del contrato">
                  <select
                    className={`${inputClass} w-64`}
                    value={contratoId}
                    onChange={(e) => setContratoId(e.target.value)}
                  >
                    {contratos
                      .filter((c) => c.estado !== 'anulado')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} · {c.propiedad.direccion}
                        </option>
                      ))}
                  </select>
                </Campo>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!contratoId}
                  onClick={() =>
                    abrirPdfEnPestana(
                      async () => vistaPreviaPlantilla(await getAccessToken(), contratoId, cuerpo),
                      { titulo: 'Vista previa', onError: setError },
                    )
                  }
                >
                  👁️ Vista previa
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        </Panel>
      )}

      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar la plantilla «${aBorrar.nombre}»`}
          descripcion="Los contratos ya generados con ella no cambian: su PDF queda como está."
          detalle={<DatoBorrado etiqueta="Para">{PARA[aBorrar.tipoContrato ?? '']}</DatoBorrado>}
          onConfirm={async () => {
            await borrarPlantilla(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}
