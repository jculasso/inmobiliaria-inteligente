import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../lib/server-principal';
import { getResumenAlquileres } from '../../lib/alquileres-api';
import { ComoEmpezar } from '../../components/alquileres/como-empezar';
import { ResumenCartera } from '../../components/alquileres/resumen-cartera';

export const metadata = { title: 'Alquileres' };

export default async function AlquileresPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  // El módulo puede estar contratado y aun así no ser para todos: lo opera
  // quien administra los contratos (spec alquileres-fase-1.md §3). La API
  // responde 403 igual; esto explica por qué en vez de mostrar un error.
  if (!puedeAdministrarAlquileres(ctx.principal.roles)) {
    return (
      <div className="rounded-brand border border-line bg-white p-6">
        <h2 className="text-base font-bold text-ink">No tenés acceso a Alquileres</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Este módulo lo usan la dirección y quien tiene el rol <strong>Administración</strong>. Si te
          corresponde, pedile a la administración de tu inmobiliaria que te lo asigne.
        </p>
      </div>
    );
  }

  const resumen = await getResumenAlquileres(ctx.accessToken);

  // Regla 32: una inmobiliaria que recién prende el módulo no ve tarjetas en
  // cero, que se leen como un error. Ve cómo empezar.
  return resumen.contratos === 0 ? <ComoEmpezar resumen={resumen} /> : <ResumenCartera resumen={resumen} />;
}
