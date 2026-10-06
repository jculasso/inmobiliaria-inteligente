-- Módulo Alquileres — entrega 15 (contrato desde plantilla y reclamos).
--
-- Tres tablas nuevas, vacías: las plantillas de contrato de cada
-- inmobiliaria, los reclamos y su historial de notas.

-- CreateTable
CREATE TABLE "alq_plantilla" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_contrato" TEXT,
    "cuerpo" TEXT NOT NULL,
    "creado_por_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_reclamo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "asunto" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'mantenimiento',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "contrato_id" UUID,
    "persona_id" UUID,
    "asignado_a_id" UUID,
    "creado_por_id" UUID,
    "cerrado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_reclamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_reclamo_nota" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reclamo_id" UUID NOT NULL,
    "usuario_id" UUID,
    "usuario_nombre" TEXT,
    "texto" TEXT NOT NULL,
    "en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_reclamo_nota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_plantilla_tenant_id_idx" ON "alq_plantilla"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_reclamo_tenant_id_idx" ON "alq_reclamo"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_reclamo_tenant_id_estado_idx" ON "alq_reclamo"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "alq_reclamo_contrato_id_idx" ON "alq_reclamo"("contrato_id");

-- CreateIndex
CREATE INDEX "alq_reclamo_persona_id_idx" ON "alq_reclamo"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_reclamo_tenant_id_numero_key" ON "alq_reclamo"("tenant_id", "numero");

-- CreateIndex
CREATE INDEX "alq_reclamo_nota_tenant_id_idx" ON "alq_reclamo_nota"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_reclamo_nota_reclamo_id_idx" ON "alq_reclamo_nota"("reclamo_id");

-- AddForeignKey
ALTER TABLE "alq_plantilla" ADD CONSTRAINT "alq_plantilla_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_reclamo" ADD CONSTRAINT "alq_reclamo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_reclamo_nota" ADD CONSTRAINT "alq_reclamo_nota_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_reclamo_nota" ADD CONSTRAINT "alq_reclamo_nota_reclamo_id_fkey" FOREIGN KEY ("reclamo_id") REFERENCES "alq_reclamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: cada inmobiliaria ve solo lo suyo.
REVOKE ALL ON "alq_plantilla" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_plantilla" TO authenticated;
ALTER TABLE "alq_plantilla" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_plantilla"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_reclamo" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_reclamo" TO authenticated;
ALTER TABLE "alq_reclamo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_reclamo"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_reclamo_nota" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_reclamo_nota" TO authenticated;
ALTER TABLE "alq_reclamo_nota" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_reclamo_nota"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

