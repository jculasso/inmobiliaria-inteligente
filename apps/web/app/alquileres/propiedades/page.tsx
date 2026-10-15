import { puedeAdministrarAlquileres } from '@vacker/types';
import { requireServerPrincipal } from '../../../lib/server-principal';
import { listPropiedadesAlquiler } from '../../../lib/alquileres-api';
import { listReservas } from '../../../lib/reservas-api';
import { PropiedadesLista } from '../../../components/alquileres/propiedades-lista';

export const metadata = { title: 'Propiedades · Alquileres' };

/** Las unidades que se alquilan. El acceso por rol lo resuelve el layout. */
export default async function PropiedadesPage() {
  const ctx = await requireServerPrincipal();
  // El layout ya muestra «no tenés acceso». Esto evita además pedirle datos a
  // la API, que respondería 403: Next renderiza layout y página en paralelo.
  if (!ctx || !puedeAdministrarAlquileres(ctx.principal.roles)) return null;
  // Regla 165: las reservas abiertas, para marcar las propiedades reservadas.
  const [propiedades, reservas] = await Promise.all([
    listPropiedadesAlquiler(ctx.accessToken),
    listReservas(ctx.accessToken, 'abiertas'),
  ]);
  return <PropiedadesLista propiedades={propiedades} reservas={reservas} />;
}
