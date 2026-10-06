-- Módulo Alquileres — entrega 9 (firma del contrato, prevista).
--
-- Solo agrega columnas e índices a tablas que están vacías en producción.

-- Un documento por contrato: el contrato que se firma.
CREATE UNIQUE INDEX "alq_documento_contrato_id_key" ON "alq_documento"("contrato_id");

-- El nombre del PDF tal como se subió, y el PDF firmado cuando vuelve.
ALTER TABLE "alq_documento" ADD COLUMN "nombre_archivo" TEXT;
ALTER TABLE "alq_documento" ADD COLUMN "archivo_firmado" TEXT;

-- El aviso de un proveedor se reconoce por su envío: el mismo envío no puede
-- ser de dos documentos (regla 34: un aviso que no corresponde se rechaza).
CREATE UNIQUE INDEX "alq_documento_proveedor_envio_externo_id_key" ON "alq_documento"("proveedor", "envio_externo_id");

-- Cada persona firma una vez cada documento, y se sabe cuándo.
ALTER TABLE "alq_firmante" ADD COLUMN "firmado_el" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "alq_firmante_documento_id_persona_id_key" ON "alq_firmante"("documento_id", "persona_id");
