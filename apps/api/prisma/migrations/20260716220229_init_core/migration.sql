-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'basico',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "lider_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" UUID NOT NULL,
    "rol" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "usuario_tenant_id_idx" ON "usuario"("tenant_id");

-- CreateIndex
CREATE INDEX "usuario_lider_id_idx" ON "usuario"("lider_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tenant_id_email_key" ON "usuario"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "usuario_rol_tenant_id_idx" ON "usuario_rol"("tenant_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security (aislamiento multi-tenant) — CLAUDE.md §2, MODELO Parte D.
--
-- El rol `postgres` (usado por migraciones/seed) tiene BYPASSRLS y no se ve
-- afectado. Las queries de negocio corren bajo `SET LOCAL ROLE authenticated`
-- (sin BYPASSRLS), con `app.tenant_id` seteado por request. La policy compara
-- contra ese GUC; `nullif(..., '')` evita error de cast si viene vacío, y sin
-- contexto la comparación da NULL => deny por defecto.
-- =============================================================================

-- Privilegios de datos para el rol de runtime.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON "tenant" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "usuario" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "usuario_rol" TO authenticated;

-- Activar RLS.
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario_rol" ENABLE ROW LEVEL SECURITY;

-- Policies de aislamiento por tenant.
CREATE POLICY tenant_isolation ON "tenant"
  USING ("id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "usuario"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "usuario_rol"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
