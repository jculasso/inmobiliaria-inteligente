-- AlterTable
ALTER TABLE "tasacion" ADD COLUMN "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tasacion_tenant_id_codigo_key" ON "tasacion"("tenant_id", "codigo");
