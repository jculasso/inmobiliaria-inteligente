'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidataDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { iniciarProtocolo } from '../../lib/protocolo-api';
import { Campo, Seccion, inputClass } from '../form-ui';

/** Hoy en Argentina (YYYY-MM-DD) — offset fijo -03:00, el país no tiene DST. */
function hoyArg(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Arranca el protocolo de una tasación captada. Pide los datos que la tasación
 * no tiene, ya sugeridos: precio = valor recomendado, vencimiento = calculado
 * de la exclusividad pactada, propietario = cliente de la tasación.
 */
export function IniciarProtocoloModal({
  candidata,
  onClose,
}: {
  candidata: CandidataDto;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState(hoyArg());
  const [precio, setPrecio] = useState(
    candidata.valorRecomendado != null ? String(Math.round(candidata.valorRecomendado)) : '',
  );
  const [propietarioNombre, setPropietarioNombre] = useState(candidata.cliente);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [vencimiento, setVencimiento] = useState(
    candidata.diasExclusividad != null ? sumarDias(hoyArg(), candidata.diasExclusividad) : '',
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const creado = await iniciarProtocolo(accessToken, {
        tasacionId: candidata.tasacionId,
        fechaInicio,
        precioPublicado: precio ? Number(precio) : null,
        moneda: 'USD',
        propietarioNombre: propietarioNombre.trim() || null,
        propietarioTelefono: telefono.trim() || null,
        propietarioEmail: email.trim() || null,
        vencimientoAutorizacion: vencimiento || null,
      });
      router.push(`/protocolo/${creado.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el protocolo.');
      setLoading(false);
    }
  }

  return (
    <Modal title="Iniciar protocolo de 5 semanas" onClose={onClose} size="xl">
      <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="rounded-brand border border-line bg-surface px-3 py-2.5 sm:col-span-2">
          <p className="text-sm font-bold text-ink">{candidata.direccion}</p>
          <p className="text-xs text-muted">
            {candidata.tipoPropiedad} · {candidata.tipoOperacion} ·{' '}
            {[candidata.barrio, candidata.ciudad].filter(Boolean).join(', ') || 'Sin ubicación'}
          </p>
        </div>

        <Seccion titulo="Comercialización" icono="📅">
          <div className="flex flex-col gap-2.5">
            <Campo label="Inicio de comercialización" hint="Desde acá se cuentan las 5 semanas.">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                required
                className={inputClass}
              />
            </Campo>
            <Campo label="Precio de publicación (USD)" hint="Sugerido: el valor recomendado de la tasación.">
              <input
                type="number"
                min={0}
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className={inputClass}
              />
            </Campo>
            <Campo
              label="Vencimiento de la autorización"
              hint={
                candidata.diasExclusividad != null
                  ? `Sugerido por la exclusividad pactada (${candidata.diasExclusividad} días).`
                  : 'Opcional. Avisamos 10 días antes de que venza.'
              }
            >
              <input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                className={inputClass}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Propietario" icono="👤">
          <div className="flex flex-col gap-2.5">
            <Campo label="Nombre y apellido">
              <input
                value={propietarioNombre}
                onChange={(e) => setPropietarioNombre(e.target.value)}
                className={inputClass}
              />
            </Campo>
            <Campo label="Teléfono">
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 3415023921"
                className={inputClass}
              />
            </Campo>
            <Campo label="Correo electrónico">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="propietario@correo.com"
                className={inputClass}
              />
            </Campo>
          </div>
        </Seccion>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red sm:col-span-2">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Iniciando…' : 'Iniciar protocolo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
