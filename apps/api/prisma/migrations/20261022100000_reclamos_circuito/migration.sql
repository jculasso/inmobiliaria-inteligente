-- Reclamos: tres estados y el gasto del arreglo enlazado (Javier, 7/10/2026:
-- «como está no sirve»). Reglas 67 a 73 de docs/specs/alquileres-fase-1.md.
--
-- 1. «Cerrado» se va: no se distinguía de «Resuelto». Los reclamos cerrados
--    pasan a resueltos y conservan `cerrado_en` (la fecha en que se dieron
--    por terminados). `estado` es TEXT sin CHECK ni enum en la base: no hay
--    restricción que actualizar. A propósito no se agrega una: entre el
--    deploy de la API y esta migración (se aplica a mano) una API vieja
--    podría escribir «cerrado», y un CHECK convertiría eso en un error 500.
--    La API nueva lee «cerrado» como «resuelto» (`EstadoReclamoEntradaSchema`),
--    así que una fila que se escape de este UPDATE no rompe nada.
--
--    Toca solo filas de Alquileres en estado 'cerrado', de TODAS las
--    inmobiliarias (es un cambio de vocabulario, no de datos de un cliente).
--    No cambia `updated_at`: Prisma lo mueve desde la aplicación, no la base.

UPDATE "alq_reclamo"
   SET "estado" = 'resuelto',
       "cerrado_en" = COALESCE("cerrado_en", "updated_at")
 WHERE "estado" = 'cerrado';

-- 2. El comprobante de proveedor sabe de qué reclamo salió. Opcional: los
--    comprobantes que ya existen quedan sin reclamo. Una columna nueva en una
--    tabla que ya existe: `alq_comprobante` conserva su `tenant_id`, su
--    policy `tenant_isolation` y sus permisos (los de
--    20261015100000_alquileres_proveedores). Nada de eso se toca acá.

ALTER TABLE "alq_comprobante" ADD COLUMN "reclamo_id" UUID;

CREATE INDEX "alq_comprobante_reclamo_id_idx" ON "alq_comprobante" ("reclamo_id");

ALTER TABLE "alq_comprobante" ADD CONSTRAINT "alq_comprobante_reclamo_id_fkey" FOREIGN KEY ("reclamo_id") REFERENCES "alq_reclamo" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Con la inmobiliaria adelante, como el resto de las relaciones
-- (20261017110000_claves_foraneas_por_inmobiliaria): Postgres controla las
-- claves foráneas sin RLS, y la simple aceptaría el reclamo de OTRA
-- inmobiliaria. Se crea después de la simple, así que al borrar un reclamo
-- se controla después de que aquella dejó el comprobante en NULL.
-- `alq_reclamo` ya tiene (tenant_id, id) único (alq_reclamo_tenant_id_id_key).
ALTER TABLE "alq_comprobante" ADD CONSTRAINT "alq_comprobante_reclamo_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "reclamo_id") REFERENCES "alq_reclamo" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_comprobante" VALIDATE CONSTRAINT "alq_comprobante_reclamo_id_mismo_tenant_fkey";
