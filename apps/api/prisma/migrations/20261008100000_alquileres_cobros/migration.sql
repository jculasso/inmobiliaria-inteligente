-- Módulo Alquileres — entrega 6 (cobros).
--
-- Solo agrega columnas a tablas que todavía están vacías en producción (se
-- crearon en la entrega 1 y el módulo no se usó). Por eso `numero` y
-- `registrada_en_cobro_id` pueden nacer NOT NULL sin default.

-- El número del recibo, correlativo por inmobiliaria. Un recibo sin número no
-- se puede citar en un reclamo.
ALTER TABLE "alq_cobro" ADD COLUMN "numero" INTEGER NOT NULL;
CREATE UNIQUE INDEX "alq_cobro_tenant_id_numero_key" ON "alq_cobro"("tenant_id", "numero");

-- En qué cobro se registró cada imputación. Casi siempre es el mismo cobro de
-- donde sale la plata; es otro cuando se aplica el saldo a favor de un cobro
-- anterior (regla 17). Sirve para dos cosas: que el recibo muestre lo que se
-- aplicó de saldo a favor, y que anular ese cobro revierta también eso.
ALTER TABLE "alq_imputacion" ADD COLUMN "registrada_en_cobro_id" UUID NOT NULL;
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_registrada_en_cobro_id_fkey" FOREIGN KEY ("registrada_en_cobro_id") REFERENCES "alq_cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "alq_imputacion_registrada_en_cobro_id_idx" ON "alq_imputacion"("registrada_en_cobro_id");

-- El cobro que creó un concepto: el punitorio nace al cobrar (regla 16), y
-- si el cobro se anula, el punitorio se anula con él.
ALTER TABLE "alq_concepto" ADD COLUMN "cobro_id" UUID;
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "alq_cobro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "alq_concepto_cobro_id_idx" ON "alq_concepto"("cobro_id");
