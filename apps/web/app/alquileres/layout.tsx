import type { ReactNode } from 'react';
import { puedeAdministrarAlquileres } from '@vacker/types';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';
import { AlquileresNav } from '../../components/alquileres/alquileres-nav';

export default async function AlquileresLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('alquileres', 'Alquileres');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;

  // Contratado no alcanza: el módulo lo opera quien administra los contratos
  // (spec alquileres-fase-1.md §3). Se resuelve acá, una vez, para todas las
  // páginas del módulo. La API responde 403 igual; esto explica por qué.
  if (!puedeAdministrarAlquileres(principal.roles)) {
    return (
      <MarcoModulo principal={principal} titulo="Alquileres">
        <div className="rounded-brand border border-line bg-white p-6">
          <h2 className="text-base font-bold text-ink">No tenés acceso a Alquileres</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Este módulo lo usan la dirección y quien tiene el rol <strong>Administración</strong>.
            Si te corresponde, pedile a la administración de tu inmobiliaria que te lo asigne.
          </p>
        </div>
      </MarcoModulo>
    );
  }

  return (
    <MarcoModulo principal={principal} titulo="Alquileres" nav={<AlquileresNav />} contenido="mt-5">
      {children}
    </MarcoModulo>
  );
}
