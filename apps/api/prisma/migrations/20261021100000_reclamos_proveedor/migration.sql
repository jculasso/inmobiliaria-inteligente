-- Reclamos: quién lo sigue y quién lo arregla (pedido de Javier, 7/10/2026).
--
-- «Lo sigue» sigue siendo `asignado_a_id`; lo que cambia es a quién se puede
-- asignar, y eso lo valida la API (un permiso, no una columna). Acá solo se
-- agrega el proveedor que lo arregla, elegido de la lista de Proveedores.
--
-- Solo una columna nueva en una tabla que ya existe: `alq_reclamo` conserva su
-- `tenant_id`, su policy `tenant_isolation` y sus permisos (los de
-- 20261014100000_alquileres_plantillas_reclamos). Nada de eso se toca acá.
--
-- Opcional: los reclamos que ya existen quedan «Sin proveedor». Borrar un
-- proveedor deja sus reclamos sin proveedor; el historial de cada uno conserva
-- la nota «Proveedor: X.» con el nombre.

ALTER TABLE "alq_reclamo" ADD COLUMN "proveedor_id" UUID;

CREATE INDEX "alq_reclamo_proveedor_id_idx" ON "alq_reclamo" ("proveedor_id");

ALTER TABLE "alq_reclamo" ADD CONSTRAINT "alq_reclamo_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "alq_proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Con la inmobiliaria adelante, como el resto de las relaciones
-- (20261017110000_claves_foraneas_por_inmobiliaria): Postgres controla las
-- claves foráneas sin RLS, y la simple aceptaría el proveedor de OTRA
-- inmobiliaria. Se crea después de la simple, así que al borrar un proveedor
-- se controla después de que aquella dejó el reclamo en NULL.
ALTER TABLE "alq_reclamo" ADD CONSTRAINT "alq_reclamo_proveedor_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "proveedor_id") REFERENCES "alq_proveedor" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_reclamo" VALIDATE CONSTRAINT "alq_reclamo_proveedor_id_mismo_tenant_fkey";
