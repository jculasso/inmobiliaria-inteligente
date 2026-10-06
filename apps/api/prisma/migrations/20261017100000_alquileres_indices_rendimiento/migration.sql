-- Módulo Alquileres — índices por la revisión de performance del 6/10/2026.
--
-- Solo agrega: una columna generada y seis índices. No toca datos.

-- De dónde salió cada concepto: el segundo tramo de la clave de generación
-- (`bol|<boleta>|…`, `prov|<comprobante>|…`, `alq|<contrato>|…`). Generada por
-- la base, como `codigo_num`: nadie la escribe. Reemplaza las búsquedas
-- `clave_generacion LIKE 'bol|…|%'`, que no usan índice y recorrían todos
-- los conceptos de la inmobiliaria.
ALTER TABLE "alq_concepto"
  ADD COLUMN "clave_origen" TEXT
  GENERATED ALWAYS AS (NULLIF(split_part("clave_generacion", '|', 2), '')) STORED;

CREATE INDEX "alq_concepto_tenant_id_clave_origen_idx" ON "alq_concepto"("tenant_id", "clave_origen");

-- Los sueltos del mes se buscan por vencimiento (sin período).
CREATE INDEX "alq_concepto_tenant_id_vencimiento_idx" ON "alq_concepto"("tenant_id", "vencimiento");

-- Anular una liquidación libera sus conceptos; anular un concepto busca los enlazados.
CREATE INDEX "alq_concepto_liquidacion_id_idx" ON "alq_concepto"("liquidacion_id");
CREATE INDEX "alq_concepto_origen_id_idx" ON "alq_concepto"("origen_id");

-- Los ingresos del tablero filtran los cobros por fecha.
CREATE INDEX "alq_cobro_tenant_id_fecha_idx" ON "alq_cobro"("tenant_id", "fecha");
