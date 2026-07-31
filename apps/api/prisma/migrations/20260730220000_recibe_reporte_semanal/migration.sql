-- Quién recibe el reporte semanal del Protocolo por mail.
--
-- NO se deriva del rol, y es a propósito: en Vacker `direccion` son cuatro
-- personas —los dos dueños y los dos implementadores— y mandarlo "a los
-- direccion" se lo manda también a quienes no lo pidieron. Quién recibe un
-- mail es una decisión de negocio; el rol es un permiso. Mezclarlos es la
-- misma confusión que ya costó una vez entre vista y permiso
-- (CONVENCIONES_TECNICAS.md §2).
--
-- Arranca apagado para todos: un reporte que llega sin que nadie lo haya
-- pedido se marca como spam la primera vez.
ALTER TABLE "usuario"
  ADD COLUMN "recibe_reporte_semanal" BOOLEAN NOT NULL DEFAULT false;
