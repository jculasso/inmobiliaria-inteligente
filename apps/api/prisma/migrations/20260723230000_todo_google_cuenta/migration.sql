-- CreateTable
CREATE TABLE "google_cuenta" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "google_email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "google_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_cuenta_usuario_id_key" ON "google_cuenta"("usuario_id");

-- CreateIndex
CREATE INDEX "google_cuenta_tenant_id_idx" ON "google_cuenta"("tenant_id");

-- AddForeignKey
ALTER TABLE "google_cuenta" ADD CONSTRAINT "google_cuenta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_cuenta" ADD CONSTRAINT "google_cuenta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security: aislamiento por tenant (mismo patrón que el resto de las
-- tablas de negocio, ver 20260716223817_tablero). El scope por usuario (cada
-- uno ve solo su propia cuenta) lo aplica la query del servicio con usuario_id.
-- ============================================================================
REVOKE ALL ON "google_cuenta" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "google_cuenta" TO authenticated;
ALTER TABLE "google_cuenta" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "google_cuenta"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
