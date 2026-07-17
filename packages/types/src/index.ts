// @vacker/types — schemas y tipos Zod compartidos back/front.
//
// Placeholder de Fundaciones (Paso 1). Los schemas de negocio del núcleo
// (tenant, usuario, roles) y del Tablero se agregan en los Pasos 2 y 3.
//
// Convención: cada schema Zod exporta también su tipo inferido, p. ej.
//   export const FooSchema = z.object({ ... });
//   export type Foo = z.infer<typeof FooSchema>;

// Roles del sistema (RBAC sensible al tenant). En archivo propio para que
// tablero.ts y auth.ts puedan importarlo sin depender circularmente de este index.
export * from './rol';

// Contratos del módulo Tablero Comercial (Paso 3).
export * from './tablero';

// Contrato de auth compartido (respuesta de GET /me, Paso 4).
export * from './auth';
