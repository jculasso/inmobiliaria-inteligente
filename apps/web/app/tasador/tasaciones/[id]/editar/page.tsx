import { getTasacion } from '../../../../../lib/tasador-api';
import { requireServerPrincipal } from '../../../../../lib/server-principal';
import { TasacionWizard } from '../../../../../components/tasador/tasacion-wizard';

export default async function EditarTasacionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const { id } = await params;
  const tasacion = await getTasacion(ctx.accessToken, id);

  return <TasacionWizard tasacion={tasacion} />;
}
