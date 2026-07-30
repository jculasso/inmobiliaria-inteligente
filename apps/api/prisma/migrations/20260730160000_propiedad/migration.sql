-- Espejo de las propiedades publicadas en Tokko.
--
-- Se traen LEYENDO la API, que es lo único seguro: el importador de Tokko trata
-- el archivo como el inventario completo y da de baja lo que no viaja en él.
--
-- No se guarda la dirección real del propietario: Tokko la separa de la
-- publicada y para mostrar el catálogo alcanza con la segunda.
CREATE TABLE "propiedad" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID NOT NULL,
  "tokko_id"            INTEGER NOT NULL,
  "reference_code"      TEXT,
  "titulo"              TEXT,
  "tipo"                TEXT,
  "operacion"           TEXT,
  "precio"              DECIMAL(14,2),
  "moneda"              TEXT,
  "direccion"           TEXT,
  "ubicacion"           TEXT,
  "fotos"               INTEGER NOT NULL DEFAULT 0,
  "foto_portada"        TEXT,
  "public_url"          TEXT,
  "estado"              TEXT,
  "agente_id"           UUID,
  "agente_email_tokko"  TEXT,
  "agente_nombre_tokko" TEXT,
  "creado_en_tokko"     TIMESTAMPTZ(6),
  "importado_el"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "propiedad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "propiedad_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "propiedad_agente_id_fkey" FOREIGN KEY ("agente_id")
    REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "propiedad_tenant_id_tokko_id_key" ON "propiedad" ("tenant_id", "tokko_id");
CREATE INDEX "propiedad_tenant_id_idx" ON "propiedad" ("tenant_id");
CREATE INDEX "propiedad_agente_id_idx" ON "propiedad" ("agente_id");

-- Aislamiento entre inmobiliarias (docs/CONVENCIONES_TECNICAS.md §1).
ALTER TABLE "propiedad" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "propiedad"
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "propiedad" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "propiedad" TO authenticated;
