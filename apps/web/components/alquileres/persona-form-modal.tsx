'use client';

import { useState, type FormEvent } from 'react';
import { NOMBRE_CONDICION_IVA, NOMBRE_ESTADO_CIVIL, type CondicionIva, type EstadoCivil, type PersonaDto, type PersonaInput, type TipoPersona } from '@vacker/types';
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
  // Información básica completa, como la ficha de clientes de Gexion (punto 14).
  const [cuit, setCuit] = useState(persona?.cuit ?? '');
  const [condicionIva, setCondicionIva] = useState<CondicionIva | ''>(persona?.condicionIva ?? '');
  const [localidad, setLocalidad] = useState(persona?.localidad ?? '');
  const [provincia, setProvincia] = useState(persona?.provincia ?? '');
  const [codigoPostal, setCodigoPostal] = useState(persona?.codigoPostal ?? '');
  const [fechaNacimiento, setFechaNacimiento] = useState(persona?.fechaNacimiento ?? '');
  const [nacionalidad, setNacionalidad] = useState(persona?.nacionalidad ?? '');
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil | ''>(persona?.estadoCivil ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const dto: PersonaInput = {
      tipo,
      nombre,
      documento,
      email,
      telefono,
      domicilio,
      obs,
      cuit,
      condicionIva: condicionIva || null,
      localidad,
      provincia,
      codigoPostal,
      fechaNacimiento: tipo === 'fisica' && fechaNacimiento ? fechaNacimiento : null,
      nacionalidad: tipo === 'fisica' ? nacionalidad : null,
      estadoCivil: tipo === 'fisica' && estadoCivil ? estadoCivil : null,
    };
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
    <Modal title={persona ? 'Editar persona' : 'Nueva persona'} onClose={onClose} size="lg">
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label={tipo === 'juridica' ? 'CUIT' : 'DNI'} hint="Se guarda solo con los números.">
            <input className={inputClass} value={documento} onChange={(e) => setDocumento(e.target.value)} inputMode="numeric" />
          </Campo>
          <Campo label="CUIT / CUIL" hint="Se controla el dígito verificador.">
            <input className={inputClass} value={cuit} onChange={(e) => setCuit(e.target.value)} inputMode="numeric" placeholder="20-12345678-6" />
          </Campo>
          <Campo label="Condición de IVA">
            <select className={inputClass} value={condicionIva} onChange={(e) => setCondicionIva(e.target.value as CondicionIva | '')}>
              <option value="">Sin cargar</option>
              {Object.entries(NOMBRE_CONDICION_IVA).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
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
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
          <Campo label="Localidad">
            <input className={inputClass} value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
          </Campo>
          <Campo label="Provincia">
            <input className={inputClass} value={provincia} onChange={(e) => setProvincia(e.target.value)} />
          </Campo>
          <Campo label="Código postal">
            <input className={inputClass} value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} />
          </Campo>
        </div>
        {tipo === 'fisica' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Fecha de nacimiento">
              <input type="date" className={inputClass} value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
            </Campo>
            <Campo label="Nacionalidad">
              <input className={inputClass} value={nacionalidad} onChange={(e) => setNacionalidad(e.target.value)} />
            </Campo>
            <Campo label="Estado civil">
              <select className={inputClass} value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value as EstadoCivil | '')}>
                <option value="">Sin cargar</option>
                {Object.entries(NOMBRE_ESTADO_CIVIL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
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
