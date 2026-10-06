'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContactoInputSchema, type ContactoDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { guardarContactos } from '../../lib/alquileres-api';
import { Campo, inputClass } from '../form-ui';
import { Insignia, Panel } from './piezas';

interface Fila {
  nombre: string;
  relacion: string;
  email: string;
  telefono: string;
  principal: boolean;
}
const deDto = (c: ContactoDto): Fila => ({ nombre: c.nombre, relacion: c.relacion ?? '', email: c.email ?? '', telefono: c.telefono ?? '', principal: c.principal });

/**
 * Los contactos adicionales de la persona (Gexion, «Datos complementarios»):
 * el hijo que paga, el contador, el administrador. Sus mails aparecen al
 * mandar un recibo o una liquidación.
 */
export function Contactos({ personaId, contactos }: { personaId: string; contactos: ContactoDto[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<Fila[]>(contactos.map(deDto));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (i: number, c: Partial<Fila>) => setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, ...c } : c.principal ? { ...x, principal: false } : x)));

  async function guardar() {
    setError(null);
    for (const [i, f] of filas.entries()) {
      const r = ContactoInputSchema.safeParse(f);
      if (!r.success) {
        setError(`Contacto ${i + 1}: ${r.error.issues[0]?.message ?? 'revisá los datos.'}`);
        return;
      }
    }
    setGuardando(true);
    try {
      await guardarContactos(await getAccessToken(), personaId, filas);
      setEditando(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel
      icono="📇"
      titulo="Contactos adicionales"
      derecha={
        !editando && (
          <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
            ✏️ {contactos.length ? 'Editar' : 'Cargar'}
          </Button>
        )
      }
    >
      {!editando ? (
        contactos.length === 0 ? (
          <p className="text-sm text-muted">Sin contactos adicionales.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {contactos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-semibold text-ink">
                  {c.nombre}
                  {c.relacion && <span className="font-normal text-muted"> · {c.relacion}</span>} {c.principal && <Insignia tono="exito">Principal</Insignia>}
                </span>
                <span className="text-muted">{[c.email, c.telefono].filter(Boolean).join(' · ') || '—'}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {filas.map((f, i) => (
            <fieldset key={i} className="grid gap-2 rounded-brand border border-line p-3 sm:grid-cols-4">
              <Campo label="Nombre" requerido>
                <input className={inputClass} value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
              </Campo>
              <Campo label="Relación">
                <input className={inputClass} value={f.relacion} onChange={(e) => cambiar(i, { relacion: e.target.value })} placeholder="Hijo, contador…" />
              </Campo>
              <Campo label="Email">
                <input className={inputClass} type="email" value={f.email} onChange={(e) => cambiar(i, { email: e.target.value })} />
              </Campo>
              <Campo label="Teléfono">
                <input className={inputClass} type="tel" value={f.telefono} onChange={(e) => cambiar(i, { telefono: e.target.value })} />
              </Campo>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-4">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name="contacto-principal" className="h-4 w-4 accent-brand-red" checked={f.principal} onChange={() => cambiar(i, { principal: true })} />
                  Principal
                </label>
                <button type="button" onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))} className="rounded px-2 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/5">
                  🗑️ Quitar
                </button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFilas((xs) => [...xs, { nombre: '', relacion: '', email: '', telefono: '', principal: xs.length === 0 }])}>
              ＋ Agregar contacto
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilas(contactos.map(deDto));
                  setEditando(false);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
