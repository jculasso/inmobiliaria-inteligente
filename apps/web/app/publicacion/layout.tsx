import type { ReactNode } from 'react';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';

export default async function PublicacionLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('publicacion', 'Publicación');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;
  return (
    <MarcoModulo principal={principal} titulo="Publicación">
      {children}
    </MarcoModulo>
  );
}
