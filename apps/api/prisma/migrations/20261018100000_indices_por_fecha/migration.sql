-- Índices por fecha dentro de cada inmobiliaria (revisión de performance del
-- 6/10/2026).
--
-- Las tasaciones se listan y se agregan por período (`fecha` entre el 1/1 y
-- el 31/12 del año pedido, ordenadas de la más nueva a la más vieja), y los
-- protocolos igual con `fecha_inicio`. Sin estos índices, cada pantalla del
-- Tasador y del Protocolo recorre TODAS las filas de la inmobiliaria para
-- quedarse con las de un año: hoy no se nota, con unos años de histórico sí.
--
-- `operacion (tenant_id, codigo_num)` NO va acá: ya lo creó
-- 20260728120000_operacion_codigo_num.
--
-- IF NOT EXISTS: si alguien ya los creó a mano en producción, la migración no
-- falla. Sin CONCURRENTLY porque Prisma corre cada migración en una
-- transacción; las tablas son chicas y el bloqueo dura milisegundos.

CREATE INDEX IF NOT EXISTS "tasacion_tenant_id_fecha_idx" ON "tasacion" ("tenant_id", "fecha");
CREATE INDEX IF NOT EXISTS "protocolo_tenant_id_fecha_inicio_idx" ON "protocolo" ("tenant_id", "fecha_inicio");
