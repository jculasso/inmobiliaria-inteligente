-- CreateTable
CREATE TABLE "tasacion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agente_id" UUID NOT NULL,
    "cliente" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "direccion" TEXT NOT NULL,
    "barrio" TEXT,
    "ciudad" TEXT,
    "tipo_operacion" TEXT NOT NULL,
    "tipo_propiedad" TEXT NOT NULL,
    "sup_cubierta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sup_semicubierta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sup_descubierta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sup_terreno" DECIMAL(10,2),
    "superficie_total" DECIMAL(10,2) NOT NULL,
    "dormitorios" INTEGER,
    "banos" INTEGER,
    "toilette" INTEGER,
    "ambientes" INTEGER,
    "antiguedad" INTEGER,
    "estado_inmueble" TEXT,
    "disposicion" TEXT,
    "orientacion" TEXT,
    "cochera" BOOLEAN NOT NULL DEFAULT false,
    "balcon" BOOLEAN NOT NULL DEFAULT false,
    "terraza" BOOLEAN NOT NULL DEFAULT false,
    "patio" BOOLEAN NOT NULL DEFAULT false,
    "lavadero" BOOLEAN NOT NULL DEFAULT false,
    "piscina" BOOLEAN NOT NULL DEFAULT false,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detalle_amenities" TEXT,
    "expensas" DECIMAL(10,2),
    "apto_credito" TEXT,
    "documentacion" TEXT,
    "analisis_comercial" JSONB,
    "valor_minimo" DECIMAL(14,2),
    "valor_recomendado" DECIMAL(14,2),
    "valor_aspiracional" DECIMAL(14,2),
    "margen_negociacion" TEXT,
    "escenario_recomendado" TEXT,
    "plazo_estimado" TEXT,
    "estrategia_comercial" JSONB,
    "estado" TEXT NOT NULL DEFAULT 'En proceso',
    "exclusividad" JSONB,
    "motivo_no_captada" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasacion_comparable" (
    "id" UUID NOT NULL,
    "tasacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direccion" TEXT NOT NULL,
    "superficie" DECIMAL(10,2) NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "dormitorios" INTEGER,
    "banos" INTEGER,
    "cochera" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT,
    "link" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "tasacion_comparable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasacion_foto" (
    "id" UUID NOT NULL,
    "tasacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tasacion_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasacion_estado_historial" (
    "id" UUID NOT NULL,
    "tasacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "detalle" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasacion_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe_generado" (
    "id" UUID NOT NULL,
    "tasacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informe_generado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasacion_tenant_id_idx" ON "tasacion"("tenant_id");

-- CreateIndex
CREATE INDEX "tasacion_tenant_id_agente_id_idx" ON "tasacion"("tenant_id", "agente_id");

-- CreateIndex
CREATE INDEX "tasacion_tenant_id_estado_idx" ON "tasacion"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "tasacion_comparable_tenant_id_idx" ON "tasacion_comparable"("tenant_id");

-- CreateIndex
CREATE INDEX "tasacion_comparable_tasacion_id_idx" ON "tasacion_comparable"("tasacion_id");

-- CreateIndex
CREATE INDEX "tasacion_foto_tenant_id_idx" ON "tasacion_foto"("tenant_id");

-- CreateIndex
CREATE INDEX "tasacion_foto_tasacion_id_idx" ON "tasacion_foto"("tasacion_id");

-- CreateIndex
CREATE INDEX "tasacion_estado_historial_tenant_id_idx" ON "tasacion_estado_historial"("tenant_id");

-- CreateIndex
CREATE INDEX "tasacion_estado_historial_tasacion_id_idx" ON "tasacion_estado_historial"("tasacion_id");

-- CreateIndex
CREATE INDEX "informe_generado_tenant_id_idx" ON "informe_generado"("tenant_id");

-- CreateIndex
CREATE INDEX "informe_generado_tasacion_id_idx" ON "informe_generado"("tasacion_id");

-- AddForeignKey
ALTER TABLE "tasacion" ADD CONSTRAINT "tasacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion" ADD CONSTRAINT "tasacion_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_comparable" ADD CONSTRAINT "tasacion_comparable_tasacion_id_fkey" FOREIGN KEY ("tasacion_id") REFERENCES "tasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_comparable" ADD CONSTRAINT "tasacion_comparable_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_foto" ADD CONSTRAINT "tasacion_foto_tasacion_id_fkey" FOREIGN KEY ("tasacion_id") REFERENCES "tasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_foto" ADD CONSTRAINT "tasacion_foto_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_estado_historial" ADD CONSTRAINT "tasacion_estado_historial_tasacion_id_fkey" FOREIGN KEY ("tasacion_id") REFERENCES "tasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_estado_historial" ADD CONSTRAINT "tasacion_estado_historial_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasacion_estado_historial" ADD CONSTRAINT "tasacion_estado_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_generado" ADD CONSTRAINT "informe_generado_tasacion_id_fkey" FOREIGN KEY ("tasacion_id") REFERENCES "tasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_generado" ADD CONSTRAINT "informe_generado_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security del módulo Tasador — mismo patrón que Tablero
-- (ver 20260716220600_lockdown_grants y 20260716223817_tablero).
--
-- 1) Least-privilege: se revoca todo a anon/authenticated y se otorga solo lo
--    necesario al rol de runtime `authenticated` (Supabase concede de más por
--    default en tablas nuevas, incluido TRUNCATE, que IGNORA RLS).
-- 2) RLS + policy tenant_isolation por tenant_id, tomado de `app.tenant_id`
--    (GUC seteado por request). Sin contexto, la comparación da NULL => deny
--    por defecto. service_role/postgres (BYPASSRLS) no se ven afectados.
-- =============================================================================

REVOKE ALL ON "tasacion" FROM anon, authenticated;
REVOKE ALL ON "tasacion_comparable" FROM anon, authenticated;
REVOKE ALL ON "tasacion_foto" FROM anon, authenticated;
REVOKE ALL ON "tasacion_estado_historial" FROM anon, authenticated;
REVOKE ALL ON "informe_generado" FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON "tasacion" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tasacion_comparable" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tasacion_foto" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tasacion_estado_historial" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "informe_generado" TO authenticated;

ALTER TABLE "tasacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasacion_comparable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasacion_foto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasacion_estado_historial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "informe_generado" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "tasacion"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "tasacion_comparable"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "tasacion_foto"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "tasacion_estado_historial"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "informe_generado"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
