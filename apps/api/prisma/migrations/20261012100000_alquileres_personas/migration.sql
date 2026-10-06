-- Módulo Alquileres — entrega 13 (personas completas).
--
-- Punto 14 de Javier: la ficha de la persona como «Clientes» de Gexion.
-- Columnas nuevas, todas opcionales, en `alq_persona`; y dos tablas nuevas
-- vacías: cuentas bancarias (a dónde se le transfiere al propietario) y
-- contactos adicionales.

-- AlterTable
ALTER TABLE "alq_persona" ADD COLUMN     "codigo_postal" TEXT,
ADD COLUMN     "condicion_iva" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "estado_civil" TEXT,
ADD COLUMN     "fecha_nacimiento" DATE,
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "nacionalidad" TEXT,
ADD COLUMN     "provincia" TEXT;

-- CreateTable
CREATE TABLE "alq_cuenta_bancaria" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "banco" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'caja_ahorro',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "numero" TEXT,
    "cbu" TEXT,
    "alias" TEXT,
    "titular" TEXT,
    "cuit_titular" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_cuenta_bancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_contacto" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "relacion" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_cuenta_bancaria_tenant_id_idx" ON "alq_cuenta_bancaria"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_cuenta_bancaria_persona_id_idx" ON "alq_cuenta_bancaria"("persona_id");

-- CreateIndex
CREATE INDEX "alq_contacto_tenant_id_idx" ON "alq_contacto"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_contacto_persona_id_idx" ON "alq_contacto"("persona_id");

-- AddForeignKey
ALTER TABLE "alq_cuenta_bancaria" ADD CONSTRAINT "alq_cuenta_bancaria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cuenta_bancaria" ADD CONSTRAINT "alq_cuenta_bancaria_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contacto" ADD CONSTRAINT "alq_contacto_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contacto" ADD CONSTRAINT "alq_contacto_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: cada inmobiliaria ve solo lo suyo.
REVOKE ALL ON "alq_cuenta_bancaria" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_cuenta_bancaria" TO authenticated;
ALTER TABLE "alq_cuenta_bancaria" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_cuenta_bancaria"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_contacto" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_contacto" TO authenticated;
ALTER TABLE "alq_contacto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_contacto"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
