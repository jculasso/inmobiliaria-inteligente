-- Módulo Alquileres — entrega 18 (proveedores).
--
-- Dos tablas nuevas, vacías: los proveedores y sus comprobantes. Lo que se le
-- carga al propietario o al inquilino son conceptos, como el resto.

-- CreateTable
CREATE TABLE "alq_proveedor" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "alias" TEXT,
    "cbu" TEXT,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_comprobante" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "contrato_id" UUID,
    "fecha" DATE NOT NULL,
    "tipo_comprobante" TEXT NOT NULL DEFAULT 'factura_c',
    "numero" TEXT,
    "descripcion" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "a_cargo_de" TEXT NOT NULL DEFAULT 'propietario',
    "pagado_el" DATE,
    "medio" TEXT,
    "creado_por_id" UUID,
    "pagado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_proveedor_tenant_id_idx" ON "alq_proveedor"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_comprobante_tenant_id_idx" ON "alq_comprobante"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_comprobante_proveedor_id_idx" ON "alq_comprobante"("proveedor_id");

-- CreateIndex
CREATE INDEX "alq_comprobante_contrato_id_idx" ON "alq_comprobante"("contrato_id");

-- CreateIndex
CREATE INDEX "alq_comprobante_tenant_id_fecha_idx" ON "alq_comprobante"("tenant_id", "fecha");

-- AddForeignKey
ALTER TABLE "alq_proveedor" ADD CONSTRAINT "alq_proveedor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_comprobante" ADD CONSTRAINT "alq_comprobante_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_comprobante" ADD CONSTRAINT "alq_comprobante_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "alq_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: cada inmobiliaria ve solo lo suyo.
REVOKE ALL ON "alq_proveedor" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_proveedor" TO authenticated;
ALTER TABLE "alq_proveedor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_proveedor"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_comprobante" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_comprobante" TO authenticated;
ALTER TABLE "alq_comprobante" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_comprobante"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

