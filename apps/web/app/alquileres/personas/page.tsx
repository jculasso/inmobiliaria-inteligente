import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listPersonas } from '../../../lib/alquileres-api';
import { PersonasLista } from '../../../components/alquileres/personas-lista';

export const metadata = { title: 'Personas · Alquileres' };

/** Propietarios, inquilinos y garantes. El acceso por rol lo resuelve el layout. */
export default async function PersonasPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso». Esto evita además pedirle datos a
  // la API, que respondería 403: Next renderiza layout y página en paralelo.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  return <PersonasLista personas={await listPersonas(ctx.accessToken)} />;
}
