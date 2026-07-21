import { requireServerPrincipal } from '../../../../lib/server-principal';
import { TasacionWizard } from '../../../../components/tasador/tasacion-wizard';

export default async function NuevaTasacionPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  return <TasacionWizard />;
}
