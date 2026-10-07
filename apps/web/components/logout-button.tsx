'use client';

import { useState } from 'react';
import { Button } from '@vacker/ui';
import { createClient } from '../lib/supabase/client';

/** `redirectTo`: adónde ir tras cerrar sesión. Default `/` (Home). El panel de
 * admin lo pasa como `/admin` para volver a su propio login (no a la Home).
 *
 * `compacto`: en el teléfono es un botón de ícono de 40px (con su nombre para
 * el lector de pantalla); desde `sm`, el de siempre con el texto. Lo usa la
 * cabecera de los módulos, que en 375px empujaba el título hasta la mitad de
 * la pantalla (prueba en producción, 6/10/2026). */
export function LogoutButton({
  redirectTo = '/',
  compacto = false,
}: {
  redirectTo?: string;
  compacto?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    // Solo este dispositivo: salir en el celular no cierra la computadora.
    // Si la red falla, se borra igual la sesión local —en un celular
    // compartido, «Cerrar sesión» tiene que cerrar siempre— y se navega con
    // recarga completa, para que nada de la sesión quede en memoria.
    const { error } = await supabase.auth
      .signOut({ scope: 'local' })
      .catch((e: unknown) => ({ error: e }));
    if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    // `replace`: que «atrás» no vuelva a la pantalla de la sesión que se cerró.
    window.location.replace(redirectTo);
  }

  const texto = loading ? 'Saliendo…' : 'Cerrar sesión';
  if (!compacto) {
    return (
      <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loading}>
        {texto}
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      aria-label={texto}
      title={texto}
      className="max-sm:h-10 max-sm:w-10 max-sm:px-0"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 sm:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      <span className="max-sm:hidden">{texto}</span>
    </Button>
  );
}
