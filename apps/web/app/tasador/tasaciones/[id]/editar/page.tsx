import { getTasacion } from '../../../../../lib/tasador-api';
import { sesionServidor } from '../../../../../lib/server-principal';
import { TasacionWizard } from '../../../../../components/tasador/tasacion-wizard';

export default async function EditarTasacionPage({ params }: { params: Promise<{ id: string }> }) {
  // La tasación no depende del rol (la API ya filtra el alcance): se pide en
  // paralelo con el perfil.
  const s = await sesionServidor();
  if (!s) return null;

  const { id } = await params;
  const [principal, tasacion] = await Promise.all([s.principal, getTasacion(s.accessToken, id)]);
  if (!principal) return null;

  // Editar NO reabre el criterio: se usa el que la tasación tiene congelado,
  // para que corregirle una coma al nombre del cliente no le cambie el total a
  // un informe ya entregado.
  return (
    <TasacionWizard
      tasacion={tasacion}
      coeficientes={{
        semicubierta: tasacion.coefSemicubierta,
        descubierta: tasacion.coefDescubierta,
      }}
    />
  );
}
