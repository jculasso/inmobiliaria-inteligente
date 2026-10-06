-- Módulo Alquileres — entrega 14 (contrato completo).
--
-- Puntos 7, 11, 12 y 13 de Javier: cargos de ingreso, garantías, depósito y
-- extensión. Los cargos son conceptos (tipos nuevos, columna de texto: no
-- cambia el esquema). Acá: cómo se gestiona el depósito de cada contrato, y la
-- tabla de garantías, vacía.

-- AlterTable
ALTER TABLE "alq_contrato" ADD COLUMN     "deposito_gestion" TEXT NOT NULL DEFAULT 'entrega_propietario';

-- CreateTable
CREATE TABLE "alq_garantia" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "persona_id" UUID,
    "garante" TEXT,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "aprobada_el" DATE,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_garantia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_garantia_tenant_id_idx" ON "alq_garantia"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_garantia_contrato_id_idx" ON "alq_garantia"("contrato_id");

-- AddForeignKey
ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: cada inmobiliaria ve solo lo suyo.
REVOKE ALL ON "alq_garantia" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_garantia" TO authenticated;
ALTER TABLE "alq_garantia" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_garantia"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
