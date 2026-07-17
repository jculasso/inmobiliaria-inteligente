'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vacker/ui';
import { createClient } from '../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  );
}
