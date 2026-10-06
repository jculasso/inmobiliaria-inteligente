import type { ReactNode } from 'react';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';
import { ProtocoloNav } from '../../components/protocolo/protocolo-nav';
import { puedeVerReporteProtocolo } from '../../lib/rbac';

export default async function ProtocoloLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('protocolo', 'Protocolo 5 Semanas');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;
  return (
    <MarcoModulo
      principal={principal}
      titulo="Protocolo 5 Semanas"
      nav={<ProtocoloNav mostrarReporte={puedeVerReporteProtocolo(principal.roles)} />}
    >
      {children}
    </MarcoModulo>
  );
}
