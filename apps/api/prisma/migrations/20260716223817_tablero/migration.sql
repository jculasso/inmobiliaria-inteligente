-- CreateTable
CREATE TABLE "operacion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "precio" DECIMAL(14,2),
    "valor_mensual" DECIMAL(14,2),
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "cant_puntas" INTEGER NOT NULL,
    "com_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL,
    "fecha_reserva" DATE,
    "fecha_firma" DATE,
    "mes" INTEGER,
    "anio" INTEGER,
    "obs" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacion_punta" (
    "id" UUID NOT NULL,
    "operacion_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lado" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "comision" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "operacion_punta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "obj_comision" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "obj_volumen" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "obj_puntas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operacion_tenant_id_idx" ON "operacion"("tenant_id");

-- CreateIndex
CREATE INDEX "operacion_tenant_id_anio_idx" ON "operacion"("tenant_id", "anio");

-- CreateIndex
CREATE INDEX "operacion_tenant_id_tipo_estado_idx" ON "operacion"("tenant_id", "tipo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "operacion_tenant_id_codigo_key" ON "operacion"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "operacion_punta_tenant_id_idx" ON "operacion_punta"("tenant_id");

-- CreateIndex
CREATE INDEX "operacion_punta_operacion_id_idx" ON "operacion_punta"("operacion_id");

-- CreateIndex
CREATE INDEX "operacion_punta_usuario_id_idx" ON "operacion_punta"("usuario_id");

-- CreateIndex
CREATE INDEX "objetivo_tenant_id_idx" ON "objetivo"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "objetivo_tenant_id_usuario_id_anio_key" ON "objetivo"("tenant_id", "usuario_id", "anio");

-- AddForeignKey
ALTER TABLE "operacion" ADD CONSTRAINT "operacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_punta" ADD CONSTRAINT "operacion_punta_operacion_id_fkey" FOREIGN KEY ("operacion_id") REFERENCES "operacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_punta" ADD CONSTRAINT "operacion_punta_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_punta" ADD CONSTRAINT "operacion_punta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security del módulo Tablero — mismo patrón que el núcleo
-- (ver 20260716220229_init_core y 20260716220600_lockdown_grants).
--
-- 1) Least-privilege: Supabase concede a anon/authenticated privilegios amplios
--    en tablas nuevas (incluye TRUNCATE, que IGNORA RLS). Se revoca todo y se
--    otorga solo lo necesario al rol de runtime `authenticated`.
-- 2) RLS + policy tenant_isolation por tenant_id, tomado de `app.tenant_id`
--    (GUC seteado por request). nullif(...,'') evita error de cast si viene
--    vacío; sin contexto la comparación da NULL => deny por defecto.
-- service_role (backend admin, BYPASSRLS) y postgres (migraciones/seed) no se
-- ven afectados.
-- =============================================================================

REVOKE ALL ON "operacion" FROM anon, authenticated;
REVOKE ALL ON "operacion_punta" FROM anon, authenticated;
REVOKE ALL ON "objetivo" FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON "operacion" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "operacion_punta" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "objetivo" TO authenticated;

ALTER TABLE "operacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operacion_punta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "objetivo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "operacion"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "operacion_punta"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "objetivo"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
