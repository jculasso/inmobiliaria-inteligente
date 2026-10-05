'use client';

import { useState, type FormEvent } from 'react';
import type { PersonaDto, PersonaInput, TipoPersona } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { actualizarPersona, crearPersona } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';

/** Alta y edición de una persona: propietario, inquilino o garante. */
export function PersonaFormModal({
  persona,
  onClose,
  onSaved,
}: {
  persona?: PersonaDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPersona>(persona?.tipo ?? 'fisica');
  const [nombre, setNombre] = useState(persona?.nombre ?? '');
  const [documento, setDocumento] = useState(persona?.documento ?? '');
  const [email, setEmail] = useState(persona?.email ?? '');
  const [telefono, setTelefono] = useState(persona?.telefono ?? '');
  const [domicilio, setDomicilio] = useState(persona?.domicilio ?? '');
  const [obs, setObs] = useState(persona?.obs ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const dto: PersonaInput = { tipo, nombre, documento, email, telefono, domicilio, obs };
    try {
      const accessToken = await getAccessToken();
      if (persona) await actualizarPersona(accessToken, persona.id, dto);
      else await crearPersona(accessToken, dto);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={persona ? 'Editar persona' : 'Nueva persona'} onClose={onClose}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Campo label={tipo === 'juridica' ? 'Razón social' : 'Nombre y apellido'} requerido>
            <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </Campo>
          <Campo label="Tipo">
            <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoPersona)}>
              <option value="fisica">Persona física</option>
              <option value="juridica">Empresa</option>
            </select>
          </Campo>
        </div>
        <Campo label={tipo === 'juridica' ? 'CUIT' : 'DNI o CUIT'} hint="Con o sin puntos y guiones: se guarda solo con los números.">
          <input className={inputClass} value={documento} onChange={(e) => setDocumento(e.target.value)} inputMode="numeric" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo label="Teléfono">
            <input className={inputClass} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
        </div>
        <Campo label="Domicilio">
          <input className={inputClass} value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
        </Campo>
        <Campo label="Observaciones">
          <textarea className={textareaClass} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
