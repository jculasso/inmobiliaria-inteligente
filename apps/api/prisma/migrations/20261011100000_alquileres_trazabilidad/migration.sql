-- Módulo Alquileres — entrega 11 (listas claras y trazabilidad).
--
-- Pedidos de Javier del 6/10/2026: numerar los contratos con el prefijo de la
-- inmobiliaria (ALT-0001, VAC-0001), borrar lo que no tiene historia y anular
-- lo demás, y saber «quién es el operador que registra la transacción».

-- 1. El código del contrato, en orden numérico ------------------------------
--
-- El código es texto y ordenado como texto da 1, 10, 2. Como en `operacion`,
-- una columna GENERADA con la parte numérica: la calcula Postgres y no puede
-- quedar desincronizada.
ALTER TABLE "alq_contrato"
  ADD COLUMN "codigo_num" NUMERIC
  GENERATED ALWAYS AS (NULLIF(REGEXP_REPLACE("codigo", '\D', '', 'g'), '')::NUMERIC) STORED;
CREATE INDEX "alq_contrato_tenant_id_codigo_num_idx" ON "alq_contrato"("tenant_id", "codigo_num");

-- Los códigos que son solo un número pasan a llevar el prefijo de su
-- inmobiliaria: «5» → «ALT-0005». El prefijo son las tres primeras letras del
-- nombre corto (o del nombre), igual que `prefijoDeContratos` en
-- @vacker/types. Hoy solo Alteva tiene contratos; Vacker entra con la
-- migración desde Gexion, que ya los trae con su número.
UPDATE "alq_contrato" c
SET "codigo" = p.prefijo || '-' || LPAD(c."codigo", 4, '0')
FROM (
  SELECT t."id",
         UPPER(LEFT(REGEXP_REPLACE(COALESCE(NULLIF(t."config"->>'nombreCorto', ''), t."nombre"), '[^A-Za-z]', '', 'g'), 3)) AS prefijo
  FROM "tenant" t
) p
WHERE c."tenant_id" = p."id"
  AND c."codigo" ~ '^\d+$'
  AND p.prefijo <> '';

-- 2. Quién cargó y quién anuló -----------------------------------------------
ALTER TABLE "alq_contrato" ADD COLUMN "creado_por_id" UUID;
ALTER TABLE "alq_contrato" ADD COLUMN "anulado_en" TIMESTAMPTZ(6);
ALTER TABLE "alq_contrato" ADD COLUMN "anulado_por_id" UUID;
ALTER TABLE "alq_contrato" ADD COLUMN "motivo_anulacion" TEXT;
ALTER TABLE "alq_concepto" ADD COLUMN "creado_por_id" UUID;

-- 3. El historial del módulo -------------------------------------------------
--
-- Sin claves foráneas salvo al tenant: el evento de un contrato borrado tiene
-- que seguir existiendo, y el nombre del usuario se guarda tal como era.
CREATE TABLE "alq_evento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "usuario_nombre" TEXT,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "contrato_id" UUID,
    "persona_id" UUID,
    "resumen" TEXT NOT NULL,
    "detalle" JSONB,

    CONSTRAINT "alq_evento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alq_evento_tenant_id_idx" ON "alq_evento"("tenant_id");
CREATE INDEX "alq_evento_tenant_id_contrato_id_en_idx" ON "alq_evento"("tenant_id", "contrato_id", "en");
CREATE INDEX "alq_evento_tenant_id_persona_id_en_idx" ON "alq_evento"("tenant_id", "persona_id", "en");
CREATE INDEX "alq_evento_tenant_id_entidad_entidad_id_idx" ON "alq_evento"("tenant_id", "entidad", "entidad_id");

ALTER TABLE "alq_evento" ADD CONSTRAINT "alq_evento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

REVOKE ALL ON "alq_evento" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_evento" TO authenticated;
ALTER TABLE "alq_evento" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_evento"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
