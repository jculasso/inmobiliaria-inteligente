import type { ReactNode } from 'react';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';
import { TableroNav } from '../../components/tablero/tablero-nav';

export default async function TableroLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('tablero', 'Tablero Comercial');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;
  return (
    <MarcoModulo
      principal={principal}
      titulo="Tablero Comercial"
      nav={<TableroNav roles={principal.roles} />}
    >
      {children}
    </MarcoModulo>
  );
}
