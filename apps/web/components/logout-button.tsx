'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vacker/ui';
import { createClient } from '../lib/supabase/client';

/** `redirectTo`: adónde ir tras cerrar sesión. Default `/` (Home). El panel de
 * admin lo pasa como `/admin` para volver a su propio login (no a la Home). */
export function LogoutButton({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  );
}
