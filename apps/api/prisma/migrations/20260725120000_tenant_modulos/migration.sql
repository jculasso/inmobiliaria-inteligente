-- Licenciamiento por módulos: cada módulo se habilita por separado en el tenant
-- ("prendido / pagado"). `plan` queda como etiqueta comercial, sin efecto en
-- los permisos. Incluye el módulo nuevo "protocolo" (Protocolo 5 Semanas).

ALTER TABLE "tenant"
  ADD COLUMN IF NOT EXISTS "modulos" JSONB NOT NULL
  DEFAULT '{"tablero": true, "tasador": false, "todo": false, "protocolo": false}'::jsonb;

-- Backfill de los tenants existentes según el plan que tenían hasta ahora
-- (MODULOS_POR_PLAN_LEGACY): básico = solo tablero; profesional/enterprise =
-- tablero + tasador + to do. El protocolo arranca apagado para todos: se
-- habilita a mano cuando la inmobiliaria lo contrata.
UPDATE "tenant"
SET "modulos" = CASE
  WHEN "plan" IN ('profesional', 'enterprise')
    THEN '{"tablero": true, "tasador": true, "todo": true, "protocolo": false}'::jsonb
  ELSE '{"tablero": true, "tasador": false, "todo": false, "protocolo": false}'::jsonb
END;
