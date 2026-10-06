-- Módulo Alquileres — entrega 19 (impuestos, servicios y pólizas).
--
-- Cuatro tablas nuevas, vacías: el catálogo, las cuentas de cada propiedad,
-- las boletas (de servicios y cuotas de pólizas) y las pólizas. Lo que se le
-- carga a una parte son conceptos, como el resto.

-- CreateTable
CREATE TABLE "alq_servicio" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "clase" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_cuenta_servicio" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "numero_cuenta" TEXT,
    "a_cargo_de" TEXT NOT NULL DEFAULT 'inquilino',
    "paga" TEXT NOT NULL DEFAULT 'inquilino',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_cuenta_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_boleta" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cuenta_id" UUID,
    "poliza_id" UUID,
    "contrato_id" UUID,
    "clave" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "cuota" TEXT,
    "vencimiento" DATE NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "a_cargo_de" TEXT NOT NULL,
    "paga" TEXT NOT NULL,
    "pagada_el" DATE,
    "medio" TEXT,
    "creado_por_id" UUID,
    "pagada_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_boleta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_poliza" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "aseguradora" TEXT NOT NULL,
    "numero" TEXT,
    "cobertura" TEXT NOT NULL DEFAULT 'incendio',
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "suma_asegurada" DECIMAL(14,2),
    "premio" DECIMAL(14,2) NOT NULL,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "a_cargo_de" TEXT NOT NULL DEFAULT 'inquilino',
    "paga" TEXT NOT NULL DEFAULT 'inmobiliaria',
    "creado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_poliza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_servicio_tenant_id_idx" ON "alq_servicio"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_servicio_tenant_id_nombre_key" ON "alq_servicio"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "alq_cuenta_servicio_tenant_id_idx" ON "alq_cuenta_servicio"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_cuenta_servicio_propiedad_id_idx" ON "alq_cuenta_servicio"("propiedad_id");

-- CreateIndex
CREATE INDEX "alq_cuenta_servicio_servicio_id_idx" ON "alq_cuenta_servicio"("servicio_id");

-- CreateIndex
CREATE INDEX "alq_boleta_tenant_id_periodo_idx" ON "alq_boleta"("tenant_id", "periodo");

-- CreateIndex
CREATE INDEX "alq_boleta_tenant_id_vencimiento_idx" ON "alq_boleta"("tenant_id", "vencimiento");

-- CreateIndex
CREATE INDEX "alq_boleta_cuenta_id_idx" ON "alq_boleta"("cuenta_id");

-- CreateIndex
CREATE INDEX "alq_boleta_poliza_id_idx" ON "alq_boleta"("poliza_id");

-- CreateIndex
CREATE INDEX "alq_boleta_contrato_id_idx" ON "alq_boleta"("contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_boleta_tenant_id_clave_key" ON "alq_boleta"("tenant_id", "clave");

-- CreateIndex
CREATE INDEX "alq_poliza_tenant_id_idx" ON "alq_poliza"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_poliza_contrato_id_idx" ON "alq_poliza"("contrato_id");

-- CreateIndex
CREATE INDEX "alq_poliza_tenant_id_hasta_idx" ON "alq_poliza"("tenant_id", "hasta");

-- AddForeignKey
ALTER TABLE "alq_servicio" ADD CONSTRAINT "alq_servicio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cuenta_servicio" ADD CONSTRAINT "alq_cuenta_servicio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cuenta_servicio" ADD CONSTRAINT "alq_cuenta_servicio_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "alq_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cuenta_servicio" ADD CONSTRAINT "alq_cuenta_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "alq_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_boleta" ADD CONSTRAINT "alq_boleta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_boleta" ADD CONSTRAINT "alq_boleta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "alq_cuenta_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_boleta" ADD CONSTRAINT "alq_boleta_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "alq_poliza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_poliza" ADD CONSTRAINT "alq_poliza_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_poliza" ADD CONSTRAINT "alq_poliza_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: cada inmobiliaria ve solo lo suyo.
REVOKE ALL ON "alq_servicio" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_servicio" TO authenticated;
ALTER TABLE "alq_servicio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_servicio"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_cuenta_servicio" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_cuenta_servicio" TO authenticated;
ALTER TABLE "alq_cuenta_servicio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_cuenta_servicio"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_boleta" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_boleta" TO authenticated;
ALTER TABLE "alq_boleta" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_boleta"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_poliza" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_poliza" TO authenticated;
ALTER TABLE "alq_poliza" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_poliza"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

