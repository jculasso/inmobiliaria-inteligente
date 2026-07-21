import type { CSSProperties } from 'react';
import type { TenantConfig } from '@vacker/types';

/**
 * Override de marca por tenant (colorPrimario/colorPrimarioOscuro) como
 * variables CSS, para aplicar en el `<main>` de cada layout — Home, Tablero
 * y Tasador cada uno arma su propio árbol, así que el override no se hereda
 * entre ellos y hay que aplicarlo en cada uno.
 */
export function tenantBrandStyle(config: TenantConfig | undefined): CSSProperties | undefined {
  if (!config?.colorPrimario) return undefined;
  return {
    '--color-brand-red': config.colorPrimario,
    '--color-brand-red-dark': config.colorPrimarioOscuro || config.colorPrimario,
  } as CSSProperties;
}
