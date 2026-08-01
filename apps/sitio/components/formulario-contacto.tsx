'use client';

import { useState } from 'react';

/**
 * El único llamado a la acción del sitio.
 *
 * Cinco campos y ninguno más. La cantidad de vendedores está porque permite
 * llegar a la reunión sabiendo con quién se habla — y descarta solo, sin tener
 * que preguntarlo, a los estudios de dos personas.
 */
const CAMPOS = [
  { name: 'nombre', label: 'Nombre y apellido', type: 'text', required: true, auto: 'name' },
  { name: 'inmobiliaria', label: 'Inmobiliaria', type: 'text', required: true, auto: 'organization' },
  { name: 'vendedores', label: 'Cantidad de vendedores', type: 'number', required: false, auto: 'off' },
  { name: 'email', label: 'Correo', type: 'email', required: true, auto: 'email' },
  { name: 'telefono', label: 'Teléfono', type: 'tel', required: true, auto: 'tel' },
] as const;

export function FormularioContacto() {
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo'>('inicial');
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.mensaje ?? 'No se pudo enviar.');
      setEstado('listo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la consulta.');
      setEstado('inicial');
    }
  }

  if (estado === 'listo') {
    return (
      <div className="rounded-brand border border-success/30 bg-success/5 p-7">
        <p className="text-lg font-extrabold text-success">Recibido.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Le escribimos dentro de las próximas 24 horas para coordinar el horario que le quede
          cómodo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-brand border border-line bg-white p-6 sm:p-7">
      <div className="flex flex-col gap-4">
        {CAMPOS.map((c) => (
          <label key={c.name} className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-ink">
              {c.label}
              {!c.required && <span className="font-normal text-muted"> (opcional)</span>}
            </span>
            <input
              name={c.name}
              type={c.type}
              required={c.required}
              autoComplete={c.auto}
              min={c.type === 'number' ? 1 : undefined}
              // 16px: por debajo de eso iOS hace zoom al enfocar el campo y
              // arrastra la pantalla entera.
              className="w-full rounded-brand border border-line bg-white px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-brand-red"
            />
          </label>
        ))}

        {/* Trampa para robots: una persona no ve este campo, así que si viene
            completo la consulta se descarta en el servidor. Es lo más barato
            que existe contra el correo basura y no molesta a nadie. */}
        <input
          name="sitio"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={estado === 'enviando'}
          className="mt-1 rounded-brand bg-brand-red px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
        >
          {estado === 'enviando' ? 'Enviando…' : 'Pedir una demostración'}
        </button>
        <p className="text-xs leading-relaxed text-muted">
          Sus datos se usan solo para contactarlo por esta consulta.
        </p>
      </div>
    </form>
  );
}
