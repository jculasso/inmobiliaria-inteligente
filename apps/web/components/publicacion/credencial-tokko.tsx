'use client';

import { useState } from 'react';
import type { CredencialEstado, PruebaConexion } from '@vacker/types';
import { Button, Card } from '@vacker/ui';
import { Campo, inputClass } from '../form-ui';
import { getAccessToken } from '../../lib/supabase/client';
import { borrarCredencial, guardarCredencial, probarConexion } from '../../lib/publicacion-api';

/**
 * Carga de la clave de API de Tokko de la inmobiliaria.
 *
 * La clave se escribe una vez y no se vuelve a mostrar: la API guarda solo el
 * valor cifrado y devuelve los últimos 4 caracteres, que alcanzan para que
 * quien la cargó reconozca cuál es sin exponerla en pantalla.
 *
 * El botón de probar es lo que hace usable esta pantalla: valida de una vez que
 * la clave de cifrado del servidor esté bien, que la credencial se pueda
 * descifrar y que Tokko la acepte — y muestra cuántas propiedades ve la cuenta,
 * que es como se confirma que es la inmobiliaria correcta y no otra.
 */
export function CredencialTokko({ inicial }: { inicial: CredencialEstado }) {
  const [estado, setEstado] = useState(inicial);
  const [secreto, setSecreto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<PruebaConexion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function conToken<T>(fn: (t: string) => Promise<T>): Promise<T | null> {
    setError(null);
    try {
      return await fn(await getAccessToken());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.');
      return null;
    }
  }

  async function guardar() {
    setGuardando(true);
    setPrueba(null);
    const r = await conToken((t) => guardarCredencial(t, secreto.trim()));
    if (r) {
      setEstado(r);
      setSecreto('');
    }
    setGuardando(false);
  }

  async function probar() {
    setProbando(true);
    const r = await conToken(probarConexion);
    if (r) setPrueba(r);
    setProbando(false);
  }

  async function quitar() {
    const r = await conToken(borrarCredencial);
    if (r) {
      setEstado(r);
      setPrueba(null);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-ink">Conexión con Tokko Broker</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          La clave la genera un administrador en Tokko, en <strong>MI EMPRESA → PERMISOS</strong>. Se
          guarda cifrada y no se vuelve a mostrar.
        </p>
      </div>

      {estado.configurada ? (
        <div className="rounded-brand border border-line border-l-[3px] border-l-success bg-success/5 p-3">
          <p className="text-sm font-semibold text-ink">
            Clave cargada · termina en <span className="font-mono">{estado.ultimos4}</span>
          </p>
          {estado.actualizadoEl && (
            <p className="mt-0.5 text-xs text-muted">
              Última actualización: {new Date(estado.actualizadoEl).toLocaleString('es-AR')}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-brand border border-line border-l-[3px] border-l-amber-500 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-ink">Todavía no hay una clave cargada.</p>
        </div>
      )}

      <Campo
        label={estado.configurada ? 'Reemplazar la clave' : 'Clave de API de Tokko'}
        hint="Se guarda cifrada. Al reemplazarla, la anterior se descarta."
      >
        {/* type=password para que no quede visible en pantalla ni en una captura
            mientras se pega. autoComplete=off: no es una contraseña del usuario
            y no queremos que el navegador la ofrezca en otro formulario. */}
        <input
          type="password"
          autoComplete="off"
          value={secreto}
          onChange={(e) => setSecreto(e.target.value)}
          placeholder="Pegá la clave de Tokko"
          className={inputClass}
        />
      </Campo>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={guardar} disabled={guardando || secreto.trim().length < 20}>
          {guardando ? 'Guardando…' : estado.configurada ? 'Reemplazar' : 'Guardar'}
        </Button>
        <Button variant="secondary" size="sm" onClick={probar} disabled={probando || !estado.configurada}>
          {probando ? 'Probando…' : 'Probar conexión'}
        </Button>
        {estado.configurada && (
          <button type="button" onClick={quitar} className="text-xs font-semibold text-brand-red hover:underline">
            Quitar
          </button>
        )}
      </div>

      {prueba && (
        <div
          role="status"
          className={`rounded-brand border border-line border-l-[3px] p-3 text-sm ${
            prueba.ok ? 'border-l-success bg-success/5' : 'border-l-brand-red bg-brand-red/5'
          }`}
        >
          {prueba.ok ? (
            <p className="text-ink">
              <strong>Conexión correcta.</strong> Tokko reporta{' '}
              <strong>{prueba.propiedades?.toLocaleString('es-AR')} propiedades</strong> en esta cuenta.
            </p>
          ) : (
            <p className="text-ink">{prueba.error}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-brand-red">{error}</p>}
    </Card>
  );
}
