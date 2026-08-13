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

/**
 * La marca de la PLATAFORMA, para las pantallas donde todavía no se sabe de qué
 * inmobiliaria es quien está mirando.
 *
 * El caso concreto es la pantalla de ingreso. Sin sesión no hay tenant, así que
 * `tenantBrandStyle` devuelve `undefined` y todo cae al valor por defecto de
 * `--color-brand-red`, que es el rojo de Vacker: el botón «Ingresar», el filete
 * de la tarjeta y el rótulo salían rojos. A un cliente nuevo lo primero que le
 * mostrábamos era la marca de otra inmobiliaria.
 *
 * Pisa las mismas dos variables en lugar de cambiar cada clase: la pantalla de
 * ingreso tiene doce usos de `brand-red` repartidos en tres componentes, y
 * cualquiera que se agregue mañana quedaría rojo otra vez.
 */
export function marcaPlataformaStyle(): CSSProperties {
  return {
    '--color-brand-red': 'var(--color-plataforma)',
    '--color-brand-red-dark': 'var(--color-plataforma-dark)',
  } as CSSProperties;
}
