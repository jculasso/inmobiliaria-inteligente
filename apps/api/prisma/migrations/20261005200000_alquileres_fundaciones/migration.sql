-- Módulo Alquileres — fundaciones (entrega 1).
-- Ver docs/specs/alquileres-fase-1.md y alquileres-fase-1-plan.md.
--
-- Solo agrega: doce tablas nuevas y vacías, y la clave `alquileres` en los
-- módulos de cada inmobiliaria, APAGADA. Ninguna fila existente cambia de
-- significado, así que la API vieja sigue funcionando con este esquema.

-- Las inmobiliarias que ya existen reciben la clave apagada. Sin esto, el
-- schema de Zod —que exige todas las claves— rechazaría sus módulos.
UPDATE "tenant"
SET "modulos" = "modulos" || '{"alquileres": false}'::jsonb
WHERE NOT ("modulos" ? 'alquileres');

-- AlterTable
ALTER TABLE "tenant" ALTER COLUMN "modulos" SET DEFAULT '{"tablero": true, "tasador": false, "todo": false, "protocolo": false, "publicacion": false, "alquileres": false}';

-- CreateTable
CREATE TABLE "alq_persona" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'fisica',
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "domicilio" TEXT,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_propiedad" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direccion" TEXT NOT NULL,
    "unidad" TEXT,
    "ciudad" TEXT,
    "tipo" TEXT,
    "tokko_id" INTEGER,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_contrato" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'vivienda',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "inicio" DATE NOT NULL,
    "fin" DATE NOT NULL,
    "fecha_firma" DATE,
    "dia_vencimiento" INTEGER NOT NULL DEFAULT 10,
    "ajuste" TEXT NOT NULL DEFAULT 'indexado',
    "indice" TEXT,
    "periodicidad_meses" INTEGER,
    "honorarios_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gastos_adm_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "iva_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "punitorio_diario_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "pago_garantizado" BOOLEAN NOT NULL DEFAULT false,
    "deposito_importe" DECIMAL(14,2),
    "deposito_moneda" TEXT,
    "deposito_devolucion" DATE,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "rescindido_el" DATE,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_contrato_parte" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2),

    CONSTRAINT "alq_contrato_parte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_tramo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "importe" DECIMAL(14,2),
    "indice_base" DECIMAL(18,6),
    "indice_requerido" DECIMAL(18,6),
    "importe_propuesto" DECIMAL(14,2),
    "confirmado_el" TIMESTAMPTZ(6),
    "confirmado_por_id" UUID,

    CONSTRAINT "alq_tramo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_concepto" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID,
    "persona_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "sentido" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "periodo" TEXT,
    "vencimiento" DATE NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "adelantado_por_inmobiliaria" BOOLEAN NOT NULL DEFAULT false,
    "liquidacion_id" UUID,
    "origen_id" UUID,
    "descripcion" TEXT,
    "clave_generacion" TEXT,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_concepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_cobro" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "importe" DECIMAL(14,2) NOT NULL,
    "medio" TEXT NOT NULL,
    "obs" TEXT,
    "creado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_imputacion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cobro_id" UUID NOT NULL,
    "concepto_id" UUID NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "alq_imputacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_liquidacion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "neto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_por_id" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alq_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_documento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "archivo" TEXT,
    "estado_firma" TEXT NOT NULL DEFAULT 'sin_enviar',
    "proveedor" TEXT,
    "envio_externo_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_firmante" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "alq_firmante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alq_firma_evento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "detalle" JSONB,

    CONSTRAINT "alq_firma_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alq_persona_tenant_id_idx" ON "alq_persona"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_persona_tenant_id_documento_key" ON "alq_persona"("tenant_id", "documento");

-- CreateIndex
CREATE INDEX "alq_propiedad_tenant_id_idx" ON "alq_propiedad"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_contrato_tenant_id_idx" ON "alq_contrato"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_contrato_tenant_id_estado_idx" ON "alq_contrato"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "alq_contrato_tenant_id_codigo_key" ON "alq_contrato"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "alq_contrato_parte_tenant_id_idx" ON "alq_contrato_parte"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_contrato_parte_persona_id_idx" ON "alq_contrato_parte"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_contrato_parte_contrato_id_persona_id_papel_key" ON "alq_contrato_parte"("contrato_id", "persona_id", "papel");

-- CreateIndex
CREATE INDEX "alq_tramo_tenant_id_idx" ON "alq_tramo"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_tramo_contrato_id_numero_key" ON "alq_tramo"("contrato_id", "numero");

-- CreateIndex
CREATE INDEX "alq_concepto_tenant_id_idx" ON "alq_concepto"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_concepto_tenant_id_persona_id_idx" ON "alq_concepto"("tenant_id", "persona_id");

