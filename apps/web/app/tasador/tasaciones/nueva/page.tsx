import { requireServerPrincipal } from '../../../../lib/server-principal';
import { TasacionWizard } from '../../../../components/tasador/tasacion-wizard';

export default async function NuevaTasacionPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  // Una tasación nueva nace con el criterio que tiene HOY la inmobiliaria.
  const { coefSemicubierta, coefDescubierta } = ctx.principal.tenant.config;
  return (
    <TasacionWizard
      coeficientes={{ semicubierta: coefSemicubierta, descubierta: coefDescubierta }}
    />
  );
}
