import { getTasacion } from '../../../../../lib/tasador-api';
import { requireServerPrincipal } from '../../../../../lib/server-principal';
import { TasacionWizard } from '../../../../../components/tasador/tasacion-wizard';

export default async function EditarTasacionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const { id } = await params;
  const tasacion = await getTasacion(ctx.accessToken, id);

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
