import type { ReactNode } from 'react';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';
import { TasadorNav } from '../../components/tasador/tasador-nav';

export default async function TasadorLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('tasador', 'Tasador');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;
  return (
    <MarcoModulo principal={principal} titulo="Tasador de Propiedades" nav={<TasadorNav />}>
      {children}
    </MarcoModulo>
  );
}
