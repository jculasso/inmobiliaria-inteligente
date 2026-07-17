'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email o clave incorrectos.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
            Inmobiliaria Inteligente
          </p>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Accedé con tu cuenta de Vacker.</CardDescription>
        </CardHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Clave
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="mt-2">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
