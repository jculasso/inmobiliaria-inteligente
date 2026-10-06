'use client';

import { useState } from 'react';
import { Button } from '@vacker/ui';
import { createClient } from '../lib/supabase/client';

/** `redirectTo`: adónde ir tras cerrar sesión. Default `/` (Home). El panel de
 * admin lo pasa como `/admin` para volver a su propio login (no a la Home). */
export function LogoutButton({ redirectTo = '/' }: { redirectTo?: string }) {
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

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  );
}
