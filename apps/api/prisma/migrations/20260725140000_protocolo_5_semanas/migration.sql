-- Módulo Protocolo 5 Semanas. Ver docs/MODULO_PROTOCOLO_5_SEMANAS.md.
-- La ficha es 1:1 con una tasación Captada; la tasación no cambia de estado.

-- CreateTable
CREATE TABLE "protocolo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tasacion_id" UUID NOT NULL,
    "agente_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "precio_publicado" DECIMAL(14,2),
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "propietario_nombre" TEXT,
    "propietario_telefono" TEXT,
    "propietario_email" TEXT,
    "vencimiento_autorizacion" DATE,
    "consultas" INTEGER NOT NULL DEFAULT 0,
    "consultas_calificadas" INTEGER NOT NULL DEFAULT 0,
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "interesados_activos" INTEGER NOT NULL DEFAULT 0,
    "ofertas" INTEGER NOT NULL DEFAULT 0,
    "devoluciones_mercado" TEXT,
    "objeciones" TEXT,
    "recomendacion" TEXT,
    "decision_propietario" TEXT,
    "proximas_acciones" TEXT,
    "archivado_en" DATE,
    "motivo_archivo" TEXT,
    "observacion_archivo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolo_accion" (
    "id" UUID NOT NULL,
    "protocolo_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "semana" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha_prevista" DATE,
    "fecha_realizada" DATE,
    "observaciones" TEXT,
    "resultado" TEXT,
    "evidencia" TEXT,

    CONSTRAINT "protocolo_accion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "protocolo_tasacion_id_key" ON "protocolo"("tasacion_id");
CREATE INDEX "protocolo_tenant_id_idx" ON "protocolo"("tenant_id");
CREATE INDEX "protocolo_tenant_id_agente_id_idx" ON "protocolo"("tenant_id", "agente_id");
CREATE INDEX "protocolo_tenant_id_estado_idx" ON "protocolo"("tenant_id", "estado");
CREATE INDEX "protocolo_accion_tenant_id_idx" ON "protocolo_accion"("tenant_id");
CREATE INDEX "protocolo_accion_protocolo_id_idx" ON "protocolo_accion"("protocolo_id");

-- AddForeignKey
ALTER TABLE "protocolo" ADD CONSTRAINT "protocolo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "protocolo" ADD CONSTRAINT "protocolo_tasacion_id_fkey" FOREIGN KEY ("tasacion_id") REFERENCES "tasacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "protocolo" ADD CONSTRAINT "protocolo_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protocolo_accion" ADD CONSTRAINT "protocolo_accion_protocolo_id_fkey" FOREIGN KEY ("protocolo_id") REFERENCES "protocolo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "protocolo_accion" ADD CONSTRAINT "protocolo_accion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security: aislamiento por tenant (mismo patrón que el resto de las
-- tablas de negocio, ver 20260716223817_tablero). El alcance por rol
-- (vendedor / team leader / dirección) lo aplica el servicio con agente_id.
-- ============================================================================
REVOKE ALL ON "protocolo" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "protocolo" TO authenticated;
ALTER TABLE "protocolo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "protocolo"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "protocolo_accion" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "protocolo_accion" TO authenticated;
ALTER TABLE "protocolo_accion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "protocolo_accion"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