-- CreateIndex
CREATE INDEX "alq_concepto_tenant_id_periodo_idx" ON "alq_concepto"("tenant_id", "periodo");

-- CreateIndex
CREATE INDEX "alq_concepto_contrato_id_idx" ON "alq_concepto"("contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "alq_concepto_tenant_id_clave_generacion_key" ON "alq_concepto"("tenant_id", "clave_generacion");

-- CreateIndex
CREATE INDEX "alq_cobro_tenant_id_idx" ON "alq_cobro"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_cobro_tenant_id_persona_id_idx" ON "alq_cobro"("tenant_id", "persona_id");

-- CreateIndex
CREATE INDEX "alq_imputacion_tenant_id_idx" ON "alq_imputacion"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_imputacion_cobro_id_idx" ON "alq_imputacion"("cobro_id");

-- CreateIndex
CREATE INDEX "alq_imputacion_concepto_id_idx" ON "alq_imputacion"("concepto_id");

-- CreateIndex
CREATE INDEX "alq_liquidacion_tenant_id_idx" ON "alq_liquidacion"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_liquidacion_tenant_id_persona_id_idx" ON "alq_liquidacion"("tenant_id", "persona_id");

-- CreateIndex
CREATE INDEX "alq_documento_tenant_id_idx" ON "alq_documento"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_documento_contrato_id_idx" ON "alq_documento"("contrato_id");

-- CreateIndex
CREATE INDEX "alq_firmante_tenant_id_idx" ON "alq_firmante"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_firmante_documento_id_idx" ON "alq_firmante"("documento_id");

-- CreateIndex
CREATE INDEX "alq_firma_evento_tenant_id_idx" ON "alq_firma_evento"("tenant_id");

-- CreateIndex
CREATE INDEX "alq_firma_evento_documento_id_idx" ON "alq_firma_evento"("documento_id");

-- AddForeignKey
ALTER TABLE "alq_persona" ADD CONSTRAINT "alq_persona_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_propiedad" ADD CONSTRAINT "alq_propiedad_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contrato" ADD CONSTRAINT "alq_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contrato" ADD CONSTRAINT "alq_contrato_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "alq_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contrato_parte" ADD CONSTRAINT "alq_contrato_parte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contrato_parte" ADD CONSTRAINT "alq_contrato_parte_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_contrato_parte" ADD CONSTRAINT "alq_contrato_parte_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_tramo" ADD CONSTRAINT "alq_tramo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_tramo" ADD CONSTRAINT "alq_tramo_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "alq_liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cobro" ADD CONSTRAINT "alq_cobro_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_cobro" ADD CONSTRAINT "alq_cobro_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "alq_cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "alq_concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_liquidacion" ADD CONSTRAINT "alq_liquidacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_liquidacion" ADD CONSTRAINT "alq_liquidacion_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_documento" ADD CONSTRAINT "alq_documento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_documento" ADD CONSTRAINT "alq_documento_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_firmante" ADD CONSTRAINT "alq_firmante_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_firmante" ADD CONSTRAINT "alq_firmante_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "alq_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_firmante" ADD CONSTRAINT "alq_firmante_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_firma_evento" ADD CONSTRAINT "alq_firma_evento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alq_firma_evento" ADD CONSTRAINT "alq_firma_evento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "alq_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Row-Level Security: aislamiento por tenant, el mismo patrón de todas las
-- tablas de negocio. Ver docs/CONVENCIONES_TECNICAS.md §17.
-- ============================================================================

REVOKE ALL ON "alq_persona" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_persona" TO authenticated;
ALTER TABLE "alq_persona" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_persona"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_propiedad" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_propiedad" TO authenticated;
ALTER TABLE "alq_propiedad" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_propiedad"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_contrato" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_contrato" TO authenticated;
ALTER TABLE "alq_contrato" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_contrato"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_contrato_parte" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_contrato_parte" TO authenticated;
ALTER TABLE "alq_contrato_parte" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_contrato_parte"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_tramo" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_tramo" TO authenticated;
ALTER TABLE "alq_tramo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_tramo"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_concepto" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_concepto" TO authenticated;
ALTER TABLE "alq_concepto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_concepto"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_cobro" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_cobro" TO authenticated;
ALTER TABLE "alq_cobro" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_cobro"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_imputacion" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_imputacion" TO authenticated;
ALTER TABLE "alq_imputacion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_imputacion"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_liquidacion" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_liquidacion" TO authenticated;
ALTER TABLE "alq_liquidacion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_liquidacion"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_documento" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_documento" TO authenticated;
ALTER TABLE "alq_documento" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_documento"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_firmante" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_firmante" TO authenticated;
ALTER TABLE "alq_firmante" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_firmante"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_firma_evento" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_firma_evento" TO authenticated;
ALTER TABLE "alq_firma_evento" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_firma_evento"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
