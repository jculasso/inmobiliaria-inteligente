-- Módulo de publicación: la clave nueva en los tenants que ya existen, apagada.
--
-- El JSON de `modulos` no tiene default por clave: si no se backfillea, los
-- tenants viejos quedan sin `publicacion` y el schema de Zod —que la exige—
-- rechaza el tenant completo al leerlo. Ya pasó con `protocolo`.
UPDATE "tenant"
SET "modulos" = "modulos" || '{"publicacion": false}'::jsonb
WHERE NOT ("modulos" ? 'publicacion');

ALTER TABLE "tenant"
  ALTER COLUMN "modulos"
  SET DEFAULT '{"tablero": true, "tasador": false, "todo": false, "protocolo": false, "publicacion": false}';

-- Credenciales de integraciones (hoy Tokko), una por inmobiliaria y proveedor.
--
-- El secreto se guarda CIFRADO con una clave que vive en la variable de entorno
-- INTEGRACIONES_ENC_KEY, fuera de la base: quien consiga un backup no puede
-- usar las credenciales de nadie.
CREATE TABLE "integracion_credencial" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "proveedor"       TEXT NOT NULL,
  "secreto_enc"     TEXT NOT NULL,
  "ultimos4"        TEXT NOT NULL,
  "actualizado_por" UUID,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "integracion_credencial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integracion_credencial_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "integracion_credencial_tenant_id_proveedor_key"
  ON "integracion_credencial" ("tenant_id", "proveedor");
CREATE INDEX "integracion_credencial_tenant_id_idx"
  ON "integracion_credencial" ("tenant_id");

-- Aislamiento entre inmobiliarias (ver docs/CONVENCIONES_TECNICAS.md §1).
ALTER TABLE "integracion_credencial" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "integracion_credencial"
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Revocar antes de otorgar: Supabase le da TRUNCATE a anon/authenticated en
-- cada tabla nueva, y TRUNCATE ignora RLS.
REVOKE ALL ON "integracion_credencial" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "integracion_credencial" TO authenticated;
